# SDD — Exploration: `pendiente-detalles-opcionales`

> Artefacto de exploración (2026-08-08). Guardado también en Engram (`sdd/explore/pendiente-detalles-opcionales` #518).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada y verificada PASS (45 files / 758 tests; engram `sdd/pendiente-detalles-opcionales/verify-report` #525).

## Executive summary

Las ventas pendientes ya persisten `comprador_nombre` / `autorizado_por` / `descripcion` en la fila `ventas` (INSERT venta.service.ts:130-144; columnas desde schema v6, db-migrations.ts:308-323), pero `listarPendientes()` **NO selecciona** `autorizado_por` ni `descripcion` → los datos existen en la DB pero quedan ausentes de `PendienteItem` y por lo tanto invisibles en el cobro-pendiente-modal.

El GAP es de **shape y display**, no de almacenamiento: basta extender el DTO + el SELECT existente (misma fila, sin fetch extra) y agregar un toggle read-only por fila en el modal. Cambio display-only, sin migración.

**Caveat para el usuario**: NO existen campos teléfono/CI en todo el repo (grep `src/` + `electron/`: 0 coincidencias de datos). El único "detalle opcional" registrado en el checkout es `descripcion` (textarea opcional, también visible en cuenta_cosas); `autorizadoPor` es requerido en el checkout de pendientes. Aclarado antes de diseñar (riesgo pre-condición).

## Estado actual (file:line)

- **`PendienteItem`** (cobro-pendiente.service.ts:9-15) = `{ id, compradorNombre?, fechaHora, total, jornadaId }`; creado por `listarPendientes()` (ts:50-70): `SELECT id, comprador_nombre, fecha_hora, total, jornada_id FROM ventas WHERE forma_pago='pendiente' AND pagado_en IS NULL`. SQLite local vía token `DATABASE` — sin capa API/backend.
- **Captura en checkout** (checkout-modal.component.ts:6-15, 143-150; html 228-267): `compradorNombre` (requerido pendiente), `autorizadoPor` (requerido), `descripcion` (opcional textarea). NO existe teléfono/CI en ningún lado.
- **Persistencia**: pos.page.ts:246-259 → `VentaService.registrar` → INSERT venta.service.ts:130-144 (comprador_nombre, autorizado_por, descripcion). Schema db-migrations.ts v6 (308-323) incluye las 3 columnas; v16 (566-572) agrega `cobro_de_venta_id` + `pagado_en`.
- **Rendering actual**: cobro-pendiente-modal.component.html:31-54 — `ul` + `@for` sobre `cobroPendiente()`; fila = nombre `?? 'Pendiente #id'` + fecha + total; click → `seleccionar(id)` solo en modo cobrar; `soloLectura` ("Ver Pendientes") filas no interactivas. La `descripcion` no se muestra en ningún lado.

## Gap analysis

1. **Persistencia de detalles opcionales** — YA EXISTE (v6+). Los 3 campos quedan guardados en la fila `ventas`.
2. **Exposición en la lista** — FALTA. `listarPendientes` no selecciona `autorizado_por` ni `descripcion` → datos en DB, ausentes en `PendienteItem`.
3. **Display en el modal** — FALTA. Ninguna vista muestra la `descripcion`; sin toggle ni bloque read-only.
4. **Teléfono/CI** — NO EXISTEN (pre-condición del usuario incorrecta). Aclarado: la única "descripción opcional" es `descripcion`.

## Verdict

**YES con gap menor de shape.** `descripcion` + `autorizadoPor` ya persisten en la fila `ventas`; solo falta exponerlos en `PendienteItem` (extender SELECT) y mostrarlos con un toggle. Sin fetch extra (misma fila), sin migración, sin cambios backend.

## Enfoque recomendado

1. Extender `PendienteItem` con `autorizadoPor?`/`descripcion?` + ampliar el SELECT de `listarPendientes()` (+ spec).
2. En cobro-pendiente-modal agregar toggle por fila **"Ver detalles"** (expand/collapse read-only) mostrando `autorizadoPor` + `descripcion` si presentes; activo en ambos modos (cobrar y soloLectura); ocultar el bloque cuando ambos campos son null.
3. TDD estricto del repo (RED primero, Vitest vía `ng test`, specs en español).

Files: `src/app/services/cobro-pendiente.service.ts` (+spec), `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.ts/.html` (+spec).

## Riesgos

- **Pre-condición del usuario (phone/CI en checkout) no existe en el código** — aclarado antes de diseñar (fuera de scope, confirmado en proposal).
- **Pendientes históricos con `descripcion` null** — la UI debe ocultar botón/bloque vacíos (requisito explícito REQ-4 en spec).
- **Regresión del filtro** al tocar el SELECT — conservar literal `WHERE forma_pago='pendiente' AND pagado_en IS NULL` (guard REQ-6).
