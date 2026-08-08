# SDD — Exploration: `inventario-salida-traslado`

> Artefacto de exploración (2026-08-08). Guardado también en Engram (`sdd/explore/inventario-salida-traslado` #529).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada y verificada APPROVED (45 files / 770 tests, 2 rondas de implementación y 2 de verificación). Ver `docs/sdd/inventario-salida-traslado/05-tasks.md` (constancia).

## Executive summary

El botón "Salida" de InventarioPage tiene un nombre comercial engañoso para el negocio (debería ser "Traslado") y carece del control a nivel de lote que ya tienen Ajustar/Editar. La exploración confirmó el alcance: renombrar SOLO el botón/form "Salida" → "Traslado", la operación queda idéntica (salida destructiva desde almacén, solo admins, Cantidad + Motivo, movimiento `tipo: 'salida'`, método `registrarSalida` intacto) y agregar un selector de lote.

**Evolución del requisito (mid-flight)**: el scope original pedía selector de lote OPCIONAL (sin lote → FIFO actual). Durante la implementación el usuario exigió que el lote y la ubicación de origen fueran OBLIGATORIOS (Tienda | Almacén), eliminando la opción "FIFO automático (sin lote)" de la UI. Por eso spec (#531) y design (#532) fueron REVISADOS y la UI se reworkeó en una segunda ronda. El servicio se mantuvo aditivo (round 1, final) y no requirió cambios en la ronda UI.

## Estado actual (file:line)

- **Botón "Salida"**: inventario.page.html:88, handler `onSelectAction(id,'salida')` → inventario.page.ts:124-131 llama `registrarSalida(productoId, cantidad, motivo, undefined, 'almacen')` (5to arg hardcodea 'almacen').
- **`registrarSalida`** (stock-movimiento.service.ts:200-218): `_consumirFIFO(productId, qty, ubicacion)` y registra movimiento `tipo 'salida'`. DESTRUYE stock (no crea lotes destino). Es primitiva compartida: VentaService la usa con 'shop' (FIFO) y cuenta-cosa también — sin `_checkAdmin` propio.
- **NO hay botón Merma en InventarioPage** (vive en ProductosPage); union `selectedAction`: `'entrada'|'salida'|'ajuste'|'traslado'|'editar'`.
- **"A Tienda"** (traslado real): stock-movimiento.service.ts:304-353 `registrarTraslado`, dirección fija almacén→shop, sin lote, sin motivo; visible para todos los roles (fuera del `@if esAdmin`).
- **Patrón selector de lote (ajuste/editar)**: `obtenerLotesPorProducto` (service:544-553, devuelve lotes de AMBAS ubicaciones con `cantidad > 0`) → `selectedLoteIndex` signal 1-based → dropdown html:266-281 → submit mapea index→lotes[i-1].id.
- **Stock dual**: `Producto.stock_almacen` + `stock_shop`; `LoteStock.ubicacion` `'almacen'|'shop'`; `'traslado'` ya en CHECK de DB (v11, db-migrations.ts:465) — NO hay migración pendiente.
- **Role gating UI**: `esAdmin` computed (rol==='admin') en inventario.page.ts; "A Tienda" fuera del `@if esAdmin`.

## Gap analysis

1. **Naming comercial** — "Salida" no comunica el negocio; el usuario pide "Traslado".
2. **Control de lote** — Ajustar/Editar ya eligen lote; la salida consume FIFO sin control explícito. Con la evolución del requisito, la UI final EXIGE elegir ubicación de origen + lote (REQ-4/REQ-5), sin opción FIFO.
3. **Granularidad del movimiento** — `stock_movimientos` NO tiene columna `lote_id` (solo `venta_lotes`); la granularidad de lote queda en el `ConsumoRecord` devuelto por `registrarSalida` (patrón venta→venta_lotes). Desviación sancionada por design (REQ-6; migración fuera de scope).

## Verdict

**YES.** Cambio acotado: rename UI + control de lote/ubicación en el form de salida + parámetro ADITIVO `loteId?` en `registrarSalida` (100% retrocompatible, los 3 callers existentes — venta, cuenta-cosa, página — siguen con FIFO). Sin migración, sin cambios de rol, sin tocar "A Tienda" ni el chip de historial.

## Enfoque recomendado

1. Servicio (round 1): `registrarSalida` recibe `loteId?: number` al final (default `undefined` → FIFO); `_consumirFIFO` 4º param `loteId?` → pre-check (SELECT) que lanza 'Stock insuficiente' ANTES de cualquier UPDATE (sin consumo parcial). TDD RED→GREEN.
2. UI (round 2, rework): botón "Traslado" (html:88), selector de ubicación de origen OBLIGATORIO sin default (`salidaUbicacion`), dropdown de lote OBLIGATORIO filtrado por la ubicación (`lotesDeUbicacion`, `cantidad > 0`), sin opción "FIFO automático"; submit bloqueado sin ubicación+lote; cambiar ubicación resetea el lote.
3. TDD estricto del repo (RED primero, Vitest vía `ng test` con Node ≥ 24.15.0, specs en español).

Files: `src/app/services/stock-movimiento.service.ts` (+spec), `src/app/pages/inventario/inventario.page.ts/.html` (+spec).

## Riesgos

- **Renombrar labels incorrectos** (historial, otros pages) — única ocurrencia del botón es html:88; el chip de historial "Salida" (html:396) NO se renombra (colisionaría con el chip "Traslado" de "A Tienda").
- **Consumo de lote con `cantidad > lote.cantidad`** — `_consumirFIFO` con loteId lanza 'Stock insuficiente' sin mutar (pre-check).
- **Firma aditiva mal interpretada como cambio de operación** — param opcional default `undefined`; documentado como aditivo, no breaking.
- **Node del sistema < mínimo Angular (24.15.0)** — ejecutar `ng test` con `PATH="/c/nvm4w/nodejs:$PATH"`.
