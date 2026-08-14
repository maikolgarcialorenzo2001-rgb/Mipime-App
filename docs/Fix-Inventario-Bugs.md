# Fix Inventario Bugs

> Plan de corrección de bugs del flujo de inventario — Mipime-App.
> Fecha: 2026-08-14. Estado: F1 ✅ F2 ✅ F3 ✅ — F4–F7 ✅ mergeados (externo) — F8 ✅ F9 ✅ (nosotros, branch `fix-f8-f9`). Pendiente: merge `fix-f8-f9` → `fix-inventario-bugs` → `main`.

## Coordinación de trabajo en paralelo (2026-08-14)

División acordada: **externo (pana) resuelve F4–F7**; **nosotros resolvemos F8–F9**. Para que el laburo fluya sin conflictos:

- **Branches separadas**: pana trabaja en `fix-f4-f7` (desde `fix-inventario-bugs`), nosotros en `fix-f8-f9`. NO commitear directo a `fix-inventario-bugs` en paralelo; mergear secuencial.
- **Orden de merge: F7 PRIMERO, después F8.** F8 (permitir editar sin lote activo) depende de la semántica del selector de lote que defina F7 (filtro por ubicación). Si F7 mergea primero, F8 se rebasea limpio.
- **Zonas compartidas de máximo riesgo** (evitar pisarse):
  - `stock-movimiento.service.ts`: F4 (`registrarEntrada`/`registrarEditar`), F5 (`registrarAjuste` :356-378), F7 (sync sin filtro de ubicación), F8 (`obtenerLotesPorProducto` :687-696 + posible `registrarEditar`).
  - `inventario.page.ts`: F4 (case editar :218-227, guardarProducto :406-447), F7 (`onSelectAction` :340-354), F8 (case editar :193-200). **F7 y F8 tocan el mismo bloque de edición**.
  - `.spec.ts`: todos agregan tests en los mismos describe blocks — mayor punto de colisión.
- **DECISIÓN PENDIENTE (coordinar con pana)**: dónde se materializa el "lote 0" de F8 cuando el producto no tiene lote activo. Recomendación: **en el service `registrarEditar`, atómico dentro de la transacción** (UPDATE→INSERT si no existe lote), para no pisar el selector de F7 ni la validación de signo de F4.
- **F9 es independiente** (HTML diálogo de borrado :563-591 + `ejecutarEliminar`) — cero choque con F4–F7; no espera a nadie.
- **Sistema de branches (flujo de merge)**: pana pushea a `fix-f4-f7`; nosotros creamos `fix-f8-f9` desde `fix-inventario-bugs` y pusheamos ahí. **NOSOTROS somos los encargados de mergear una a una** en este orden:
  1. `fix-f4-f7` → `fix-inventario-bugs` (esperar a que pana termine F4–F7; resolver conflictos acá).
  2. `fix-inventario-bugs` → `fix-f8-f9` (rebase/merge para que F8 se apoye en F7).
  3. Al final del plan: `fix-f8-f9` → `fix-inventario-bugs` → `main` (con el merge del SDD previo ya presente en main).
  Cada merge se revisa con la suite completa (`bunx vitest run`) + lint de archivos tocados.

## Contexto

- **Bug reportado por el usuario**: "al editar un producto las cantidades no se registraban y pintaba información incorrecta".
- **Fixes aplicados ayer**: `855a838` (validación visible + toast en edición), `6c26562` (guards de cantidad + pre-validación FIFO), y `d683a41` / `7a730f3` (atomicidad de escrituras de stock).
- **Doble check realizado**: el bug central está arreglado con tests (novalidate, validación visible, cero silencioso eliminado, pre-validación FIFO, toasts, transacciones re-entrantes). Quedan restos del síntoma original en F7.
- **Diagnóstico previo**: `docs/investigacion-edicion-producto.md` (root causes A–F).

## Resumen de hallazgos

| # | Prioridad | Área | Descripción corta |
|---|-----------|------|-------------------|
| F1 | P1 | producto.service.ts | ~~Eliminar producto NO atómico (4 DELETE sin transacción) + FKs solo en Electron~~ ✅ RESUELTO (`dea2405`) |
| F2 | P1 | electron/db.ts | ~~`MAX_SCHEMA_VERSION = 16` con schema ya en v17~~ ✅ RESUELTO (`4f64930`) |
| F3 | P2 | stock-movimiento.service.ts | ~~Editar costo de lote no-frontal no actualiza `productos.precio_costo` (pinta valor viejo)~~ ✅ RESUELTO — feedback FIFO claro (`21251f7`) |
| F4 | P2 | inventario.page.ts / stock-movimiento.service.ts | Precios/costos negativos aceptados — ⏳ EN PROGRESO (externo, branch `fix-f4-f7`) |
| F5 | P2 | stock-movimiento.service.ts | `registrarAjuste` (full) destruye lotes shop sin recalcular `stock_shop` — ⏳ EN PROGRESO (externo, branch `fix-f4-f7`) |
| F6 | P3 | producto.service.ts | `crear` no atómico + CRUD sin guard admin en el servicio — ⏳ EN PROGRESO (externo, branch `fix-f4-f7`) |
| F7 | P3 | inventario.page.ts | Edición por lote mixto preselecciona lote viejo de cualquier ubicación — ⏳ EN PROGRESO (externo, branch `fix-f4-f7`) |
| F8 | P3 | inventario.page.ts | Producto con stock > 0 pero sin lotes activos no se puede editar — 🔧 NUESTRO (branch `fix-f8-f9`) |
| F9 | P3 | inventario.page.html | Confirmación de borrado no informa el alcance de la pérdida — ⏳ NUESTRO (branch `fix-f8-f9`, independiente) |

## Detalle por hallazgo

### F1 — P1 · Eliminación de producto NO atómica + FK divergente entre plataformas

- **Dónde**: `src/app/services/producto.service.ts:116-125` (`eliminar`), invocado desde `ejecutarEliminar()` en `src/app/pages/inventario/inventario.page.ts:457-473`.
- **Evidencia**: 4 DELETE en autocommit sin `transaction()`.
  - **Electron**: `foreign_keys = ON` (`electron/db.ts:106`) → si el producto tiene `detalle_ventas`/`cuenta_cosas`, el 4º DELETE (productos) falla **después** de persistir los 3 primeros → producto vivo pero sin historial de movimientos ni lotes (pérdida silenciosa con error en pantalla).
  - **Web (SQLocal)**: se abre la DB sin `PRAGMA foreign_keys` → el borrado pasa y quedan **huérfanos** en `detalle_ventas`/`cuenta_cosas` → historial degrada a "Producto #id" (`jornada.service.ts:105`, `historial.page.ts:103-106`) y se pierde el rastro FIFO (`venta_lotes`) de ventas pasadas.
- **Impacto**: ALTO (pérdida de datos / reportes rotos).
- **Sugerencia**: envolver en `transaction()` y decidir soft-delete o bloqueo si hay referencias.

### F2 — P1 · `MAX_SCHEMA_VERSION = 16` con schema ya en v17

- **Dónde**: `electron/db.ts:22` (const), `db-migrations.ts:559-582` (migración v17), `main.spec.ts:546` (ya espera 17).
- **Evidencia**: `isAcceptable()` (`electron/db.ts:134-138`) rechaza todo candidato con `schemaVersion > 16`.
  - Si la DB viva se corrompe, la cascada `recoverInPlace → tryRestore → tryRestoreFromTimestamped` descarta backups v17 válidos → `status: 'fatal'` con backups buenos disponibles.
  - El import one-shot OPFS→native (`electron/db.ts:503-544`, `main.ts:343`) rechaza una DB web migrada a v17 → `NativeSqliteService._runImportRoundtrip` → `setFatal('import')` → primer arranque nativo con datos v17 = pantalla fatal.
- **Nota**: el commit `e8052cf` (2026-08-13) actualizó **solo la expectativa del test** `main.spec.ts` (16→17) para que el test pasara, pero **no** la constante `MAX_SCHEMA_VERSION`. Test verde ≠ código arreglado.
- **Impacto**: ALTO (bloquea migración/restauración del schema actual).
- **Sugerencia**: subir `MAX_SCHEMA_VERSION` a 17 en `electron/db.ts:22` y actualizar `db.spec.ts:93`.

### F3 — P2 · Editar costo de lote no-frontal no actualiza `productos.precio_costo` — ✅ RESUELTO (2026-08-14)

- **Dónde**: `stock-movimiento.service.ts` (`registrarEditar` 511-600, `_syncPrecioCosto` 182-208) + `inventario.page.ts` (toast post-edición).
- **Evidencia**: producto con 2 lotes (almacén viejo 10u + shop nuevo 5u); editar el lote shop y bajar su costo → `_syncPrecioCosto` selecciona el front (lote almacén) → `productos.precio_costo` no cambia → la tabla sigue pintando el costo viejo → sensación de "no se guardó". La spec solo cubría el caso front (`stock-movimiento.service.spec.ts:876`).
- **Decisión de producto (usuario, vía question tool)**: **mantener semántica FIFO** (el cache sigue siendo el costo del lote más viejo con stock — coherente con COGS) **+ feedback claro** en el toast en vez de cambiar la semántica global del cache.
- **Fix**: `_syncPrecioCosto` retorna el front (`{ id, precio_costo } | null`); `registrarEditar` retorna `EdicionResultado` (`esFront`, `costoProducto`, `costoEditado`). El toast ahora comunica: si el lote editado es el front → `Precio costo: $X`; si no → `Costo del lote: $Y — Precio costo del producto sin cambios: $Z (lote más viejo con stock)`.
- **Tests**: service spec F3 (2 nuevos, 82/82) + página spec 36b/36c (49/49). Suite completa: 848/848.

### F4 — P2 · Precios/costos negativos aceptados — ⏳ EN PROGRESO (externo, branch `fix-f4-f7`)

- **Estado**: a cargo de externo (2026-08-14). **No duplicar**. Ver sección "Coordinación de trabajo en paralelo".
- **Dónde**: `inventario.page.ts:406-447` (`guardarProducto`: solo `=== null`), `:218-227` (editar), `stock-movimiento.service.ts:205-252` (`registrarEntrada` valida cantidad, no `precioCosto`). Los `min="0"` del HTML no aplican: form con `novalidate` y modal sin `<form>`.
- **Evidencia**: entrada con costo −5 → lote con `precio_costo = -5` → `obtenerInversionGlobal` (`producto.service.ts:90-101`) suma `cantidad * precio_costo` → inversión negativa; COGS contaminado.
- **Impacto**: MEDIO (integridad de costos).
- **Sugerencia**: validar signo de precios/costos en UI y servicio (>= 0).

### F5 — P2 · `registrarAjuste` (full) destruye lotes shop sin recalcular `stock_shop`

- **Dónde**: `stock-movimiento.service.ts:356-378`.
- **Evidencia**: `DELETE FROM lotes_stock WHERE producto_id = ?` borra TODAS las ubicaciones; luego inserta UN lote 'almacen' y hace `SET stock_almacen = nuevaCantidad` sin tocar `stock_shop` → si el producto tenía stock en shop, los lotes shop desaparecen y `stock_shop` queda con valor viejo (divergencia lote↔columna). Hoy **sin caller de producción** (solo specs `stock-movimiento.service.spec.ts:575-623`), pero es API pública.
- **Impacto**: MEDIO (latente; un futuro caller la arma).
- **Sugerencia**: redefinir el ajuste full por ubicación o recalcular `stock_shop` consistentemente.

### F6 — P3 · `crear` no atómico + CRUD sin guard admin en el servicio

- **Dónde**: `producto.service.ts:44-73` (INSERT autocommit → `registrarEntrada` en txn aparte) y servicio sin `_checkAdmin` (contraste con `stock-movimiento.service.ts:24-29`).
- **Evidencia**: si `registrarEntrada` falla, el producto ya quedó insertado → producto fantasma con error en pantalla. Y un trabajador podría crear/eliminar vía servicio saltándose la UI (los guards `esAdmin` son solo de template).
- **Impacto**: BAJO-MEDIO.
- **Sugerencia**: envolver `crear` en transacción y agregar guard de rol en el servicio.

### F7 — P3 · Semántica de edición por lote mixto persiste — ✅ MERGEADO (externo, branch `fix-f4-f7`)

- **Estado**: ✅ resuelto por externo y mergeado a `fix-inventario-bugs` (commit `a3dc87d`, 2026-08-14). F8 se apoyó en su semántica del selector.

- **Dónde**: `inventario.page.ts:340-354` (preselecciona `lotes[0]`, el más viejo de CUALQUIER ubicación) + `stock-movimiento.service.ts:659-668` (sin filtro de ubicación).
- **Evidencia**: producto con stock en ambas ubicaciones → editar el lote viejo (quizá almacén) → cambia solo esa columna; la otra queda igual (correcto en DB, confuso en pantalla). El historial además registra el absoluto como "Ajuste N" (`stock-movimiento.service.ts:534-537`), un cambio 10→3 figura como "Ajuste 3u".
- **Impacto**: BAJO (mitigado por label "Cantidad nueva del lote" + toast, pero no resuelto).
- **Sugerencia**: filtrar por ubicación en el selector o marcar explícitamente la ubicación del lote seleccionado.

### F8 — P3 · Producto con stock > 0 pero sin lotes activos no se puede editar — ✅ NUESTRO (branch `fix-f8-f9`, commit `5fd389d`)

- **Estado**: ✅ RESUELTO (2026-08-14). `registrarEditar` acepta `loteId: number | null`; con `null` materializa el "lote 0" atómicamente dentro de la transacción (reutiliza el lote en 0 más antiguo o INSERT con cantidad 0 + `RETURNING *`), delta = nuevaCantidad - 0. La UI prellena el form con datos del producto y la ubicación sigue la semántica F7 (la de más stock, empate → almacén).
- **Acuerdo recomendado**: implementado — el "lote 0" se materializa en el service `registrarEditar`, atómico dentro de la transacción, sin tocar el selector de F7 ni la validación de F4.

- **Dónde**: `inventario.page.ts:197-200` ('Debe seleccionar un lote') + filtro `cantidad > 0` (`stock-movimiento.service.ts:663-665`).
- **Evidencia**: un lote dejado en 0 (ahora permitido: el guard absoluto acepta 0) o datos legacy → editar bloqueado (hoy con error claro, spec 39; antes bloqueo silencioso). El safety-net de `_consumirFIFO` (97-129) fabrica lotes solo en consumos, no en edición.
- **Impacto**: BAJO (error visible, workaround: una Entrada crea lote).
- **Sugerencia**: permitir editar producto aunque no haya lote activo (crear lote 0 si hace falta).

### F9 — P3 · Confirmación de borrado no informa el alcance de la pérdida — ✅ NUESTRO (branch `fix-f8-f9`, commit `01d954c`)

- **Estado**: ✅ RESUELTO (2026-08-14). Nuevo `ProductoService.obtenerConteoEliminacion(id)` (5 COUNTs: ventas, cuentas, movimientos, lotes, venta_lotes); `confirmarEliminar` async carga el conteo; el diálogo informa loading → bloqueo por historial (botón deshabilitado) → cantidades exactas → fallback genérico si falla el conteo.
- **Propuesta acordada (implementada)**:
  - **NO se tocó `eliminar()`** en `producto.service.ts` ni `stock-movimiento.service.ts`.
  - Método **nuevo** `obtenerConteoEliminacion(id) → { movimientos, lotes, ventaLotes, ventas, cuentas }` — agregar ≠ modificar, merge trivial con F6.
  - En `inventario.page.ts`: `confirmarEliminar(id)` carga el conteo; el diálogo muestra qué se elimina.
  - En `inventario.page.html:563-610`: diálogo informa cantidades antes de confirmar.
  - **Integración con F1**: si hay `detalle_ventas`/`cuenta_cosas` → muestra que NO se puede eliminar y deshabilita el botón (mismas tablas que ya bloquea F1); si no → muestra cuántos movimientos/lotes se borran. Doble guard UX en `ejecutarEliminar`.

- **Dónde**: `inventario.page.html:563-591`.
- **Evidencia**: se borran permanentemente movimientos, lotes y `venta_lotes` del producto y se degradan reportes históricos; el diálogo solo dice "no se puede deshacer".
- **Impacto**: BAJO (UX).
- **Sugerencia**: informar qué se elimina (cantidad de movimientos/lotes/referencias) antes de confirmar.

## Lo que SÍ está bien (verificado, no tocar)

- **Atomicidad**: todas las escrituras de stock corren en `transaction()` re-entrante (JOIN para `VentaService`/`CuentaCosasService` con BEGIN raw), con tests S-03 de "fallo a mitad" por operación (`stock-movimiento.service.spec.ts:1241-1387`).
- **Pre-validación FIFO sin consumo parcial** (S-04) y **guards de cantidad** (S-05) cubiertos con tests.
- **Traslado/salida/merma sin `_checkAdmin` es INTENCIONAL**: los specs lo fijan explícitamente (`stock-movimiento.service.spec.ts:117, 728`).
- El flujo de edición tiene re-entrancy guard anti doble-click (`inventario.page.ts:143`).

## Priorización sugerida

1. ~~**F1 + F2**~~ — integridad de datos (pérdida de historial / bloqueo de restauración e import). ✅ RESUELTO.
2. ~~**F3**~~ — consistencia de lo que pinta la UI y costos. ✅ RESUELTO (feedback FIFO claro).
3. **F4–F7** — externo (branch `fix-f4-f7`). ✅ MERGEADO a `fix-inventario-bugs` (commit `a3dc87d`).
4. **F8–F9** — nosotros (branch `fix-f8-f9`). ✅ RESUELTOS (commits `5fd389d`, `01d954c`, pusheados). Pendiente: merge `fix-f8-f9` → `fix-inventario-bugs` → `main`.

## Referencias

- Commits de fix previo: `855a838`, `6c26562`, `d683a41`, `7a730f3`, `e8052cf`.
- Commits del plan F1–F3 (branch `fix-inventario-bugs`): `dea2405`, `4f64930`, `21251f7`.
- Diagnóstico: `docs/investigacion-edicion-producto.md`.
- Archivos clave: `src/app/services/producto.service.ts`, `src/app/services/stock-movimiento.service.ts`, `src/app/pages/inventario/inventario.page.ts/.html`, `electron/db.ts`, `src/app/services/db-migrations.ts`.
