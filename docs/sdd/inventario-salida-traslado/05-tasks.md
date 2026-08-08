# SDD — Tasks: `inventario-salida-traslado`

> Artefacto de tareas (2026-08-08). Guardado también en Engram (`sdd/inventario-salida-traslado/tasks` #533).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada (2 rondas) y verificada APPROVED (45 files / 770 tests). Apply: `sdd/inventario-salida-traslado/apply-progress` (#534, refrescado con el estado combinado de ambas rondas). Verify: 2 rondas — round 2 APPROVED (reporte comunicado por el orquestador, no persistido como observación separada en Engram).

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas (cambiadas) | ~200–250 |
| 400-line budget risk | Low |
| Chained PRs recomendados | No |
| Estrategia de entrega | single-pr |
| Estrategia de cadena | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Work Units / Plan de commits (2, conventional commits, sin Co-Authored-By)

| Unit | Meta | Commit sugerido | Notas |
|------|------|-----------------|-------|
| 1 | Servicio aditivo `loteId` (REQ-8) + `_consumirFIFO` con lote objetivo (REQ-6/7) | `feat(stock): allow registrarSalida to target a specific lot` | servicio + spec; fibras FIFO intactas |
| 2 | Rename UI (REQ-1/2) + ubicación y lote OBLIGATORIOS (REQ-4/5) + wiring submit | `feat(ui): rename Salida to Traslado with mandatory location and lot selectors` | page ts/html + spec; "A Tienda"/chip historial intactos; AMENDED tras el rework mid-flight |

## Fase 1: Servicio — lote objetivo (round 1, FINAL; RED → GREEN)

- [x] 1.1 [RED] `stock-movimiento.service.spec.ts` (describe registrarSalida): test consumo por lote — `registrarSalida(1, 5, 'Lote', undefined, 'almacen', 5)` decrementa SOLO el lote 5 y deja intactos los demás, movimientos tipo 'salida'. AC: falla hoy (firma sin loteId — TS2554). TEST: sí. (TRIANGULATE ×2: lote inexistente 999 → throw sin mutar; consumo total del lote → único UPDATE.)
- [x] 1.2 [RED] (misma spec): test `cantidad (15) > lote.cantidad (10)` → rejects 'Stock insuficiente' y lotes NO mutados (mockDb.sql llamado 1 sola vez = pre-check, sin UPDATEs). TEST: sí.
- [x] 1.3 [GREEN] `registrarSalida` (stock-movimiento.service.ts:200): añadir `loteId?: number` al FINAL de la firma (default `undefined` → FIFO actual); los 3 callers existentes (cuenta-cosa.service.ts:27, venta.service.ts:210, page.ts) intactos. AC: REQ-8. TEST: sí.
- [x] 1.4 [GREEN] `_consumirFIFO` (:31): 4º param `loteId?` → pre-check `SELECT ... WHERE id = ? AND producto_id = ? AND ubicacion = ?` (throw 'Stock insuficiente' antes de mutar), query de consumo con `AND id = ?`, safety-net de fabricación de lote solo con `loteId === undefined`. Loop UPDATE intacto. AC: REQ-6/REQ-7. TEST: sí.

## Fase 2: Inventario — rename + ubicación y lote OBLIGATORIOS (round 2, rework mid-flight)

> **Evolución del requisito**: el usuario pasó de "lote opcional (FIFO default)" a "ubicación de origen + lote OBLIGATORIOS, sin opción FIFO en la UI". Las tareas 2.x reflejan el estado FINAL del rework (los artefactos intermedios `lotesAlmacen`/`FIFO automático` de la ronda 1 quedaron descartados por el rework).

- [x] 2.1 html:88: botón "Salida" → "Traslado" (ícono `remove_circle` naranja y handler `onSelectAction(prod.id,'salida')` intactos). Chip historial :396 sigue "Salida". AC: REQ-1/REQ-2.
- [x] 2.2 `onSelectAction` (page.ts): incluir `tipo === 'salida'` en el branch que llama `obtenerLotesPorProducto` PERO sin auto-selección de ubicación ni lote (auto-select solo para ajuste/editar). AC: S-01.
- [x] 2.3 signal `salidaUbicacion = signal<'almacen' | 'shop' | null>(null)` — OBLIGATORIO, sin default. AC: REQ-4.
- [x] 2.4 computed `lotesDeUbicacion` (page.ts:63): `salidaUbicacion() ? productoLotes().filter(l => l.ubicacion === salidaUbicacion() && l.cantidad > 0) : []` — mismo array en template y submit, índices coincidentes. AC: REQ-5 (filtrado por ubicación).
- [x] 2.5 `onSalidaUbicacionChange` (page.ts:87): setear `salidaUbicacion` y resetear `selectedLoteIndex` a null (S-08). Reset post-submit/acciones también limpia `salidaUbicacion`.
- [x] 2.6 html (form de salida): selector de ubicación sin default ("Tienda"/"Almacén" → `'shop'`/`'almacen'`); dropdown de lotes deshabilitado hasta elegir ubicación (`[disabled]="!salidaUbicacion()"`), placeholder "Seleccioná un lote…" (value vacío), itera `lotesDeUbicacion()`; SIN opción "FIFO automático". Submit deshabilitado sin ubicación o sin lote (html:342). AC: REQ-4/REQ-5, S-02.
- [x] 2.7 submit `case 'salida'` (page.ts:145-152): `lote = lotesDeUbicacion()[selectedLoteIndex - 1]`; SIEMPRE `registrarSalida(productoId, cantidad, motivo, undefined, salidaUbicacion(), lote.id)`. Cantidad + Motivo intactos. AC: REQ-3, S-03/S-06.
- [x] 2.8 specs página: tests 7/8 → "Traslado" (admin) / no "Traslado" (no-admin — REQ-9/S-05); tests 12.x nuevos: (a) sin ubicación dropdown deshabilitado + submit no llama registrarSalida; (b) "Tienda" lista SOLO lotes tienda / "Almacén" solo almacén (contraste); (c) cambiar ubicación resetea `selectedLoteIndex` y refiltra (S-08); (d) sin lote no llama registrarSalida; (e) con ubicación+lote → `registrarSalida(1, 3, undefined, undefined, 'almacen'|'shop', loteId)`; (f) no existe la opción "FIFO automático" (12.7). Test 14 (chip historial "Salida") y test 10 ("A Tienda" — REQ-10/S-07) intactos. TEST: sí.

## Fase 3: Verificación + commits

- [x] 3.1 `ng test` completo verde: **45 files / 770 tests** (Node ≥ 24.15.0, `PATH="/c/nvm4w/nodejs:$PATH"`); chip historial "Salida" intacto.
- [x] 3.2 `ng build --configuration production` sin errores (solo warning preexistente de budget inicial 702.90 kB > 500 kB, ajeno al change).
- [x] 3.3 Commit 1 (unit 1): `feat(stock): allow registrarSalida to target a specific lot` → **`3f048fb`** (servicio + spec). Ejecutado por el orquestador.
- [x] 3.4 Commit 2 (unit 2): `feat(ui): rename Salida to Traslado with mandatory location and lot selectors` → **`9f5926e`** (page html/ts + spec). AMENDED tras el rework mid-flight (el hash original de la ronda 1, `8dc3139`, ya no existe). Ejecutado por el orquestador.

Rollback: revert de `3f048fb` + `9f5926e` — sin migración ni datos (los movimientos siguen `tipo 'salida'`), del proposal.

## Verificación (sdd-verify, 2026-08-08 — 2 rondas)

### Round 1 (estado pre-rework)
- Suite servicio + página en verde (baseline 767 tests) con el param `loteId?` y el dropdown con opción FIFO.
- Build producción OK (warning budget preexistente).

### Round 2 (estado final tras el rework UI) — **APPROVED**
- RED real confirmado en ronda UI: tests 12.x nuevos (obligatoriedad ubicación/lote, filtrado por ubicación, reset, no-FIFO) fallan contra la implementación pre-rework.
- GREEN: suite completa **45 files / 770 tests PASS** (`ng test --watch=false`, Node 24.15.0 vía nvm4w).
- Build producción ✅ (único warning pre-existente: bundle initial 702.90 kB > 500 kB, ajeno al cambio).
- Matriz REQ-1..REQ-11: **PASS** (evidencia línea a línea: html:88/256-273/342/396, ts:60-63/87-91/145-152, service:31-63/200-211).
- Diseño: ✅ implementado según design revisado (salidaUbicacion, lotesDeUbicacion, pre-check sin consumo parcial).
- **Desviación sancionada REQ-6**: `stock_movimientos` NO tiene columna `lote_id` (migración fuera de scope) — la granularidad de lote vive en el ConsumoRecord devuelto (patrón venta→venta_lotes). Follow-up opcional: migración v18 si el negocio exige trazabilidad del lote en el historial de movimientos.
- Lint: 119 errores pre-existentes repo-wide; TS 0 errores en los 5 archivos del cambio; HTML sin nueva deuda.

## Nota para el orquestador (commits — RESUELTA)

- Los 2 commits del change ya existen: **`3f048fb`** (unit 1 servicio) + **`9f5926e`** (unit 2 UI, AMENDED tras el rework — hash original `8dc3139` descartado).
- NO mergeado a main: el merge queda a criterio del flujo de branch de `feat/inventario-salida-traslado`.
- Ejecutar tests con Node >= 24.15.0 (nvm4w): `PATH="/c/nvm4w/nodejs:$PATH" node node_modules/@angular/cli/bin/ng.js test`.

## Constancia de entrega

- **Cambio COMPLETE** — ciclo SDD cerrado (explore → proposal → spec → design → tasks → apply → verify → archive). Verify round 2 **APPROVED**: 45 files / 770 tests (`ng test --watch=false`, Node 24.15.0). Build OK (warning de budget pre-existente no bloqueante).
- **Evolución del requisito (mid-flight)**: el usuario exigió ubicación de origen (Tienda/Almacén) y lote OBLIGATORIOS, eliminando la opción "FIFO automático (sin lote)" del scope original (lote opcional con FIFO default). Por eso spec (#531) y design (#532) fueron revisados y la UI se reworkeó en la ronda 2; el servicio quedó aditivo tal como se diseñó en la ronda 1.
- Commits de implementación en `feat/inventario-salida-traslado` (desde main, NO mergeado): **`3f048fb`** `feat(stock): allow registrarSalida to target a specific lot` + **`9f5926e`** `feat(ui): rename Salida to Traslado with mandatory location and lot selectors` (AMENDED tras el rework; el hash `8dc3139` de la ronda 1 ya no existe).
- **Post-archive (bugfix añadido a la misma branch)**: **`828f477`** `fix(stock): re-sync productos.precio_costo after edit, traslado and lote ajuste` — corrige la caché `productos.precio_costo` (costo del lote FIFO-front) que quedaba stale tras editar costo, trasladar todo el stock o ajustar/agotar un lote. Extrae helper `_syncPrecioCosto` (misma semántica product-wide, sin filtro de ubicación) reutilizado en `_consumirFIFO`, `registrarEntrada`, `registrarEditar`, `registrarTraslado` (tras insertar lotes shop) y `registrarAjusteLote`. `registrarAjuste` queda como follow-up (no alcanzable desde UI). Verify **APPROVED**: 45 files / 774 tests, build OK.
- Servicio (round 1, final): `registrarSalida` gana `loteId?: number` ADITIVO al final (default `undefined` → FIFO); `_consumirFIFO` 4º param `loteId` → pre-check (SELECT) que lanza 'Stock insuficiente' ANTES de cualquier UPDATE (sin consumo parcial). Los 3 callers existentes (cuenta-cosa, venta, página) NO se modificaron.
- UI (round 2, final): botón "Salida"→"Traslado" (html:88); selector de ubicación obligatorio sin default; dropdown de lotes obligatorio filtrado por la ubicación (`cantidad > 0`), placeholder "Seleccioná un lote…", SIN opción FIFO; submit bloqueado sin ubicación+lote; siempre `registrarSalida(id, cant, motivo, undefined, ubicacion, lote.id)`; cambiar ubicación resetea el lote; chip historial "Salida" (html:396) y "A Tienda" intactos; admin-only.
- **Desviación sancionada (REQ-6)**: `stock_movimientos` no tiene columna `lote_id` (migración fuera de scope); la granularidad de lote queda en el ConsumoRecord devuelto, patrón venta→venta_lotes. Follow-up opcional: migración v18 si el negocio exige trazabilidad del lote en el historial de movimientos.
- Verificación: 2 rondas de verify; round 1 sobre el estado pre-rework (767 tests) y round 2 **APPROVED** sobre el estado final (770/770 tests, 45 files). Build prod OK (warning preexistente 702.90 kB > 500 kB).
- NO mergeado a main: el merge queda a criterio del flujo de branch de `feat/inventario-salida-traslado`.
- constancia de entrega al commit final 317c75a (entrega ampliada con el bugfix 828f477, ver nota post-archive)
