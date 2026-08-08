# SDD — Proposal: `pendiente-detalles-opcionales`

> Artefacto de propuesta (2026-08-08). Guardado también en Engram (`sdd/pendiente-detalles-opcionales/proposal` #519).

## Intención

El usuario no puede ver los detalles opcionales (`autorizadoPor` "Autorizado por" y `descripcion` "Descripción") de las ventas pendientes desde la lista del cobro-pendiente-modal. Los datos ya se persisten en la fila `ventas` (INSERT venta.service.ts:130-144, columnas `autorizado_por`/`descripcion` desde schema v6), pero `listarPendientes()` no los expone y la UI no los muestra. Este cambio es **display-only**: exponer los campos hasta la UI con un toggle "Ver detalles" read-only por fila. Sin migración, sin cambios de esquema ni backend.

## Alcance

### In scope
- Extender `PendienteItem` (cobro-pendiente.service.ts:9-15) con `autorizadoPor?` y `descripcion?`
- Ampliar el SELECT de `listarPendientes()` (ts:50-70) incluyendo `autorizado_por`, `descripcion`; **conservar** `WHERE forma_pago='pendiente' AND pagado_en IS NULL`
- Botón **"Ver detalles"** por fila en cobro-pendiente-modal (html:31-54): toggle expand/collapse read-only mostrando "Autorizado por" y "Descripción"; activo en modos `cobrar` y `soloLectura` ("Ver Pendientes")
- Ocultar el bloque de detalle cuando ambos campos son null (pendientes históricos)
- Tests unitarios TDD (Vitest vía `ng test`, RED primero, specs en español, co-located `*.spec.ts`)

### Out of scope
- Campos teléfono/CI (no existen en el código — aclarado en explore)
- Cambios en checkout-modal o en la captura de datos
- Migración de datos (las columnas ya existen)
- Cambios backend/API (SQLite local vía token DATABASE)

## Capacidades

### Nuevas
- `pendientes-cobro`: listado de ventas pendientes + visualización read-only de sus detalles opcionales (autorizadoPor, descripcion)

### Modificadas
- None (ninguna spec existente cubre el listado de pendientes)

## Enfoque

1. **Data layer**: extender el SELECT existente — ambos campos vienen en la misma fila, sin fetch extra.
2. **UI**: signal `detalleAbiertoId` en el componente; toggle por fila con chevron; bloque de detalle renderizado con `@if` cuando `autorizadoPor || descripcion`.
3. **TDD estricto**: specs del service (shape del SELECT) y del componente (toggle en ambos modos, filas null ocultas).

## Áreas afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/app/services/cobro-pendiente.service.ts` (+spec) | Modified | `PendienteItem` + SELECT de `listarPendientes()` |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.ts` | Modified | Signal de toggle por fila |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.html` | Modified | Botón + bloque de detalle read-only |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.spec.ts` | Modified | Tests de ambos modos |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Perder el filtro `pagado_en IS NULL` al tocar el SELECT | Baja | Revisión explícita del WHERE en review; tests existentes del service (REQ-6) |
| Pendientes históricos con campos null | Baja | UI oculta bloque de detalle vacío (requisito explícito REQ-4 en spec) |
| Rotura de modos cobrar/soloLectura | Baja | Tests de componente cubren ambos modos (REQ-5) |

## Plan de rollback

Revert del commit: cambio display-only en 2-3 archivos, sin migración ni cambios de esquema. Quitar el toggle no afecta el flujo de cobro (la fila clickeable del modo cobrar queda intacta).

## Dependencias

- Ninguna. Columnas `autorizado_por`/`descripcion` ya existen en schema v6.

## Criterios de éxito

- [x] `listarPendientes()` mapea `autorizadoPor` y `descripcion` en `PendienteItem` (REQ-1)
- [x] "Ver detalles" expande/colapsa por fila en ambos modos del modal (REQ-2/REQ-5)
- [x] Labels condicionales: cada una SOLO si su campo tiene valor (REQ-3)
- [x] Filas sin detalles no muestran botón ni bloque vacío (REQ-4)
- [x] Suites de service y componente en verde (RED primero); `ng test` completo en verde (758 tests)
