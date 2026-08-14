# Investigación: Edición de producto para bajar cantidad — "no se realizó / no refresca"

**Fecha**: 2026-08-13
**Tipo**: Investigación profunda (SDD explore) — sin cambios de código
**Autor**: Pana A (con asistencia de orquestador SDD)
**Rama**: `main`

## Contexto

Un cliente reportó: *"Ajusté y edité un producto para bajarle la cantidad, pero la operación no se realizaba."* En general: al editar un producto, **a veces** la UI no actualiza, la página no refresca y la operación parece no persistir. La queja es intermitente: el dueño testea y no reproduce el error a demanda.

**Conclusión rápida**: la escritura SQL **sí llega y se ejecuta** en SQLite (el driver no falla en silencio). El problema real es **semántica del formulario + falta de atomicidad + feedback de UI ausente**. Los bugs son **condicionales** — por eso no se reproducen en el camino feliz.

## A. Flujo de edición de producto (end-to-end)

**Importante**: el "Editar" NO vive en la página Productos (`/productos` solo tiene Merma + Lotes, sin botón editar). Vive en **Inventario** (`/inventario`), y la cantidad se edita **por lote FIFO**, no con un campo directo en `productos`.

1. **Botón Editar** — `inventario.page.html:100-108` → `onSelectAction(producto.id, 'editar')` (solo admin, `esAdmin()` en `inventario.page.ts:34`).
2. **Apertura del form** — `inventario.page.ts:285-321`:
   - Carga `productoLotes` con `obtenerLotesPorProducto` (`stock-movimiento.service.ts:578-587` — filtra `cantidad > 0`, **sin filtrar ubicación**).
   - Preselecciona `selectedLoteIndex = 1` (el lote **más viejo** por FIFO, de cualquier ubicación) y precarga `movimientoCantidad = firstLote.cantidad` (línea 310) y `editarPrecioCosto = firstLote.precio_costo` (309).
3. **Form inline** — `inventario.page.html:160-237`: selector de Lote (solo si hay lotes), Nombre, Precio Venta, Precio Costo, **Unidades** (`[(ngModel)]="movimientoCantidad"`, `min="0"`, `required`), **Motivo (obligatorio)**.
4. **Submit** — `inventario.page.ts:179-208`, case `'editar'`:
   - `loteSel = productoLotes[loteIdx - 1]` (182); si no hay lote → `error('Debe seleccionar un lote')` y corta.
   - `registrarEditar(productoId, loteSel.id, nombre, pv, pc, movimientoCantidad() ?? 0, motivo, loteSel.ubicacion)` (197-206).
5. **Servicio** — `stock-movimiento.service.ts:437-493` (`registrarEditar`, `_checkAdmin` en 447):
   - `INSERT INTO stock_movimientos ... tipo='ajuste', cantidad = <valor ABSOLUTO nuevo>` (458-462)
   - `UPDATE productos SET nombre, precio_venta` (465-468)
   - `UPDATE lotes_stock SET cantidad = <absoluto>, precio_costo` (471-474)
   - `_syncPrecioCosto` (478 → 132-145)
   - `SELECT SUM(cantidad) ... WHERE producto_id AND ubicacion = <ubic del lote>` (481-484) → `UPDATE productos SET stock_{ubicacion} = total` (486-492)
6. **Post-submit** — `inventario.page.ts:216-225`: reset de signals + `await this.loadProductos()` (re-fetch completo).

## B. Cómo se actualiza la UI tras editar — y dónde se rompe

Mecanismo: **signals + re-fetch**. `productos` (`inventario.page.ts:36`) y `filteredProductos` computed (94-100); tras éxito → `loadProductos()` (106-121) → `productoService.listar()` → `productos.set()`. No hay caché; la UI siempre re-fetcha tras una operación OK.

La UI **no refresca / parece no reaccionar** en estos caminos:

1. **El submit ni llega al servicio**: los campos están `required` y el `<form>` **no tiene `novalidate`** (`inventario.page.html:156-159`). Si se deja el **Motivo vacío** (o cualquier campo), el browser bloquea el submit en silencio: el tooltip nativo es fácil de no percibir en pantallas táctiles → "click en Guardar y no pasó nada".
2. **`productoLotes` vacío**: producto con stock pero sin lotes activos → `selectedLoteIndex` queda `null` → corta con `'Debe seleccionar un lote'` (182-186). El editar de cantidad es **imposible** para ese producto.
3. **El recálculo toca SOLO la ubicación del lote editado** (481-492): si se baja un lote de `almacen` y se está mirando la columna "Stock Tienda" (o el total), **el número que se mira no cambia** → "no se realizó / no refrescó". Esto es determinista por producto (depende de dónde viven sus lotes), lo que explica el "a veces".
4. **Fallo a mitad de cadena sin transacción** (ver C): se recarga un estado inconsistente — el lote bajó pero la columna de la tabla quedó con el valor viejo (mayor) → el cliente ve que "no se actualizó".

## C. Estado de la persistencia

- Los UPDATE **sí llegan a la DB**: `SqliteService.sql` (`sqlite.service.ts:32-36`) y `NativeSqliteService.sql` (`native-sqlite.service.ts:32-34`) hacen `await` sobre el driver; los errores **propagan** — en Electron el handler `db:sql` lanza (`electron/main.ts:407-424`, con rollback si hay txn abierta) y en SQLocal 0.18 el worker serializa con `transactionMutex` y rechaza la promesa (verificado en `node_modules/sqlocal/dist/processor.js` y `client.js`).
- **PERO no es atómico**: `registrarEditar` (y Entrada/AjusteLote/Traslado/Merma) son 5-7 statements sueltos **sin `BEGIN/COMMIT` ni `client.transaction()`** — cada `_db.sql` es un autocommit individual. El único flujo transaccionado es `VentaService._ejecutar` (`venta.service.ts:88/230/233`).
- **`_consumirFIFO` consume-antes-de-validar** (`stock-movimiento.service.ts:98-118`): descuenta lotes y **recién después** lanza `'Stock insuficiente'` (116-118). En ventas lo salva el ROLLBACK externo; en **merma** (`registrarMerma` 506-567), **salida** ("Traslado", 199-239) y **traslado** ("A Tienda", 325-379) **no hay transacción** → consumo parcial persistido sin movimiento ni actualización de `productos.stock_*`.

## D. Root causes (ordenadas por probabilidad)

1. **Semántica de edición por LOTE + selector mezclado + valor absoluto** (alta — explica el "a veces" determinista y el "bajar cantidad").
   - El campo "Unidades" es la **cantidad absoluta del lote** precargada con la actual (`inventario.page.ts:310`, reset al cambiar de lote en 324-330). Un cliente que "quiere bajar" teclea el delta o deja el valor viejo; si lo vacía, `?? 0` (`inventario.page.ts:203`) pone el lote en 0.
   - `obtenerLotesPorProducto` mezcla almacén + tienda (`stock-movimiento.service.ts:578-587`) y el default es el lote más viejo de cualquiera de las dos → recalc solo en esa ubicación (481-492) → la columna que mira el cliente puede no moverse.
   - El movimiento registra el absoluto (`458-462`): el historial muestra "Ajuste 3u" para un cambio 10→3 → parece que "la operación" registró cualquier cosa.
   - Evidencia: `inventario.page.ts:299-317`, `stock-movimiento.service.ts:437-493, 578-587`.
2. **Falta de transacción en las operaciones multi-paso de stock** (alta — explica "no persiste" / "no se actualiza").
   - Falla a mitad de cadena (ej. en `_syncPrecioCosto` o el recálculo) → movimiento insertado y/o lote cambiado pero `productos.stock_*` stale → la recarga muestra el número viejo y la base queda divergida. Contrasta con ventas, que sí transacciona (`venta.service.ts:88-233`).
   - Evidencia: `stock-movimiento.service.ts:437-493` (sin txn), `venta.service.ts:88/230/233` (con txn).
3. **`_consumirFIFO` con efecto parcial persistido** (media — camino merma/salida/traslado).
   - Consume lotes y recién después falla (116-118); sin rollback externo en merma/salida/traslado → divergencia lote vs columna. Si además deja stock>0 sin lotes, el próximo "Editar" del producto muere en `'Debe seleccionar un lote'` (182-186). Evidencia: `stock-movimiento.service.ts:31-124, 506-567, 199-239, 325-379`.
4. **Validación nativa silenciosa** (media — el "click y no pasó nada").
   - Campos `required` (Motivo incluido) sin `novalidate` → bloqueo silencioso en táctil. Evidencia: `inventario.page.html:181-236`.
5. **Cache denormalizada `productos.precio_costo`** (media — para edición de costo, no cantidad).
   - Si el costo editado es de un lote **no-frontal**, `_syncPrecioCosto` (132-145) no lo refleja y la columna "Precio Costo" (`inventario.page.html:59` lee `producto.precio_costo`) no cambia. El test solo cubre el caso frontal (spec 839-867).
6. **Sin guard de `cantidad >= 0` en el servicio** (baja-media).
   - `registrarEditar`/`registrarAjusteLote` aceptan negativos (solo `min="0"` en HTML); un lote en 0/negativo desaparece del selector (`cantidad > 0`, 583) → producto no editable.

## E. Propuesta de fix (2 fases)

### Fase 1 — El bug del cliente (rápido, ataca directo la queja)
1. **`novalidate` + validación explícita con mensaje en pantalla** — el botón Guardar **nunca** queda mudo (el motivo vacío hoy bloquea en silencio). El motivo obligatorio ya se valida en el servicio con mensaje claro (`stock-movimiento.service.ts:448-450`); replicarlo en la UI.
2. **Semántica del campo Unidades**: etiquetarlo como "Cantidad nueva del lote" (hoy parece delta pero guarda absoluto), eliminar el `?? 0` silencioso, y **toast post-guardado** mostrando el stock nuevo por ubicación.
3. **Guard `cantidad >= 0` (y techo) en el servicio**, no solo en HTML.

### Fase 2 — La causa de fondo (evita que vuelva a pasar)
4. **Envolver todas las operaciones multi-paso de `StockMovimientoService` en transacción** (patrón `venta.service.ts:88-233` — BEGIN/COMMIT/ROLLBACK con la conexión persistente nativa o `client.transaction()` en web). Mata las divergencias lote↔columna y el "no persiste". Riesgo medio: cuidar el ROLLBACK en SQLocal cuando la conexión es persistente.
5. **Pre-validar stock ANTES de consumir en `_consumirFIFO`** (mover el `restante > 0 → throw` antes del loop, generalizando el pre-check que ya existe para `loteId`, 40-49). Quick win, elimina el consumo parcial.
6. (Opcional) **Rediseñar el form Editar**: editar el **total del producto** (reparto FIFO) o filtrar el selector de lotes por ubicación mostrando el resultado por ubicación.
7. (Opcional) **Decidir la semántica de `productos.precio_costo`** — consistencia con lo que el cliente ve.
8. (Opcional) **Historial coherente**: el movimiento de editar debería registrar el delta y/o el stock resultante, para que "Ajuste" tenga sentido.

## F. Tests faltantes (que habrían atrapado esto)

- **Atomicidad**: "si `registrarEditar` falla a mitad (rechazo en el UPDATE del lote), la DB queda sin cambios" — hoy solo hay mocks secuenciales perfectos.
- **Refresh post-edición**: "tras un submit exitoso, `listar()` se vuelve a llamar y `productos()` refleja el nuevo stock" — `inventario.page.spec.ts:840-868` (test 22) asserta solo la llamada a `registrarEditar`, **nunca el refresh**.
- **Aislamiento por ubicación**: "editar un lote de `almacen` NO toca `stock_shop`" + cobertura del dropdown mixto.
- **Guard negativo**: "bajar cantidad a 0/negativa vía servicio → rechazado sin mutaciones".
- **Pre-validación FIFO**: "`registrarSalida`/`registrarMerma` con cantidad > stock disponible → ninguna escritura parcial persiste".
- **Producto sin lotes**: "editar un producto sin lotes → error claro y sin mutaciones".
- **Semántica del campo Unidades**: test de intención (delta vs absoluto) para fijar el contrato antes del rediseño.

## Notas de cobertura

Los commits recientes (`828f477 fix(stock): re-sync precio_costo...`, `9f5926e rename Salida→Traslado...`, `3f048fb salida por lote específico`) tocaron justo estas rutas; las ramas `fix/editar-redesign` y `fix/inventario-bugs` ya están mergeadas (son ancestros de `palmar-feature`), así que **no hay un fix pendiente de merge** — el bug es del diseño actual, no una regresión no-mergeada.

**Pendiente**: armar SDD de fix (Fase 1 + Fase 2) cuando el equipo lo apruebe.
