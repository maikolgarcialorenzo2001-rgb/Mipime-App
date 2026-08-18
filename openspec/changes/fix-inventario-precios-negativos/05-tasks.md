# Tasks: fix-inventario-precios-negativos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520 across 6 files (516 additions, 2 deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (fix-inventario-bugs), work-unit commits |
| Delivery strategy | ask-on-risk (resuelto: single PR en rama fix-inventario-bugs) |
| Chain strategy | n/a — rama de bugfix ya existente, PR único |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: High

> Nota: el riesgo de budget es High solo por volumen de TESTS (+438 líneas de
> spec, 24 tests). El código productivo son +67/-2. PR único en la rama de
> bugfix, commits por unidad de trabajo (4).

## Tasks (strict TDD: RED test task precedes GREEN task)

| ID | Task | Deps | TDD | AC | Commit |
|----|------|------|-----|----|--------|
| T1 | **RED** `src/app/services/stock-movimiento.service.spec.ts`: describe 'guards de precio/costo no negativo (F4 / S-05 espejo)' — registrarEntrada con precioCosto -5 y NaN → rejects 'El costo no puede ser negativo' + `sql` no llamado; happy path costo 0 → persiste lote con 0. registrarEditar con precioVenta/precioCosto -5 y NaN → rejects mensajes espejo + `sql` no llamado; happy path 0/0 → UPDATE productos con 0. Why: probar el comportamiento nuevo ANTES del guard | — | RED → 6 failed | New tests fail | `1f8979e` test(stock): guards de precio/costo no negativo en entrada y edicion (RED) |
| T2 | **GREEN** `src/app/services/stock-movimiento.service.ts`: helpers `_validarPrecioVenta`/`_validarPrecioCosto` (`!(v >= 0)` NaN-safe, null pasa) junto a `_validarCantidad*`; `registrarEntrada` llama `_validarPrecioCosto(precioCosto)` tras `_validarCantidadDelta`; `registrarEditar` llama ambos tras `_validarCantidadAbsoluta`. Why: guardas de servicio ANTES de DB, tras `_checkAdmin` | T1 | GREEN | T1 green | `4f5147c` fix(stock): validar precio/costo no negativo en registrarEntrada y registrarEditar |
| T3 | **RED+GREEN** `producto.service.spec.ts` + `producto.service.ts`: `crear` y `actualizar` rechazan precio_costo/precio_venta < 0 o NaN vía `throwError` ANTES del INSERT/UPDATE (mensajes espejo); happy path 0/0 persiste. Why: defensa en capa producto | T2 | RED → 6 failed / GREEN | 22/22 | `73ac396` fix(producto): validar precios no negativos en crear y actualizar |
| T4 | **RED+GREEN** `inventario.page.spec.ts` + `inventario.page.ts`: `guardarProducto` (formError + return antes de crear, costo y pv), case 'editar' (error + return antes de registrarEditar, pv y pc), case 'entrada' (error + return antes de registrarEntrada, costo < 0; vacío → 0). Happy paths con 0 en los 3. Why: feedback temprano en UI | T3 | RED → 5 failed / GREEN | 55/55 | `bfcd3cb` fix(inventario): bloquear precios/costos negativos en UI (modal, edicion, entrada) |
| T5 | **Verify**: suite completa `npx vitest run` verde (865 tests, 46 files); specs tocadas 165/165. Why: gate de regresión | T2,T3,T4 | — | All green | n/a (verify gate) |

## Estado

- [x] T1 — RED stock (commit `1f8979e`)
- [x] T2 — GREEN stock (commit `4f5147c`)
- [x] T3 — producto (commit `73ac396`)
- [x] T4 — UI inventario (commit `bfcd3cb`)
- [x] T5 — verify gate (865/865 verde)
