# SDD — Design: `inventario-salida-traslado`

> Artefacto de diseño (2026-08-08). Guardado también en Engram (`sdd/inventario-salida-traslado/design` #532).
> **REVISADO (mid-flight)**: el formulario de salida renombrado a "Traslado" exige (a) selector de UBICACIÓN DE ORIGEN OBLIGATORIO (Tienda `'shop'` | Almacén `'almacen'`) y (b) selector de LOTE OBLIGATORIO filtrado por la ubicación elegida. NO existe opción "FIFO automático (sin lote)". El servicio NO cambia en esta revisión: `registrarSalida` ya acepta `ubicacion` (5º) y `loteId?` (6º) — implementado y verificado en round 1 (commit `3f048fb`); esta revisión solo reworkea la UI (page ts/html + spec).

## 1. Contrato de servicio (round 1, FINAL — no se toca en la ronda UI)

```ts
async registrarSalida(
  productoId: number,
  cantidad: number,
  motivo?: string,
  jornadaId?: number,
  ubicacion: 'almacen' | 'shop' = 'shop',
  loteId?: number,
): Promise<ConsumoRecord[]>
```

- `loteId` undefined → FIFO (usado por cuenta-cosa y venta — NO cambian).
- El formulario "Traslado" SIEMPRE pasa `ubicacion` + `loteId` (nunca undefined).
- `_consumirFIFO` con `loteId` hace pre-check (SELECT `WHERE id = ? AND producto_id = ? AND ubicacion = ?`) y tira 'Stock insuficiente' ANTES de cualquier UPDATE (sin consumo parcial); query de consumo con `AND id = ?`; safety-net de fabricación de lote solo con `loteId === undefined`. Listo y testeado (round 1).

## 2. Estado del componente (REWORK UI)

Signals/computed nuevos en inventario.page.ts:

- `salidaUbicacion = signal<'almacen' | 'shop' | null>(null)` — origen elegido, OBLIGATORIO, sin default (el usuario debe elegir).
- `lotesDeUbicacion = computed(() => salidaUbicacion() ? productoLotes().filter(l => l.ubicacion === salidaUbicacion() && l.cantidad > 0) : [])` — reemplaza al `lotesAlmacen` de la versión previa (lote opcional).
- `selectedLoteIndex` (1-based, null) — reutilizado; OBLIGATORIO para salida.
- Al abrir la acción salida: NO auto-seleccionar ubicación ni lote. Al cambiar `salidaUbicacion` (`onSalidaUbicacionChange`, ts:87): reset `selectedLoteIndex` a null. Al cambiar de producto/acción: reset ambos (cubierto por `onSelectAction` y reset post-submit, ts:219-220/290-291).
- Validación de envío: `registrarSalida` solo se llama si `salidaUbicacion()` y `selectedLoteIndex()` están definidos; si no, submit deshabilitado (html:342: `procesandoMovimiento() || (selectedAction()?.tipo === 'salida' && (salidaUbicacion() === null || selectedLoteIndex() === null))`).

## 3. Template

- Rename YA HECHO: `inventario.page.html:88` "Salida" → "Traslado" (ícono `remove_circle` + naranja + handler intactos). Chip historial :396 "Salida" NO se toca.
- Bloque nuevo en el form de salida (html:256-273):
  - Selector de ubicación (obligatorio): dos opciones "Tienda" / "Almacén" — segmented control/select alineado con el estilo del repo. Mapeo UI → valor: "Tienda" → `'shop'`, "Almacén" → `'almacen'`. Sin default (`[value]="salidaUbicacion() ?? ''"`).
  - Dropdown de lotes (obligatorio): iterar `lotesDeUbicacion()`, opción placeholder "Seleccioná un lote…" (value vacío, NO "FIFO automático"), options `Lote #{{i+1}} — {{lote.cantidad}}u — ${{lote.precio_costo}}`; deshabilitado hasta elegir ubicación (`[disabled]="!salidaUbicacion()"`); sin lote elegido o sin lotes en la ubicación → submit deshabilitado.
- Campos Cantidad + Motivo intactos.
- Submit `case 'salida'` (ts:145-152): `lote = lotesDeUbicacion()[selectedLoteIndex - 1]`; SIEMPRE `registrarSalida(productoId, cantidad, motivo, undefined, salidaUbicacion(), lote.id)`.

## 4. Plan de tests (REWORK)

inventario.page.spec.ts (tests 12.x):
- (a) sin ubicación elegida el dropdown está deshabilitado y el submit no llama `registrarSalida`; (b) elegir ubicación "Tienda" lista SOLO lotes de tienda; "Almacén" solo almacén (contraste); (c) cambiar ubicación resetea `selectedLoteIndex` y refiltra (S-08); (d) sin lote elegido no llama `registrarSalida`; (e) con ubicación+lote envía `(productoId, cantidad, motivo, undefined, ubicacion, loteId)`; (f) no existe la opción "FIFO automático".
- Rename asserts (ya hechos): botón "Traslado" (tests 7/8: admin sí, no-admin no).
- Servicio: NO cambia (tests ya verdes desde round 1: loteId consume solo ese lote, 'Stock insuficiente' sin mutación, callers FIFO intactos).

## 5. Archivos

| Archivo | Acción | Qué |
|---|---|---|
| src/app/pages/inventario/inventario.page.ts | Modified | signal `salidaUbicacion` + computed `lotesDeUbicacion` + validación submit + reset al cambiar ubicación |
| src/app/pages/inventario/inventario.page.html | Modified | selector de ubicación + dropdown de lotes obligatorios (sin opción FIFO), :88 "Traslado" |
| src/app/pages/inventario/inventario.page.spec.ts | Modified | tests obligatoriedad + filtrado por ubicación + reset + args submit + no-FIFO |
| src/app/services/stock-movimiento.service.ts | Modified (round 1) | `registrarSalida` + `loteId?` aditivo; `_consumirFIFO` pre-check + `AND id = ?` — ya implementado, NO se toca en la ronda UI |
| src/app/services/stock-movimiento.service.spec.ts | Modified (round 1) | tests lote específico + exceso sin mutación — ya verdes |

## Decisions

| Decisión | Alternativa | Racional |
|---|---|---|
| Selector de ubicación sin default (null) | Default 'almacen' | REQ-4: "tenga que seleccionar de dónde" — obligatorio explícito |
| Lote OBLIGATORIO sin opción FIFO en UI | Opción "FIFO automático" (scope original) | REQ-5 (evolución): el usuario decide lote siempre; FIFO queda solo para callers internos (venta/cuenta-cosa) |
| `lotesDeUbicacion` computed único | Filter inline + remapeo | Índices consistentes, sin drift (mismo patrón que `lotesAlmacen` previo) |
| Servicio sin cambios en la ronda UI | Parametrizar origen/destino | La operación sigue siendo salida destructiva; el origen se pasa como `ubicacion` existente |
| Pre-check (SELECT) antes de cualquier UPDATE en `_consumirFIFO` | Dejar que el UPDATE falle y revertir | Sin consumo parcial garantizado (REQ-7): throw 'Stock insuficiente' sin mutar; costo 1 query extra aceptado |

## Data flow

```
InventarioPage.onSubmitMovimiento('salida')
  └─ (validación UI: salidaUbicacion() && selectedLoteIndex() obligatorios — html:342)
  └─ registrarSalida(id, cantidad, motivo, undefined, salidaUbicacion(), lote.id)
      └─ _consumirFIFO(id, cantidad, ubicacion, loteId)
          ├─ loteId → pre-check (SELECT; falla → throw 'Stock insuficiente', sin mutar)
          └─ UPDATE lotes_stock (solo el lote objetivo)
  ├─ INSERT stock_movimientos tipo 'salida'
  └─ UPDATE productos.stock_<ubicacion> = SUM(lotes de esa ubicación)
```

## Migración / Rollback

Sin migración. `stock_movimientos` NO tiene columna `lote_id` (REQ-6 sancionado: la granularidad de lote queda en el ConsumoRecord devuelto, patrón venta→venta_lotes; si el negocio exige trazabilidad a nivel movimiento, es un change futuro con migración — opción v18). Rollback = revert git de los commits del change (`3f048fb` + `9f5926e`). `ng test` (Node ≥ 24.15.0, `PATH="/c/nvm4w/nodejs:$PATH"`).

## Preguntas Abiertas (RESUELTAS)

1. **Granularidad de lote en el movimiento (REQ-6)**: `stock_movimientos` no tiene `lote_id`; se implementa según design (sin migración) — el detalle de lote vive en el ConsumoRecord. Sancionado; follow-up opcional (migración v18) documentado en la constancia.
2. **Ninguna otra bloqueante.**
