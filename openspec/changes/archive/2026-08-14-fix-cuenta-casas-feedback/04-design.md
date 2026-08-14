# Design: fix-cuenta-casas-feedback

## Technical Approach

Fix the multi-product `cuenta_cosas` collapse bug (one row for `items[0]` with summed quantity) by moving the writes into a transactional batch method `CuentaCosasService.registrarLote`, and surface the day's cuenta casas charges on the jornada page via a new `listarPorJornada` query. Mirrors existing house patterns: `VentaService._ejecutar` (raw BEGIN/COMMIT/ROLLBACK + `_validarStock` before BEGIN) and `VentaService._ejecutar`'s nested `registrarSalida` (re-entrant `transaction()` JOIN). Implements `cuenta-cosas` cap, `checkout` delta req 3, and `jornada-lifecycle` delta req 4 from the spec.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|--------------|-----------|
| D1 | `registrarLote` uses raw `sql('BEGIN TRANSACTION')` / `COMMIT` / `ROLLBACK` in try/catch, with `_validarStock` **before** BEGIN (proposal KD1) | `transaction()` adapter wrapper; per-item loop outside a txn | Matches `VentaService._ejecutar` exactly. Pre-validation before BEGIN means a stock failure never even opens a txn; `registrarSalida` nests via the re-entrant `transaction()` JOIN (proven: native-sqlite N3, T-09) |
| D2 | Validate against `stock_shop` (mirror `VentaService._validarStock`, throw `'Stock insuficiente'`) | Per-lot SUM query in `registrarLote` | `stock_shop` is the derived cache of shop-lot FIFO availability (recomputed by `registrarSalida`); `_consumirFIFO` re-validates authoritatively inside the txn. Same column, same error, single code path as ventas |
| D3 | `registrar()` delegates to `registrarLote` (`registrar(jId,pid,cant,desc,autorizado) → registrarLote(jId,[{productoId,cantidad}],desc,autorizado)`) | Keep `registrar` as-is, non-transactional | Spec allows delegation ("MAY"). Removes duplication and fixes the latent orphan-row bug on the single-item path (exploration risk 2). Spec keeps the method (checkout delta must not call it) |
| D4 | `listarPorJornada`: `ORDER BY created_at ASC, id ASC` | Bare `ORDER BY created_at ASC` | Spec mandates created_at ASC (primary sort). `id ASC` makes same-timestamp rows (a batch shares one `ahora`) deterministic — spec-compliant |
| D5 | Jornada page fetches via injected `CuentaCosasService.listarPorJornada` | Direct `this._db.sql` (exploration option) | Spec: "MUST be fetched via `listarPorJornada`". Works in existing page specs with zero new providers: `CuentaCosasService` is root-provided and its `DATABASE` resolves to the mock |
| D6 | Empty-cart guard scoped to the `cuenta_cosas` branch (`if (items.length === 0) return;`) | Global guard at top of `confirmarVenta` | Spec requires early return on the cuenta_cosas path; keeps the `VentaService` branch untouched (out of scope) |

## Data Flow

```
pos.page.ts confirmarVenta(payload)        jornada.page.ts _cargarDatosDiarios()
  │  formaPago='cuenta_cosas'                 │  effect() on jornadaAbierta()
  │  items.length===0 → return                │  Promise.all([1 ventas, 2 movimientos,
  │  registrarLote(jId,                       │    3 mermas, 4 productos,
  │    items.map(i=>({productoId,cantidad})), │    5 listarPorJornada(j.id)])
  │    payload.descripcion, payload.autorizadoPor)         │
  │        │                                     cuentasCosasDelDia.set(cuentas)
  ▼        ▼
CuentaCosasService.registrarLote
  _validarStock(items)            // SELECT stock_shop … throw 'Stock insuficiente'
  BEGIN TRANSACTION
  for each item: INSERT cuenta_cosas (own cantidad)
                 → StockMovimientoService.registrarSalida → _db.transaction() JOIN
  COMMIT  (catch → ROLLBACK; rethrow)
```

Jornada template: 4th `@if` block renders `cuentasCosasDelDia()` rows with `productosMap().get(c.producto_id)` for Producto; card container condition on html line 19 adds `cuentasCosasDelDia().length > 0`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/cuenta-cosa.service.ts` | Modify | + `CuentaCosaItem` interface, `registrarLote`, `_validarStock`, `listarPorJornada`; `registrar` delegates |
| `src/app/pages/pos/pos.page.ts` | Modify | `confirmarVenta` cuenta_cosas branch → empty guard + `registrarLote` per-product |
| `src/app/pages/jornada/jornada.page.ts` | Modify | Inject `CuentaCosasService`; `cuentasCosasDelDia` signal; 5th query in Promise.all; resets in `!j` + catch |
| `src/app/pages/jornada/jornada.page.html` | Modify | line-19 condition + Mermas `border-b` + 4th "Cuenta Casas del día" block |
| `src/app/pages/pos/pos.page.spec.ts` | Modify | Mock + rewrite 2.11 (multi-product, single-product, empty-cart, metadata) |
| `src/app/services/cuenta-cosa.service.spec.ts` | Modify | Update `registrar` tests (delegation); add `registrarLote` + `listarPorJornada` suites |
| `src/app/pages/jornada/jornada.page.spec.ts` | Modify | New "cuenta casas del día" describe block |

No schema/migration changes. `excel.service.ts`, `venta.service`, `stock-movimiento.service`, models, routes untouched.

## Interfaces / Contracts

```ts
// cuenta-cosa.service.ts
export interface CuentaCosaItem { productoId: number; cantidad: number }

async registrarLote(jornadaId: number, items: CuentaCosaItem[],
  descripcion: string | null, autorizadoPor: string): Promise<void>
//  - items.length === 0 → resolve immediately (no DB calls)
//  - _validarStock for ALL items before BEGIN
//  - per item: INSERT cuenta_cosas + registrarSalida (interleaved)
//  - COMMIT; catch → ROLLBACK; rethrow

async registrar(jornadaId: number, productoId: number, cantidad: number,
  descripcion: string | null, autorizadoPor: string): Promise<void>
//  → return this.registrarLote(jornadaId, [{ productoId, cantidad }], descripcion, autorizadoPor)

private async _validarStock(items: CuentaCosaItem[]): Promise<void>
//  SELECT stock_shop FROM productos WHERE id = ? ; throw new Error('Stock insuficiente') if cantidad > stockActual

async listarPorJornada(jornadaId: number): Promise<CuentaCosa[]>
//  SELECT * FROM cuenta_cosas WHERE jornada_id = ? ORDER BY created_at ASC, id ASC
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `registrarLote` (cuenta-cosa.service.spec.ts) | Mock DB + mocked `StockMovimientoService`. Success: assert 2 INSERTs + `registrarSalida(1,2)/(2,3)` + no `UPDATE jornadas`. Pre-validation failure: reject `'Stock insuficiente'`, no BEGIN/INSERT/salida. Single insufficient: same. Empty array: resolves, zero sql calls. Mid-txn `registrarSalida` rejection: `ROLLBACK` called, no `COMMIT`, rethrow |
| Unit | `registrar` (update) | Delegation changes call sequence: now `SELECT stock_shop` → `BEGIN` → `INSERT` → `COMMIT`. **Required**: mock `stock_shop` high (`mockResolvedValueOnce([{ stock_shop: 100 }])`), else validation throws. Keep "no UPDATE jornadas" assertion |
| Unit | `listarPorJornada` | Assert SQL contains `FROM cuenta_cosas`, `ORDER BY created_at`, params `[jornadaId]`; returns rows as given; empty → `[]` |
| Unit | `confirmarVenta` (pos.page.spec.ts 2.11) | Add `registrarLote: vi.fn()` to mock; add `productoB` (id:2). Multi-product cart A×2+B×3 → called with `(1, [{productoId:1,cantidad:2},{productoId:2,cantidad:3}], 'Retiro familiar', 'María')`; `registrar` + `ventaService.registrar` NOT called. Single product → batch of 1. Empty cart → no service call |
| Unit | Jornada page (jornada.page.spec.ts) | **Query order (exact)**: 1 ventas, 2 movimientos, 3 mermas, 4 productos, 5 cuenta_cosas (via `listarPorJornada`), 6 conditional `detalle_ventas` (only when ventas non-empty). New block tests keep ventas empty to skip query 6. `createMockDb` default `[]` keeps all existing tests safe (no `mockResolvedValueOnce` chains exist; 5th query returns `[]` → block hidden). No new providers: root `CuentaCosasService` uses mock `DATABASE`/`AuthService`. Tests: rows → block + 5 columns + producto name via `productosMap`; no rows → hidden; `!j` and catch → `cuentasCosasDelDia()` empty |

**Strict TDD order (RED → GREEN)**: (1) write failing spec updates (service first), `bunx vitest run` the two service/page specs → fail (methods missing, block missing); (2) implement `cuenta-cosa.service.ts` + `pos.page.ts` → service + pos specs green; (3) implement `jornada.page.ts`/`.html` → jornada spec green; (4) full `bun run test` + `bun run lint`.

## Migration / Rollout

No migration required. Old broken rows are untouched by design (non-goal). Revert = pure code reversion (restore single `registrar()` call, drop new methods/signal/block).

## Review Budget Forecast

`Decision needed before apply: No` · `Chained PRs recommended: No` · `400-line budget risk: Low` (est. ~300 add / ~80 del across the 7 files).

## Open Questions

None — all decisions resolved against the spec.
