# Design: FIFO Inventario

## Technical Approach

Introduce lot-based stock tracking with FIFO consumption for accurate per-sale cost basis. Add two new tables (`lotes_stock`, `venta_lotes`), migrate existing products into single lots, and change all stock exit paths (sales, manual exits, cuenta-cosas) to consume from oldest lot first. The gross income calculation in jornada/service and Excel shifts from `productos.precio_costo` (always current cost) to `venta_lotes.precio_costo_real` (actual cost at sale time).

The FIFO consumption logic lives inside `StockMovimientoService` as private methods. `registrarSalida` returns the consumption records so `VentaService` can insert `venta_lotes` entries inside its existing transaction — no separate service needed, no breaking change for callers like `CuentaCosasService`.

## Architecture Decisions

### Decision: FIFO logic in StockMovimientoService (not a separate service)

**Choice**: Embed FIFO consumption as private methods in StockMovimientoService. `registrarSalida` returns `ConsumoRecord[]` for callers that need them (VentaService).  
**Alternatives considered**: 
- Standalone `FifoService` — more testable but adds a service for ~30 lines of SQL logic. All callers already depend on StockMovimientoService; this avoids injecting yet another dependency.
- Static utility function — can't participate in caller's transaction (same SQLocal instance handles this, but utility pattern doesn't match Angular DI conventions).
**Rationale**: Every stock exit path (sale, manual salida, cuenta-cosa) already goes through StockMovimientoService. Adding the FIFO logic there is additive, not disruptive. Only VentaService needs the consumption records — we just change the return type.

### Decision: registrarEntrada signature — new `precioCosto` param

**Choice**: Add `precioCosto: number` as the third parameter (before motivo).  
**Alternatives considered**: Optional param (precioCosto?) — would silently create lots with cost 0 if omitted, which is worse than a compile error.  
**Rationale**: Required by spec (R8). Every stock entry creates a lot with a cost basis — having it optional hides bugs.

### Decision: ProductoService.crear creates initial lot

**Choice**: Inject StockMovimientoService into ProductoService. If `stock_actual > 0`, call `registrarEntrada` after the INSERT to create the initial lot.  
**Alternatives considered**: Make inventario.page call registrarEntrada separately — would require every caller to know this, increasing coupling.  
**Rationale**: Creating a product with stock should be atomic from the caller's perspective. ProductoService already owns the product lifecycle.

### Decision: totalCosto in jornada/service — query venta_lotes with fallback

**Choice**: Calculate `totalCosto` from `venta_lotes` table. For old sales (pre-migration) with no venta_lotes records, fall back to `detalle_ventas.cantidad * productos.precio_costo`.  
**Alternatives considered**: Backfill venta_lotes for all historical sales — complex migration, and historical cost data is already lost.  
**Rationale**: Forward-looking accuracy. Old reports keep their old cost calculation; new reports are accurate. Both queries run; the false path is `COALESCE(venta_lotes_total, old_total, 0)`.

### Decision: Stock adjustment replaces lots with weighted-average cost

**Choice**: On `registrarAjuste`, delete all existing lots and create one new lot with `precio_costo` = weighted average of removed lots.  
**Alternatives considered**: Keep existing lots and distribute the new quantity proportionally — over-engineered for a manual override.  
**Rationale**: Adjustments are manual interventions where the user explicitly sets a new stock level. Weighted average preserves the cost basis of what was there without creating tracking complexity.

## Data Flow

```
[Stock Entry ──→ inventario.page]
  → StockMovimientoService.registrarEntrada(cantidad, precioCosto)
    → INSERT lotes_stock (new lot)
    → UPDATE productos.stock_actual += cantidad
    → INSERT stock_movimientos (entrada)

[Sale ──→ VentaService._ejecutar (within BEGIN/COMMIT)]
  → INSERT ventas
  → INSERT detalle_ventas (batch)
  → for each item:
      → StockMovimientoService.registrarSalida(cantidad)
        → _consumirFIFO(productoId, cantidad)
          → SELECT lotes ORDER BY fecha_ingreso ASC
          → for each lot: UPDATE lotes_stock SET cantidad -= consumed
          → UPDATE productos.stock_actual = SUM(lotes_stock.cantidad)
        → INSERT stock_movimientos (salida)
        → returns ConsumoRecord[]
      → for each ConsumoRecord:
        → INSERT venta_lotes (venta_id, lote_id, cantidad, precio_costo_real)
  → UPDATE jornadas (total_ventas, saldo_esperado)

[Manual stock exit ──→ inventario.page]
  → StockMovimientoService.registrarSalida(cantidad)
    → _consumirFIFO (same as above)
    → no venta_lotes inserted

[Cuenta Cosas ──→ CuentaCosasService]
  → INSERT cuenta_cosas
  → StockMovimientoService.registrarSalida(...)  ← unchanged call, FIFO happens inside

[Jornada close ──→ JornadaService._ejecutarCierre / _recolectarDatosJornada]
  → totalCosto = query venta_lotes (fallback to old method for pre-migration sales)
  → Excel receives totalCosto as before — no interface change

[Excel ──→ ExcelService]
  → "Precio base" column: unchanged — still shows from productosMap.precio_costo
    (this is the current cost, not historical. The cost column in Excel is informational,
    the actual profit calculation uses totalCosto from JornadaService)
```

## Database Schema (Migration v8)

```sql
-- Migration v8
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS lotes_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad REAL NOT NULL CHECK (cantidad >= 0),
  precio_costo REAL NOT NULL,
  fecha_ingreso TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venta_lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  lote_id INTEGER NOT NULL REFERENCES lotes_stock(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_costo_real REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes_stock(producto_id, fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_venta_lotes_venta ON venta_lotes(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_lotes_producto ON venta_lotes(venta_id, producto_id);

-- Backfill: one lot per existing product with stock > 0
INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
SELECT
  id,
  stock_actual,
  COALESCE(precio_costo, 0),
  created_at,
  datetime('now')
FROM productos
WHERE stock_actual > 0;

-- Verify integrity (no-op in migration, but we log if mismatch is found)
-- SELECT id, nombre, stock_actual FROM productos WHERE stock_actual !=
--   (SELECT COALESCE(SUM(cantidad), 0) FROM lotes_stock WHERE producto_id = productos.id);

INSERT INTO schema_version (version) VALUES (8);
COMMIT;
```

## FIFO Consumption Algorithm

```
private async _consumirFIFO(
  productoId: number,
  cantidad: number,
): Promise<ConsumoRecord[]> {
  const lotes = await this._db.sql<LoteStock>(
    `SELECT * FROM lotes_stock
     WHERE producto_id = ? AND cantidad > 0
     ORDER BY fecha_ingreso ASC, id ASC`,
    [productoId],
  );

  let restante = cantidad;
  const consumos: ConsumoRecord[] = [];

  for (const lote of lotes) {
    if (restante <= 0) break;

    const consumir = Math.min(lote.cantidad, restante);
    restante -= consumir;

    await this._db.sql(
      'UPDATE lotes_stock SET cantidad = cantidad - ? WHERE id = ?',
      [consumir, lote.id],
    );

    consumos.push({
      lote_id: lote.id,
      cantidad: consumir,
      precio_costo_real: lote.precio_costo,
    });
  }

  if (restante > 0) {
    throw new Error('Stock insuficiente');
  }

  // Recalculate stock_actual from lots (always source of truth)
  await this._db.sql(
    `UPDATE productos
     SET stock_actual = (
       SELECT COALESCE(SUM(cantidad), 0)
       FROM lotes_stock
       WHERE producto_id = ?
     ), updated_at = ?
     WHERE id = ?`,
    [productoId, new Date().toISOString(), productoId],
  );

  return consumos;
}
```

## File Changes

### New Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/models/lote-stock.ts` | Create | `LoteStock` and `ConsumoRecord` interfaces |
| `src/app/models/venta-lote.ts` | Create | `VentaLote` interface |
| `src/app/models/index.ts` | Modify | Export new models |

### Modified Files

#### `src/app/services/sqlite.service.ts` — Migration v8

**What**: Add `_migrationV8()` with tables + backfill, wire into `initialize()` after v7.  
**Why**: Schema change required for lot tracking. Backfill ensures existing products have initial lots.

```typescript
if (currentVersion < 8) {
  await this._migrationV8(client);
}
```

#### `src/app/services/stock-movimiento.service.ts` — FIFO logic

**What**:
- Add `precioCosto: number` param to `registrarEntrada`
- Add private `_consumirFIFO()` — the core algorithm (shown above)
- `registrarEntrada`: creates `lotes_stock` + updates `stock_actual` instead of direct UPDATE
- `registrarSalida`: calls `_consumirFIFO`, returns `ConsumoRecord[]`, removes direct stock_actual UPDATE
- `registrarAjuste`: replaces all lots with weighted-average lot, removes direct stock_actual SET
- Remove stock validation from `registrarSalida` (FIFO throws if insufficient)

**Why**: Every stock operation now goes through lots. `ConsumoRecord` return lets VentaService insert `venta_lotes`.

```typescript
// New signature
async registrarEntrada(
  productoId: number,
  cantidad: number,
  precioCosto: number,       // ← new required param
  motivo?: string,
  jornadaId?: number,
): Promise<void> {
  const ahora = new Date().toISOString();
  // 1. Create lot
  await this._db.sql(
    `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [productoId, cantidad, precioCosto, ahora, ahora],
  );
  // 2. Update stock_actual
  await this._db.sql(
    `UPDATE productos SET stock_actual = stock_actual + ?, updated_at = ? WHERE id = ?`,
    [cantidad, ahora, productoId],
  );
  // 3. Record movimiento (unchanged)
  // ...
}

// New return type
async registrarSalida(
  productoId: number,
  cantidad: number,
  motivo?: string,
  jornadaId?: number,
): Promise<ConsumoRecord[]> {
  // 1. Consume FIFO (throws if insufficient)
  const consumos = await this._consumirFIFO(productoId, cantidad);
  // 2. Record movimiento (unchanged, but no stock_actual UPDATE)
  // ...
  return consumos;
}

async registrarAjuste(...): Promise<void> {
  // 1. Get current lots, calc weighted avg cost
  // 2. DELETE all lots
  // 3. INSERT one new lot with cantidad + weightedAvgCost
  // 4. UPDATE stock_actual = cantidad
  // 5. Record movimiento (unchanged)
}
```

#### `src/app/services/venta.service.ts` — FIFO + venta_lotes

**What**:
- Remove the batch `UPDATE productos SET stock_actual = CASE ... END` (step 2 in `_ejecutar`)
- Capture `ConsumoRecord[]` from `registrarSalida`, insert into `venta_lotes`
- Move stock validation inside the transaction (or keep it before — acceptable in local-only app)

**Why**: Sale must consume FIFO lots and record which lots were consumed for accurate cost tracking.

```typescript
// In _ejecutar, replace the stock update batch (lines 174-194) with:

// 4. Para cada item: FIFO consumption + venta_lotes
for (const item of items) {
  const consumos = await this._stockMovimiento.registrarSalida(
    item.producto.id,
    item.cantidad,
  );

  // Insert venta_lotes records (inside the same transaction)
  for (const c of consumos) {
    await this._db.sql(
      `INSERT INTO venta_lotes (venta_id, lote_id, producto_id, cantidad, precio_costo_real, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [venta.id, c.lote_id, item.producto.id, c.cantidad, c.precio_costo_real, ahora],
    );
  }
}
// Remove the old step 4 (registrarSalida calls) — already done above
```

#### `src/app/services/cuenta-cosa.service.ts` — No change needed

**Why**: Already calls `_stockMovimiento.registrarSalida()` which now consumes FIFO automatically. No `venta_lotes` needed for CC.

#### `src/app/services/jornada.service.ts` — totalCosto from venta_lotes

**What**: Change the `totalCosto` calculation in both `_ejecutarCierre` and `_recolectarDatosJornada` to query `venta_lotes` with fallback.  
**Why**: Gross income must use actual cost at time of sale, not current product cost.

```typescript
// New query with fallback
const costoResult = await this._db.sql<{ total_costo: number }>(
  `SELECT COALESCE(
    (SELECT SUM(vl.cantidad * vl.precio_costo_real)
     FROM venta_lotes vl
     WHERE vl.venta_id IN (${placeholders})),
    (SELECT SUM(dv.cantidad * COALESCE(p.precio_costo, 0))
     FROM detalle_ventas dv
     JOIN productos p ON p.id = dv.producto_id
     WHERE dv.venta_id IN (${placeholders})),
  0) as total_costo`,
  [...ventaIds, ...ventaIds],  // params for both subqueries
);
```

#### `src/app/services/producto.service.ts` — Initial lot on create

**What**: Inject `StockMovimientoService`. In `crear()`, if `stock_actual > 0`, call `registrarEntrada` after product INSERT.  
**Why**: New products with stock must have an initial lot.

```typescript
async crear(data: ...): Observable<Producto> {
  const producto = await this._db.sql<Producto>(
    `INSERT INTO productos ... RETURNING *`,
    [...],
  ).then(rows => rows[0]);

  if (data.stock_actual > 0) {
    await this._stockMovimiento.registrarEntrada(
      producto.id,
      data.stock_actual,
      data.precio_costo,
    );
  }

  return producto;
}
```

#### `src/app/services/excel.service.ts` — No change needed for cost column

**Why**: The "Precio base" column in Excel shows current product cost (`productosMap.precio_costo`) for informational purposes. The actual profit calculation uses `totalCosto` from JornadaService, which now queries `venta_lotes`. The Excel itself reads `JornadaReportData.totalCosto` which JornadaService already populates. No interface change required.

#### `src/app/pages/inventario/inventario.page.ts` — Entry form with precio_costo

**What**:
- Add `movimientoCosto = signal<number>(0)` for the entry form
- `onSubmitMovimiento`: pass `this.movimientoCosto()` to `registrarEntrada` when tipo === 'entrada'
- Optionally add lot display (expandable per product)

**Why**: Spec requires cost input on stock entry (R8). Lot display (R9) provides visibility.

```typescript
readonly movimientoCosto = signal<number>(0);

// In onSubmitMovimiento:
case 'entrada':
  await this.stockService.registrarEntrada(
    action.productoId,
    this.movimientoCantidad(),
    this.movimientoCosto(),  // ← required param
    this.movimientoMotivo() || undefined,
  );
  break;
```

#### `src/app/pages/inventario/inventario.page.html` — Cost field + lot display

**What**:
- Add `precio_costo` input to the inline entry form (visible only for 'entrada')
- Add expandable lot details section showing individual lot quantities and costs

**Why**: User must provide cost per unit on entry. Lot visibility helps inventory management.

```html
<!-- Inside the inline movement form, when tipo === 'entrada' -->
@if (selectedAction()?.tipo === 'entrada') {
  <div>
    <label class="block text-xs text-gray-500 mb-1">Costo por unidad</label>
    <input
      type="number"
      [(ngModel)]="movimientoCosto"
      name="movimientoCosto"
      placeholder="0.00"
      step="0.01"
      min="0"
      required
      class="border rounded px-3 py-2 text-sm w-28 ..."
    />
  </div>
}

<!-- Lot details (expandable row) -->
@if (showHistoryId() === producto.id) {
  <tr class="bg-gray-50/50">
    <td colspan="5" class="px-4 py-3">
      <h4 class="text-sm font-semibold mb-2">Lotes de stock</h4>
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="px-2 py-1 text-left text-xs text-gray-500">Cantidad</th>
            <th class="px-2 py-1 text-left text-xs text-gray-500">Costo unit.</th>
            <th class="px-2 py-1 text-left text-xs text-gray-500">Ingreso</th>
          </tr>
        </thead>
        <tbody>
          @for (lote of lotesPorProducto()[producto.id] ?? []; track lote.id) {
            <tr class="border-t">
              <td class="px-2 py-1">{{ lote.cantidad }}</td>
              <td class="px-2 py-1">${{ lote.precio_costo.toFixed(2) }}</td>
              <td class="px-2 py-1">{{ lote.fecha_ingreso | date:'short' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </td>
  </tr>
}
```

## Interfaces / Contracts

### New: LoteStock model

```typescript
// src/app/models/lote-stock.ts
export interface LoteStock {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_costo: number;
  fecha_ingreso: string;
  created_at: string;
}

export interface ConsumoRecord {
  lote_id: number;
  cantidad: number;
  precio_costo_real: number;
}
```

### New: VentaLote model

```typescript
// src/app/models/venta-lote.ts
export interface VentaLote {
  id: number;
  venta_id: number;
  lote_id: number;
  producto_id: number;
  cantidad: number;
  precio_costo_real: number;
  created_at: string;
}
```

### Modified: StockMovimientoService

```typescript
class StockMovimientoService {
  async registrarEntrada(
    productoId: number,
    cantidad: number,
    precioCosto: number,      // ← NEW required param
    motivo?: string,
    jornadaId?: number,
  ): Promise<void>;

  async registrarSalida(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
  ): Promise<ConsumoRecord[]>;  // ← NEW return type (was Promise<void>)

  async registrarAjuste(
    productoId: number,
    cantidad: number,
    motivo: string,
    jornadaId?: number,
  ): Promise<void>;  // unchanged signature
}
```

### Modified: VentaService._ejecutar (internal change)

No public interface change. Internally:
- Removes batch `UPDATE productos SET stock_actual = CASE ... END`
- Captures `ConsumoRecord[]` from `registrarSalida` and inserts `venta_lotes`

### Modified: JornadaService._recolectarDatosJornada (internal change)

No public interface change. `totalCosto` query changes from `detalle_ventas * productos.precio_costo` to `venta_lotes` with fallback.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (service) | `_consumirFIFO`: single lot covers full quantity | Mock DB, verify SELECT + UPDATE calls and returned records |
| Unit (service) | `_consumirFIFO`: spans multiple lots | Verify consumption order (oldest first), multiple UPDATE calls |
| Unit (service) | `_consumirFIFO`: insufficient stock throws error | Verify correct error message |
| Unit (service) | `registrarEntrada`: creates lot + movimiento | Verify INSERT into lotes_stock + INSERT into stock_movimientos |
| Unit (service) | `registrarSalida`: returns ConsumoRecord[] | Verify return value matches consumed lots |
| Unit (service) | `registrarAjuste`: replaces lots with weighted average | Verify DELETE + INSERT one lot with correct weighted avg cost |
| Unit (service) | `VentaService.registrar`: inserts venta_lotes | Mock registrarSalida to return fake records, verify venta_lotes INSERTs |
| Unit (service) | `JornadaService.totalCosto`: queries venta_lotes | Mock DB, verify new SQL query is called |
| Unit (service) | `JornadaService.totalCosto`: fallback for old sales | Mock empty venta_lotes, verify fallback query runs |
| Unit (service) | `ProductoService.crear`: creates initial lot | Verify registrarEntrada called when stock_actual > 0 |
| Integration | Migration v8: backfill creates correct lots | Run migration + seed, query lotes_stock, verify counts match |
| Integration | Sale flow: FIFO + venta_lotes atomicity | Perform full sale, verify lot quantities reduced, venta_lotes created |
| Unit (component) | InventarioPage: entry form with cost field | Verify form shows precio_costo input for entrada type |

## Implementation Order

### Phase 1: Foundation (no dependencies)
1. Create `src/app/models/lote-stock.ts` (LoteStock + ConsumoRecord)
2. Create `src/app/models/venta-lote.ts` (VentaLote)
3. Update `src/app/models/index.ts` (exports)
4. Add `_migrationV8()` to `sqlite.service.ts` (tables + backfill)

### Phase 2: StockMovimientoService (depends on Phase 1)
5. Add private `_consumirFIFO()` to StockMovimientoService
6. Modify `registrarEntrada` — add `precioCosto` param, create lot
7. Modify `registrarSalida` — consume FIFO, return ConsumoRecord[]
8. Modify `registrarAjuste` — replace lots with weighted average

### Phase 3: VentaService (depends on Phase 2)
9. Remove batch stock_actual UPDATE from `_ejecutar`
10. Capture ConsumoRecord[] from registrarSalida, INSERT venta_lotes

### Phase 4: ProductoService (depends on Phase 2)
11. Inject StockMovimientoService, create initial lot on `crear()`

### Phase 5: JornadaService (depends on Phase 3)
12. Change totalCosto query to venta_lotes with fallback

### Phase 6: InventarioPage UI (depends on Phase 2)
13. Add `movimientoCosto` signal + template input (entrada form)
14. Add lot display section (expandable per product)

### Phase 7: CuentaCosasService
15. No code change — benefits from FIFO automatically (already calls registrarSalida)

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Backfill cost = 0 for products with NULL precio_costo** | Medium | Low | Log warning during migration. 0-cost lots understate COGS, overstate profit — but it's the best available data. User can adjust via stock entry. |
| **Double stock_actual decrement** (existing bug) | High (currently happens) | Medium | FIFO design naturally fixes this: batch CASE/WHEN UPDATE is removed, registrarSalida now manages stock from lots. No double decrement. |
| **Old sales lack venta_lotes records** (pre-migration) | High | Medium | Fallback query in JornadaService calculates totalCosto from productos.precio_costo when venta_lotes is empty for a sale. Old reports unchanged; new reports accurate. |
| **registrarEntrada signature change breaks callers** | High | Low | Two callers: InventarioPage (add cost input) and ProductoService.crear (use precio_costo from payload). Both are in Phase 2/2a — compile errors catch them. |
| **registrarSalida return type change breaks callers** | Medium | Low | Three callers: VentaService (consumes new return value), CuentaCosasService (ignores return — compatible), InventarioPage manual salida (ignores return — compatible). TS allows ignoring return values. |
| **ProductoService circular dependency** | Low | Low | StockMovimientoService doesn't depend on ProductoService, so inject → calls → no cycle. |

## Project Standards (auto-resolved)
- Angular 21.2 standalone app with signals, no NgModules
- SQLocal (SQLite WASM) for local-first data persistence with manual migration system (v1-v8)
- Vitest 4.x for testing (strict TDD mode active)
- TypeScript 5.9 strict mode
- Bun as package manager

## Open Questions

- None resolved. All decisions have clear rationale mapped to existing codebase patterns.
