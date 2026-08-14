# Exploration: fix-cuenta-casas-feedback

> READ-ONLY exploration (2026-08-14) on branch `fix-cuenta-casas+feedback` (base main).
> Change: fix multi-product `cuenta_cosas` bug + jornada page "cuenta casas del día" visual feedback.

## Validated root cause

- `src/app/pages/pos/pos.page.ts` `confirmarVenta()` lines 231-243: for `formaPago='cuenta_cosas'` it uses `items[0]?.producto.id` + `items.reduce((sum, item) => sum + item.cantidad, 0)` → ONE call to `CuentaCosasService.registrar`. A multi-product cart (A×2, B×3) inserts one row `(producto_id=A, cantidad=5)` and stock salida of 5 from A only; B is never recorded.
- `CartItem { producto, cantidad, subtotal }`; cart merges by `producto.id` (one entry per product); `item.cantidad` IS the per-product quantity (`cart.service.ts` lines 4-8, 24-53).
- `cuenta-cosa.service.ts` `registrar()` (lines 12-28): `INSERT INTO cuenta_cosas (jornada_id, producto_id, cantidad, descripcion, autorizado_por, created_at)` then `_stockMovimiento.registrarSalida(productoId, cantidad)`. NOT transactional: if stock is insufficient the `cuenta_cosas` row persists while the UI shows an error. No stock pre-validation (the normal flow uses `VentaService._validarStock`).
- Excel impact: `excel.service.ts` renders one row per `CuentaCosa` and totals `cantidad * precio_costo` → after the fix the Excel becomes correct WITHOUT any code change; existing specs already use multi-product fixtures.
- `pos.page.spec.ts` tests 2.11 (lines 238-275) codify the buggy single-call behavior → must be rewritten.

## Feature: jornada page "ventas del día" feedback

- `jornada.page.ts`: direct `DATABASE` injection (line 23); signals `ventasDelDia`/`movimientosDelDia`/`mermasDelDia`/`dailyLoading`/`productosMap`/`detallesPorVenta` (lines 28-33); `effect()` on `jornadaAbierta()` → `_cargarDatosDiarios()` (lines 61-131) with a `Promise.all` of 4 queries plus a `detalle_ventas` query when ventas exist.
- Template `jornada.page.html` lines 19-145: one card, `@if` on line 19, sections "Ventas del día" (22-67), "Movimientos financieros" (70-110), "Mermas" (113-143) using `productosMap()` for names. `dailyLoading` is never referenced in the template; the `catch` silently empties the lists.
- NO existing date/jornada list method for `cuenta_cosas` in any service. Only queries: `jornada.service.ts` lines 481-484 (`_ejecutarCierre`) and 715-719 (`_recolectarDatosJornada`) — `SELECT * FROM cuenta_cosas WHERE jornada_id = ?`. The page "del día" concept is jornada-scoped.
- `CuentaCosa` model: `id, jornada_id, producto_id, cantidad, descripcion|null, autorizado_por, created_at` (ISO string). Schema migrationV6 `db-migrations.ts` lines 330-338: `cantidad REAL` (fractional allowed), no index beyond PK.

## Fit pattern

- Add `cuentasCosasDelDia = signal<CuentaCosa[]>([])` next to the daily signals; query inside the `Promise.all` of `_cargarDatosDiarios` (direct `_db.sql` `SELECT * FROM cuenta_cosas WHERE jornada_id = ?` or a new `CuentaCosasService.listarPorJornada`); reset in the `!j` branch and the catch.
- Render a 4th `@if` table block in the card using `productosMap()` (Producto ×Cantidad, Descripción, Autorizado por, Hora `created_at | date:'short'`); add `CuentaCosa` to the count condition on line 19.

## File inventory

| # | File | Action |
|---|------|--------|
| a | `src/app/pages/pos/pos.page.ts` | Fix: iterate items per product (or batch method) for `cuenta_cosas` |
| b | `src/app/pages/pos/pos.page.spec.ts` | Rewrite 2.11 tests for per-item calls |
| c | `src/app/services/cuenta-cosa.service.ts` + `.spec.ts` | Add `listarPorJornada` |
| d | `src/app/pages/jornada/jornada.page.ts` / `.html` / `.spec.ts` | Signal + query + table + tests |
| e | `src/app/services/excel.service.ts` | NO code change required |

NOT affected: `models/cuenta-cosa`, `db-migrations`, `venta.service`, `stock-movimiento.service`, `checkout-modal`, `cart.service`, `app.routes`.

## Risks

1. Partial failure on a multi-item loop: `registrar()` is non-transactional → orphan rows if item 2 fails. Prefer a batch method with `BEGIN/COMMIT` or validate all stock first (mirror `VentaService._validarStock`).
2. Pre-existing non-transactional INSERT + salida within a single item.
3. Same `descripcion` on every per-product row (payload is per-sale).
4. Empty cart guard is cheap insurance (`items.length === 0` return).
5. Excel totals stay identical after the fix (only row attribution changes).
6. `jornada.page.spec.ts` `mockResolvedValueOnce` query order must account for the new 5th query.
