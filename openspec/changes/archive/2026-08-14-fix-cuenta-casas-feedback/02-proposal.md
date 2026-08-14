# Proposal: fix-cuenta-casas-feedback

## Intent

Batch sales (multi-product cart) paid via `cuenta_cosas` collapse into the first product: `pos.page.ts confirmarVenta()` records ONE `cuenta_cosas` row for `items[0]` with the summed quantity and discounts stock from that product only. Any other product is neither registered nor stock-discounted, corrupting inventory and the Excel "Cuenta Cosas" sheet (silently wrong `cantidad` attribution). Separately, operators get no on-screen feedback for these charges on the jornada page.

Desired outcome: every cart product produces its own `cuenta_cosas` row + stock salida, all-or-nothing; and the jornada "ventas del día" card shows the day's cuenta casas charges (product, quantity, description, authorized-by, time).

## Scope

### In Scope
- Fix `pos.page.ts confirmarVenta()` (lines 231-243): `cuenta_cosas` path processes every cart item per-product.
- Add transactional batch method `CuentaCosasService.registrarLote(jornadaId, items[])` (BEGIN/COMMIT/ROLLBACK + stock validation for all items before insert).
- Add `CuentaCosasService.listarPorJornada(jornadaId): Promise<CuentaCosa[]>`.
- Jornada page: 4th feedback block in the jornada card under "ventas del día", rendered only when non-empty, via `productosMap()`.
- Rewrite `pos.page.spec.ts` 2.11 (lines 238-275); extend `cuenta-cosa.service.spec.ts`; extend `jornada.page.spec.ts`.

### Out of Scope (Non-Goals)
- No migration/repair of already-broken `cuenta_cosas` rows.
- No per-product descriptions: `payload.descripcion` is per-sale and applies to every row of that sale.
- No changes to `excel.service.ts` — after the fix it renders correctly (one row per `CuentaCosa`; totals unchanged).
- No schema changes or migrations (`cuenta_cosas` table untouched; `cantidad REAL` stays fractional-capable).
- No changes to `venta.service`, `stock-movimiento.service`, `cart.service`, `checkout-modal`, `models/cuenta-cosa`, `app.routes`.

## Business Rules

- One `cuenta_cosas` row per cart product, carrying that product's own `cantidad`; one stock salida per product with that product's own `cantidad`.
- `descripcion` / `autorizado_por` come from the single checkout payload and apply to every row of the sale.
- All-or-nothing: if any item fails (e.g. insufficient stock), NOTHING is persisted — no orphan rows — and the existing error path surfaces the message.
- `cuenta_cosas` continues to NOT affect cash register totals (jornada-lifecycle rule unchanged).
- The jornada feedback block renders only when the jornada has ≥1 `cuenta_cosas` row.

## Key Decisions (design/tasks must respect)

1. **Batch transactional method — chosen over per-item loop and over "validate stock first only".** `registrarLote()` wraps stock validation + all inserts + all salidas in one BEGIN/COMMIT/ROLLBACK. Justification: atomicity prevents orphan rows on partial failure (exploration risk 1); pre-validation mirrors `VentaService._validarStock`; single error surface for the UI; consistent with existing transactional patterns (`jornada.service _registrarMovimientoAsync`, `venta.service _ejecutar`).
2. `registrar()` single-item method: keep behavior unchanged; design may refactor it to delegate to `registrarLote`. Only consumer today is `pos.page.ts` + its specs.
3. `listarPorJornada` orders by `created_at` ASC so the Hora column reads chronologically.
4. Jornada page queries cuenta casas inside `_cargarDatosDiarios()`'s `Promise.all` as a 5th query via `listarPorJornada`; reset in the `!j` branch and the catch; `jornada.page.spec.ts` `mockResolvedValueOnce` order must account for it.
5. Feedback block columns: Producto (via `productosMap()`), Cantidad, Descripción, Autorizado por, Hora (`created_at | date:'short'`). Empty cart guard in `confirmarVenta` (`items.length === 0` return) is cheap insurance.

## Approach

Fix `pos.page.ts` to call `registrarLote(jId, items.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })))` with `descripcion`/`autorizadoPor` from the payload. `CuentaCosasService` gains the batch method (transaction + stock validation + per-item INSERT + salida) and `listarPorJornada`. Jornada page adds a `cuentasCosasDelDia` signal, a 5th query in `_cargarDatosDiarios`, and a 4th `@if` table block; line-19 card condition gains the new signal.

## Capabilities

> Contract with sdd-spec. Main specs inspected: `checkout`, `jornada-lifecycle`, `excel-reportes` (no `cuenta-cosas` capability exists today).

### New Capabilities
- `cuenta-cosas`: per-product, transactional batch registration (`registrarLote`) with all-or-nothing semantics, plus `listarPorJornada(jornadaId)` query.

### Modified Capabilities
- `checkout`: requirement for `confirmarVenta` `cuenta_cosas` path — per-product rows instead of collapse-to-first-product.
- `jornada-lifecycle`: new requirement — "ventas del día" card shows cuenta casas del día feedback (Producto, Cantidad, Descripción, Autorizado por, Hora) when non-empty.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/pages/pos/pos.page.ts` | Modified | `confirmarVenta()` calls `registrarLote` per-product |
| `src/app/services/cuenta-cosa.service.ts` | Modified | + `registrarLote`, + `listarPorJornada` |
| `src/app/pages/jornada/jornada.page.ts` / `.html` | Modified | `cuentasCosasDelDia` signal, 5th query, 4th block |
| `src/app/pages/pos/pos.page.spec.ts` | Modified | Rewrite 2.11 tests |
| `src/app/services/cuenta-cosa.service.spec.ts` | Modified | Batch + list tests |
| `src/app/pages/jornada/jornada.page.spec.ts` | Modified | New signal + query order |
| `src/app/services/excel.service.ts` | Unchanged | Correct after fix (no code change) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-transactional write leaves orphan rows on partial failure | Med (pre-existing in `registrar`) | `registrarLote` wraps everything in BEGIN/COMMIT/ROLLBACK |
| Mock query-order drift breaks `jornada.page.spec.ts` | Med | Key Decision 4: update `mockResolvedValueOnce` sequence with the 5th query |
| Same `descripcion` on all rows confuses operators | Low | Accepted by design; non-goal, noted in UI-adjacent docs |
| Excel totals change after fix | Low | Totals unchanged (only row attribution); verify with existing fixtures |

## Rollback Plan

Revert the fix by restoring `pos.page.ts` `confirmarVenta` to the single `registrar()` call and dropping `registrarLote`/`listarPorJornada` plus the jornada block/signal. No schema or migration involved; old broken rows are untouched by design, so revert is a pure code reversion with no data repair. Tests reverted alongside.

## Dependencies

- SQLocal `DATABASE` transaction support (BEGIN/COMMIT/ROLLBACK) — pattern already proven in `jornada.service` / `venta.service`.
- Branch `fix-cuenta-casas+feedback` (base `main`), change name `fix-cuenta-casas-feedback`.

## Success Criteria

- [ ] Multi-product `cuenta_cosas` sale inserts one row + one stock salida per product, each with its own cantidad (no collapsed first-product row).
- [ ] Partial failure (e.g. item 2 insufficient stock) persists nothing — no orphan rows; error shown to user.
- [ ] Jornada page shows the day's cuenta casas charges (Producto, Cantidad, Descripción, Autorizado por, Hora) only when non-empty.
- [ ] All spec files green: rewritten 2.11 `pos.page.spec.ts`, extended `cuenta-cosa.service.spec.ts` and `jornada.page.spec.ts`.
- [ ] Excel "Cuenta Cosas" totals unchanged after the fix (existing multi-product fixtures still pass).
