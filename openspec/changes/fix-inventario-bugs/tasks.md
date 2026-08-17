# Tasks: fix-inventario-bugs

> Change mínimo creado en apply (F5). El resto del plan (`docs/Fix-Inventario-Bugs.md`)
> se trabaja por hallazgo; F1-F4 ya resueltos/planificados fuera de este archivo.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~30 (2 tests + 1 UPDATE SQL) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single commit en rama f4-f7 |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: Low

## Tasks (strict TDD: RED test task precedes GREEN task)

| ID | Task | Deps | TDD | AC | Commit |
|----|------|------|-----|----|--------|
| F5-RED | **RED** `src/app/services/stock-movimiento.service.spec.ts` describe 'registrarAjuste': ajuste full con stock en ambas ubicaciones → UPDATE final setea `stock_almacen = ?` Y `stock_shop = 0` (columnas consistentes con lotes); triangulate con nuevaCantidad = 0 (sin INSERT de lote, mismo contrato). Why: probar el comportamiento esperado ANTES del fix | — | RED → 2 failed | 88 passed, 2 failed | en commit F5 |
| F5-GREEN | **GREEN** `src/app/services/stock-movimiento.service.ts` `registrarAjuste` (~393-403): UPDATE final pasa de `SET stock_almacen = ?` a `SET stock_almacen = ?, stock_shop = 0` (el DELETE full borra todos los lotes; el stock del producto pasa a vivir en un único lote 'almacen'). Why: el contrato del método es "el ajuste full redefine la cantidad total del producto en almacén" (sin parámetro ubicacion, promedio ponderado global, DELETE de todas las ubicaciones, lote nuevo hardcoded 'almacen') — opción A del plan F5 | F5-RED | GREEN | 90/90 spec, 867/867 suite | en commit F5 |
| F7-RED | **RED** `src/app/services/stock-movimiento.service.spec.ts`: registrarAjusteLote y registrarEditar registran el DELTA en el movimiento (`[1, -3, 'ajuste']`, `[1, -2, 'ajuste']`) + triangulación delta positivo + guard "El lote no existe"; `src/app/pages/inventario/inventario.page.spec.ts`: `elegirLoteInicialEdicion` (función pura exportada) + `onSelectAction('editar')` preselecciona el frente FIFO de la ubicación con más stock (mixto → almacen; stock principal en shop → shop). Why: F7 del plan — historial con absoluto y preselección del lote viejo de cualquier ubicación | — | RED → 19 failed (12 service + 7 page) | en commit F7 |
| F7-GREEN | **GREEN** `stock-movimiento.service.ts`: SELECT de `lotes_stock` al inicio de la txn en ambos métodos, throw si no existe, INSERT con `delta = nuevaCantidad - cantidadActual`; `inventario.page.ts`: función pura `elegirLoteInicialEdicion` (mayor stock, empate → almacen, fallback FIFO global) + wiring en `onSelectAction`. Why: opción A del plan F7 (filtrar por ubicación al preseleccionar); actualizaciones deliberadas de los 2 tests pre-existentes que fijaban el absoluto — son specs del cambio, no regresiones | F7-RED | GREEN | 94/94 spec service, 62/62 spec page, 886/886 suite | en commit F7 |

## Estado

- [x] F5-RED — 2 tests nuevos, 2 failed (RED confirmado)
- [x] F5-GREEN — 90/90 spec; suite completa 867/867 (46 files)
- [x] F7-RED — 19 tests (12 service + 7 page) failed (RED confirmado)
- [x] F7-GREEN — 94/94 spec service, 62/62 spec page; suite completa 886/886 (46 files)
