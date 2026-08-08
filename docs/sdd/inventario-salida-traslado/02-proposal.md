# SDD — Proposal: `inventario-salida-traslado`

> Artefacto de propuesta (2026-08-08). Guardado también en Engram (`sdd/inventario-salida-traslado/proposal` #530).
> **REVISADO (mid-flight)**: el requisito del usuario evolucionó — el selector de lote pasó de OPCIONAL (sin lote → FIFO) a OBLIGATORIO junto con la UBICACIÓN DE ORIGEN, eliminando la opción "FIFO automático (sin lote)" de la UI. El spec (#531) y el design (#532) fueron revisados en consecuencia; esta propuesta documenta el intent original y la evolución.

## Intención

El botón "Salida" de InventarioPage tiene un nombre comercial engañoso para el negocio (debería ser "Traslado") y carece del control a nivel de lote que ya tienen Ajustar/Editar. Este cambio renombra el botón/form y agrega control de UBICACIÓN DE ORIGEN + LOTE al formulario de salida. La operación NO cambia en esencia: salida destructiva de stock, solo admins, Cantidad + Motivo, método `registrarSalida`, movimiento `tipo: 'salida'`.

## Alcance

### In scope
- Renombrar etiqueta del botón "Salida" → "Traslado" (inventario.page.html:88) y su form; `tipo: 'salida'` interno intacto (union `selectedAction` sin cambios)
- Selector de UBICACIÓN DE ORIGEN OBLIGATORIO (evolución mid-flight): "Tienda" (`'shop'`) | "Almacén" (`'almacen'`), sin default — el usuario debe elegir de dónde sale el stock
- Selector de LOTE OBLIGATORIO (evolución mid-flight): dropdown con los lotes de la ubicación elegida con `cantidad > 0` (patrón Ajustar/Editar: `obtenerLotesPorProducto` → `selectedLoteIndex` 1-based → submit mapea a `lote.id`). NO existe la opción "FIFO automático (sin lote)" en la UI
- Cambio de servicio MÍNIMO y aditivo: `registrarSalida` recibe `loteId?: number` al final (default `undefined` → FIFO). Los 3 callers existentes (cuenta-cosa, venta, página) siguen funcionando sin cambios; FIFO queda solo para callers internos
- `_consumirFIFO(productoId, cantidad, ubicacion, loteId?)`: pre-check `SELECT ... WHERE id = ? AND producto_id = ? AND ubicacion = ?`; si el lote no existe o `cantidad > lote.cantidad` → `throw 'Stock insuficiente'` ANTES de cualquier UPDATE (sin consumo parcial)
- Tests RED/GREEN en español (`ng test`): spec página (botón "Traslado", ubicación+lote obligatorios, filtrado por ubicación, reset al cambiar ubicación, submit args, sin opción FIFO) + spec servicio (consumo de lote específico, error por exceso sin mutación)

### Out of scope
- NO generalizar `registrarTraslado`, NO fusionar con "A Tienda" (traslado real almacén→shop, todos los usuarios, sin lote/motivo)
- NO cambios de roles (salida sigue solo-admin; "A Tienda" fuera del `@if esAdmin`)
- NO migración de DB ('traslado' ya en CHECK v11, db-migrations.ts:465; `stock_movimientos` NO tiene columna `lote_id` — ver desviación REQ-6 en la constancia)
- NO renombrar la etiqueta de TIPO en historial (chip "Salida" para `m.tipo === 'salida'`, html:396) — colisionaría con el chip "Traslado" existente de "A Tienda"
- Merma/baja destructiva en ProductosPage intacta

## Contexto / Estado actual

- Form inline de movimiento: html:153-333; botón salida html:82-90 → `onSelectAction(id,'salida')` (ts:124-131) llama `registrarSalida(productoId, cantidad, motivo, undefined, 'almacen')`
- `registrarSalida` (servicio:179-218): `_consumirFIFO(..., 'almacen')`, inserta movimiento `tipo 'salida'`, recalcula `stock_almacen`. Primitiva compartida (VentaService la usa con 'shop'); sin `_checkAdmin` propio
- Patrón lote existente: `obtenerLotesPorProducto` (servicio:544-553, devuelve lotes de AMBAS ubicaciones con `cantidad > 0`) → `productoLotes` → dropdown html:266-281 → submit `lotes[idx-1].id`
- `onSelectAction` hoy carga lotes solo para `ajuste`/`editar` con auto-selección de índice 1; la salida no auto-selecciona (obligatoriedad explícita del usuario)

## Enfoque

1. **Servicio (round 1, final)**: param aditivo `loteId?: number` al final de `registrarSalida`; `_consumirFIFO` con `loteId` hace pre-check (SELECT) y tira 'Stock insuficiente' antes de mutar; query de consumo con `AND id = ?`; safety-net de fabricación de lote solo para `loteId === undefined`. Resto del flujo (INSERT movimiento, recálculo stock) idéntico.
2. **UI (round 2, rework)**: rename html:88 "Salida" → "Traslado" (mismo ícono `remove_circle`, mismo color; "A Tienda" queda teal/send). Signals/computed: `salidaUbicacion` (sin default), `lotesDeUbicacion` (filtro `ubicacion === salidaUbicacion() && cantidad > 0`). Al cambiar ubicación: reset `selectedLoteIndex`. Submit `case 'salida'`: SIEMPRE `registrarSalida(productoId, cantidad, motivo, undefined, salidaUbicacion(), lote.id)`; sin ubicación o sin lote el submit está deshabilitado.
3. Reset post-submit (ts:187-194) limpia `selectedLoteIndex`, `salidaUbicacion` y `productoLotes`.

## Decisiones clave

| Decisión | Racional | Alternativas rechazadas |
|---|---|---|
| Param aditivo `loteId?` en registrarSalida + pre-check en `_consumirFIFO` | Única forma de "consumir de ESE lote" manteniendo tipo 'salida'; 100% retrocompatible (default undefined → FIFO; callers existentes intactos) | Selector decorativo que ignora el lote; reusar registrarAjusteLote (registra tipo 'ajuste', cambia semántica) |
| Ubicación de origen OBLIGATORIA sin default (evolución) | REQ-4: el usuario decide "de dónde" en cada operación | Default 'almacen' (violaría la obligatoriedad explícita) |
| Lote OBLIGATORIO sin opción FIFO en UI (evolución) | REQ-5: el usuario decide el lote siempre; FIFO queda solo para callers internos (venta/cuenta-cosa) | Opción "FIFO automático (sin lote)" (era el scope original; eliminada por el usuario a mitad de vuelo) |
| Dropdown filtrado por la ubicación elegida | Salida consume stock SOLO de la ubicación de origen | Mostrar todos los lotes (consumiría stock equivocado) |
| Chip historial sigue "Salida" | `m.tipo` display; "Traslado" ya existe para "A Tienda" | Renombrar chip (colisión visual de dos operaciones distintas) |

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Renombrar labels incorrectos (historial, otros pages) | Media | Grep verificado: única ocurrencia de botón es html:88; chip historial html:396 queda intacto (scope OUT explícito) |
| Specs existentes que asumen "Salida" | Media | In scope: actualizar inventario.page.spec.ts (:242/:264 a "Traslado"); asserts de submit con 6 args (ubicacion + loteId); historial NO cambia |
| Consumo de lote con `cantidad > lote.cantidad` | Baja | `_consumirFIFO` con loteId lanza 'Stock insuficiente' antes de mutar (pre-check SELECT); spec servicio RED primero |
| Firma aditiva mal interpretada como "cambio de operación" | Baja | Param opcional default undefined; documentado como aditivo, no breaking |
| Requisito mid-flight (lote opcional → obligatorio) | Media | Spec/design revisados y congelados antes de la ronda UI; constancia documenta la evolución |

## Plan de rollback

Revert del rename (html:88) + revert del rework UI (signals `salidaUbicacion`/`lotesDeUbicacion`, submit) + revert del param `loteId?` en servicio y página. No hay migración ni datos: los movimientos siguen siendo `tipo 'salida'`. Safe para revertir con `git revert` de los commits del change.

## Dependencias

- Ninguna externa. Internas: `StockMovimientoService` (`registrarSalida` + `_consumirFIFO`), `obtenerLotesPorProducto` existente, `selectedLoteIndex`/`productoLotes` signals ya presentes.

## Criterios de éxito

- [x] Botón y form del form inline muestran "Traslado"; `tipo` interno sigue `'salida'`
- [x] Selector de ubicación de origen obligatorio (Tienda/Almacén), sin default; sin ubicación el submit no llama `registrarSalida`
- [x] Dropdown de lotes obligatorio, filtrado por la ubicación elegida (`cantidad > 0`), placeholder "Seleccioná un lote…", SIN opción "FIFO automático"
- [x] Con ubicación+lote el submit llama `registrarSalida(productoId, cantidad, motivo, undefined, ubicacion, lote.id)`; el consumo decrementa SOLO ese lote
- [x] Cambiar la ubicación resetea el lote elegido y refiltra el dropdown
- [x] `cantidad > lote.cantidad` → error 'Stock insuficiente', sin consumo parcial (pre-check antes de UPDATEs)
- [x] "A Tienda" intacto (mismo botón, misma llamada `registrarTraslado`); chip historial "Salida" intacto
- [x] Todos los specs RED→GREEN con `ng test` (45 files / 770 tests; Node ≥ 24.15.0, `PATH="/c/nvm4w/nodejs:$PATH"`)

## Preguntas abiertas (RESUELTAS)

1. ¿Cambio de firma de servicio? → Solo param ADITIVO opcional al final; ninguna llamada existente se toca. Única vía técnica para cumplir "consumir de ese lote" manteniendo tipo 'salida'.
2. ¿Lote opcional (FIFO default) o obligatorio? → Originalmente opcional; el usuario evolucionó el requisito a OBLIGATORIO (lote + ubicación de origen), sin opción FIFO en la UI. FIFO queda solo para callers internos (venta/cuenta-cosa).
3. ¿Renombrar también el chip de historial? → NO (colisión con chip "Traslado" de "A Tienda").
