# SDD — Spec (delta): `pendiente-detalles-opcionales`

> Artefacto de spec (2026-08-08). Guardado también en Engram (`sdd/pendiente-detalles-opcionales/spec` #521).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada y verificada PASS (45 files / 758 tests; engram `sdd/pendiente-detalles-opcionales/verify-report` #525). Requisitos REQ-1..REQ-6 cumplidos.

## Capacidad

`pendientes-cobro` — listado de ventas pendientes de cobro + visualización read-only de sus detalles opcionales. SPEC NUEVA (ninguna spec existente cubre el listado de pendientes; confirmado en proposal). Display-only: sin migración ni cambios de esquema (`autorizado_por`/`descripcion` existen en `ventas` desde schema v6, db-migrations.ts:321-322).

## Requisitos

| ID | Enunciado (VERBO + resultado observable) | Prio | Categoría |
|----|------------------------------------------|------|-----------|
| REQ-1 | EXPONER `autorizadoPor?` y `descripcion?` en `PendienteItem` mapeados desde `autorizado_por`/`descripcion` en `listarPendientes()` | P1 | FUNCIONAL |
| REQ-2 | MOSTRAR por fila de pendiente un botón read-only "Ver detalles" que expanda/colapse el bloque de detalle (toggle) | P1 | FUNCIONAL |
| REQ-3 | RENDERIZAR en el detalle la label "Autorizado por" SOLO si `autorizadoPor` tiene valor, y "Descripción" SOLO si `descripcion` tiene valor | P1 | FUNCIONAL |
| REQ-4 | OCULTAR el botón "Ver detalles" cuando ambos campos son null (pendientes históricos) | P2 | FUNCIONAL |
| REQ-5 | OPERAR el toggle idéntico en modos `cobrar` y `soloLectura` del modal | P1 | FUNCIONAL |
| REQ-6 | CONSERVAR `WHERE forma_pago='pendiente' AND pagado_en IS NULL` en el SELECT (guard regresión) | P1 | CONSTRAINTS |

## Escenarios (Gherkin)

### REQ-1 — Service expone los campos opcionales
- Dado ventas pendientes con `autorizado_por='María'` y `descripcion='Se lo lleva en cuenta'` en la tabla
- Cuando `listarPendientes()` ejecuta el SELECT y mapea filas
- Entonces cada `PendienteItem` expone `autorizadoPor: 'María'` y `descripcion: 'Se lo lleva en cuenta'`
- Y el SELECT incluye ambas columnas (assert sobre el SQL emitido)

### REQ-2 + REQ-3 — Detalle con ambos campos
- Dado un pendiente con `autorizadoPor` y `descripcion` con valor, en el modal
- Cuando el usuario toca "Ver detalles"
- Entonces se expande un bloque read-only con "Autorizado por: María" y "Descripción: Se lo lleva en cuenta"
- Y al tocar de nuevo, el bloque colapsa

### REQ-3 — `descripcion` null
- Dado un pendiente con `autorizadoPor` con valor y `descripcion` null
- Cuando se expande el detalle
- Entonces se muestra "Autorizado por"
- Y la label "Descripción" NO se renderiza

### REQ-3 — `autorizadoPor` null
- Dado un pendiente con `descripcion` con valor y `autorizadoPor` null
- Cuando se expande el detalle
- Entonces se muestra "Descripción"
- Y la label "Autorizado por" NO se renderiza

### REQ-4 — Ambos campos null (histórico)
- Dado un pendiente histórico con `autorizadoPor` null y `descripcion` null
- Cuando la lista se presenta en el modal
- Entonces la fila NO muestra el botón "Ver detalles" (sin estado vacío adicional)

### REQ-5 — Modo soloLectura
- Dado el modal con `soloLectura=true` ("Ver Pendientes") y una fila con detalles
- Cuando el usuario toca "Ver detalles"
- Entonces el bloque expande/colapsa igual que en modo `cobrar`
- Y la fila NO dispara selección de cobro ni emite `cobroCompletado`

### REQ-6 — Regresión del filtro
- Dado ventas con `forma_pago='pendiente'` y `pagado_en` NOT NULL, y ventas con `forma_pago='efectivo'` y `pagado_en` IS NULL
- Cuando `listarPendientes()` devuelve resultados
- Entonces ninguna de esas filas aparece en el listado (solo `pendiente` sin pagar)

## Nota (UI copy en español)
- Botón: "Ver detalles" (toggle expandir/colapsar con chevron). Labels: "Autorizado por" y "Descripción".
- Cada label SOLO se renderiza si su campo tiene valor (no null ni vacío).
- Bloque de detalle 100% read-only en AMBOS modos (sin inputs ni edición). `compradorNombre` ya visible; NO hay campos teléfono/CI (no existen en el código).
