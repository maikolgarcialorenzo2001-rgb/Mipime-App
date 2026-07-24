# Tasks: fifo-inventario

## Workload
- **Review Workload Forecast**: High
- **Estimated total lines**: ~305
- **Chained PRs recommended**: Yes (2 PRs)
- **Decision needed before apply**: No

## Phase 1: Foundation — Database & Models

*No dependencies. All tasks in this phase can run in parallel.*

- [ ] **Task 1.1** — Create `src/app/models/lote-stock.ts`
  - `LoteStock` interface: `id`, `producto_id`, `cantidad`, `precio_costo`, `fecha_ingreso`, `created_at`
  - `ConsumoRecord` interface: `lote_id`, `cantidad`, `precio_costo_real`
  - ~15 lines

- [ ] **Task 1.2** — Create `src/app/models/venta-lote.ts`
  - `VentaLote` interface: `id`, `venta_id`, `lote_id`, `producto_id`, `cantidad`, `precio_costo_real`, `created_at`
  - ~12 lines

- [ ] **Task 1.3** — Update `src/app/models/index.ts`
  - Export `LoteStock`, `ConsumoRecord`, `VentaLote`
  - ~3 lines

- [ ] **Task 1.4** — Migration v8 in `src/app/services/sqlite.service.ts`
  - Wire into `initialize()` after v7: `if (currentVersion < 8)`
  - Add `_migrationV8()` with:
    - `CREATE TABLE lotes_stock` with columns + CHECK(cantidad >= 0)
    - `CREATE TABLE venta_lotes` with FK references
    - Indexes: `idx_lotes_producto`, `idx_venta_lotes_venta`, `idx_venta_lotes_producto`
    - Backfill INSERT: one lot per existing product with `stock_actual > 0`
    - `INSERT INTO schema_version (version) VALUES (8)`
  - ~35 lines

## Phase 2: FIFO Engine — StockMovimientoService

*Depends on Phase 1 (lotes_stock table, ConsumoRecord interface).*

- [ ] **Task 2.1** — Add `_consumirFIFO()` private method
  - `SELECT * FROM lotes_stock WHERE producto_id = ? AND cantidad > 0 ORDER BY fecha_ingreso ASC, id ASC`
  - Iterate lots, consume `Math.min(restante, lote.cantidad)`, UPDATE each lot
  - Throw `'Stock insuficiente'` if `restante > 0` after all lots consumed
  - Recalculate `productos.stock_actual = SUM(lotes_stock.cantidad)` from lot source of truth
  - Return `ConsumoRecord[]`
  - ~45 lines

- [ ] **Task 2.2** — Modify `registrarEntrada` signature and body
  - **Signature change**: add `precioCosto: number` as 3rd param (before `motivo`)
  - INSERT into `lotes_stock` (new lot) + UPDATE `productos.stock_actual += cantidad` + INSERT `stock_movimientos`
  - ~20 lines changed

- [ ] **Task 2.3** — Modify `registrarSalida` signature and body
  - **Return type change**: from `Promise<void>` to `Promise<ConsumoRecord[]>`
  - Remove manual `SELECT stock_actual` validation (FIFO throws on insufficient)
  - Remove direct `UPDATE productos SET stock_actual -= cantidad`
  - Call `_consumirFIFO()` instead
  - ~25 lines changed

- [ ] **Task 2.4** — Modify `registrarAjuste` body
  - SELECT all current lots for the product
  - Calculate weighted average `precio_costo`
  - DELETE all existing lots
  - INSERT new single lot with `cantidad` = new stock level and weighted average cost
  - Keep existing `stock_movimientos` INSERT + stock_actual SET
  - ~30 lines changed

## Phase 3: VentaService — FIFO Integration

*Depends on Phase 2 (registrarSalida returns ConsumoRecord[]).*

- [ ] **Task 3.1** — Update `VentaService._ejecutar()`
  - **Remove** the batch `UPDATE productos SET stock_actual = CASE ... END` (lines 174-194 in current file) — this eliminates the double-decrement bug
  - **Add** capture of `ConsumoRecord[]` from `registrarSalida` calls
  - For each `ConsumoRecord`, INSERT into `venta_lotes` (inside the same transaction)
  - Keep stock validation before transaction
  - ~35 lines changed

## Phase 4: ProductoService — Initial Lot on Create

*Depends on Phase 2 (registrarEntrada with precioCosto param).*

- [ ] **Task 4.1** — Inject `StockMovimientoService` into `ProductoService`
  - In `crear()`, after the product INSERT, if `data.stock_actual > 0`:
  - Call `this._stockMovimiento.registrarEntrada(producto.id, data.stock_actual, data.precio_costo)`
  - No circular dependency (StockMovimientoService does not depend on ProductoService)
  - ~15 lines

## Phase 5: JornadaService — Total Cost from VentaLotes

*Depends on Phase 3 (venta_lotes populated by sales).*

- [ ] **Task 5.1** — Update `_recolectarDatosJornada()` totalCosto query
  - Replace the current `SELECT SUM(dv.cantidad * COALESCE(p.precio_costo, 0))` with a COALESCE query:
    - Try `SUM(vl.cantidad * vl.precio_costo_real) FROM venta_lotes` first
    - Fallback to old method for pre-migration sales
  - ~15 lines changed

- [ ] **Task 5.2** — Update `_ejecutarCierre()` totalCosto query (same change)
  - Same change as Task 5.1, identical query pattern in the close-rollup path
  - ~15 lines changed

## Phase 6: InventarioPage UI

*Depends on Phase 1 (lot display), Phase 2 (registrarEntrada needs precioCosto).*

- [ ] **Task 6.1** — Add `movimientoCosto` signal and entry form field
  - Add `movimientoCosto = signal<number>(0)` to TypeScript
  - In `onSubmitMovimiento()`, pass `this.movimientoCosto()` to `registrarEntrada` for `'entrada'` type
  - In HTML, add cost input field visible only when `tipo === 'entrada'`
  - ~20 lines TS + ~15 lines HTML

- [ ] **Task 6.2** — Add lot details display (expandable per product)
  - Add `lotesPorProducto` signal/derived state for fetching lot data
  - In HTML expandable row (below history), show sub-table with columns: Cantidad, Costo unit., Fecha ingreso
  - ~10 lines TS + ~25 lines HTML

## Phase 7: CuentaCosasService

*Depends on Phase 2 (auto-benefits from FIFO).*

- [ ] **Task 7.1** — No code changes needed
  - Already calls `registrarSalida(productoId, cantidad)` — the FIFO consumption happens inside
  - Return value (`ConsumoRecord[]`) is ignored — TS allows this
  - Verify test file expectations match new `registrarSalida` signature (mock return type)
  - ~2 lines (update mock if needed)

## Dependency Graph

```
Phase 1 (Foundation)
  └── Task 1.1, 1.2, 1.3, 1.4 ← all independent, can parallelize

Phase 2 (FIFO Engine)
  └── Depends on Phase 1 (lotes_stock table, ConsumoRecord)

Phase 3 (VentaService)
  └── Depends on Phase 2 (registrarSalida returns ConsumoRecord[])

Phase 4 (ProductoService)
  └── Depends on Phase 2 (registrarEntrada with precioCosto)

Phase 5 (JornadaService)
  └── Depends on Phase 3 (venta_lotes populated)

Phase 6 (InventarioPage UI)
  └── Depends on Phase 1 (lot data) + Phase 2 (registrarEntrada signature)

Phase 7 (CuentaCosasService)
  └── Depends on Phase 2 (auto, no code change)
```

## Spec Compliance Coverage

| Req | Description | Covered By |
|-----|-------------|------------|
| R1  | LOTES_STOCK table with lot tracking | Task 1.4 |
| R2  | VENTA_LOTES table for sale-lot mapping | Task 1.4 |
| R3  | FIFO consumption — oldest lot first | Task 2.1 (SELECT ORDER BY fecha_ingreso ASC) |
| R4  | Stock exit (sale) consumes from FIFO | Task 3.1 |
| R5  | Stock exit (manual) consumes from FIFO | Task 2.3 (registrarSalida → _consumirFIFO) |
| R6  | Stock exit (cuenta-cosa) consumes from FIFO | Task 7.1 (auto via registrarSalida) |
| R7  | Backfill: existing stock → initial lots | Task 1.4 (INSERT INTO lotes_stock SELECT ...) |
| R8  | Stock entry requires cost input | Task 2.2 (precioCosto required param) + Task 6.1 (UI field) |
| R9  | Lot-level visibility in inventory UI | Task 6.2 |
| R10 | Total cost from actual lot cost at sale time | Task 5.1, 5.2 (venta_lotes with fallback) |
| R11 | Migration preserves existing data | Task 1.4 (backfill, no destructive ops) |

## Testing Backlog

### StockMovimientoService (existing spec + new tests)
- [ ] **T1** — Update existing `registrarEntrada` tests: add `precioCosto` param to all calls, verify INSERT into `lotes_stock`
- [ ] **T2** — `_consumirFIFO`: single lot covers full quantity
- [ ] **T3** — `_consumirFIFO`: spans multiple lots (oldest consumed first)
- [ ] **T4** — `_consumirFIFO`: insufficient stock throws `'Stock insuficiente'` (remove old SELECT-based test)
- [ ] **T5** — `_consumirFIFO`: recalculates `stock_actual` from lots after consumption
- [ ] **T6** — Update `registrarSalida` tests: expects `ConsumoRecord[]` return, verify lot UPDATE calls, remove stock_actual UPDATE assertion
- [ ] **T7** — Update `registrarAjuste` tests: verify lot DELETE + weighted avg INSERT, verify new stock_actual SET

### VentaService (existing spec)
- [ ] **T8** — Update existing `registrar` tests: remove batch stock_UPDATE mocks, add `venta_lotes` INSERT expectations
- [ ] **T9** — New test: verify `venta_lotes` records match `ConsumoRecord[]` returned from `registrarSalida`

### JornadaService (existing spec)
- [ ] **T10** — Update `totalCosto` expectations: mock `venta_lotes` return
- [ ] **T11** — New test: fallback query runs when `venta_lotes` is empty (pre-migration sales)

### ProductoService (existing spec)
- [ ] **T12** — New test: `crear()` with `stock_actual > 0` calls `registrarEntrada`
- [ ] **T13** — New test: `crear()` with `stock_actual === 0` does NOT call `registrarEntrada`

### InventarioPage (existing spec)
- [ ] **T14** — Update test 7: `registrarEntrada` now expects 4 args (with `precioCosto`), wire `movimientoCosto` signal
- [ ] **T15** — New test: entry form shows costo input field
- [ ] **T16** — New test: lot details section renders correctly

### SQLiteService (existing spec)
- [ ] **T17** — New test: migration v8 creates tables and backfills lots

### CuentaCosasService (existing spec)
- [ ] **T18** — Verify mock return type matches new `registrarSalida` signature

## PR Strategy

**Estimate**: ~305 total lines across all phases.

**Recommendation**: 2 chained PRs.

| PR | Phases | Lines | Rationale |
|----|--------|-------|-----------|
| **PR 1** | Phase 1, Phase 2 | ~135 | Foundation + FIFO engine. Standalone testable. No UI change. |
| **PR 2** | Phase 3, 4, 5, 6, 7 | ~170 | Consumption integration + UI. Depends on PR 1. |

**PR 1** can be reviewed independently — it introduces the lot tables, migration, and FIFO algorithm without changing any UI or sale flow. All existing tests for `registrarEntrada`/`registrarSalida`/`registrarAjuste` break (signature change) but the new spec covers them.

**PR 2** wires everything together — VentaService consumes FIFO records, JornadaService reads from `venta_lotes`, ProductoService auto-creates lots, and the UI provides cost input + lot visibility.

If the reviewer prefers a single PR (relatively small change for a single feature), that's also acceptable — the 305-line estimate is borderline.
