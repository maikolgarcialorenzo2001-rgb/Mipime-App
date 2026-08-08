# SDD — Tasks: `pendiente-detalles-opcionales`

> Artefacto de tareas (2026-08-08). Guardado también en Engram (`sdd/pendiente-detalles-opcionales/tasks` #522).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada y verificada. Apply: `sdd/pendiente-detalles-opcionales/apply-progress` (#523). Verify: `sdd/pendiente-detalles-opcionales/verify-report` (#525) — PASS con 1 warning resuelto.

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas (cambiadas) | < 200 (bajo): 4 archivos + 2 specs, sin generación ni migración |
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
| 1 | Exponer campos en service + tests | `feat(service): expose autorizadoPor and descripcion in listarPendientes` | service + spec; tests incluidos |
| 2 | Toggle "Ver detalles" en modal | `feat(ui): add "Ver detalles" toggle in cobro-pendiente-modal` | ts/html + spec; tests incluidos |

## Fase 1: Servicio (RED-first)

- [x] 1.1 [RED] `src/app/services/cobro-pendiente.service.spec.ts`: fixture de fila +2 columnas (`autorizado_por`, `descripcion`); asserts de mapping y de que el SELECT emitido contiene ambas columnas (`String(query).toContain`). ACEPT: test rojo por campos inexistentes. TEST: sí.
- [x] 1.2 [GREEN] `src/app/services/cobro-pendiente.service.ts`: extender `PendienteItem` con `autorizadoPor?/descripcion?`; ampliar SELECT con `autorizado_por, descripcion` y mapping `?? null` (patrón compradorNombre). NO tocar `WHERE forma_pago = 'pendiente' AND pagado_en IS NULL` (REQ-6) ni ORDER BY.
- [x] 1.3 [GREEN] Cerrar spec: asserts mapping + null (`toBeNull`); asserts existentes del WHERE quedan verdes. ACEPT: REQ-1 y REQ-6 satisfechos. TEST: sí. (Nota: toEqual del DTO completo actualizado con los 2 campos nuevos — Vitest rechaza keys extra.)

## Fase 2: Componente (toggle detalles + template + labels + tests)

- [x] 2.1 [RED] `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.spec.ts`: toggle expandir/colapsar con ambos campos; labels condicionales (solo autorizadoPor → sin "Descripción"; solo descripcion → sin "Autorizado por" — REQ-3); ambos null → sin botón ni bloque (REQ-4, como test de contraste); toggle idéntico en `soloLectura: true` sin emitir `cobroCompletado` (REQ-5); click del botón NO cambia la selección en modo cobrar (D3 `stopPropagation`); reset de expansiones al `setInput('cobroPendiente', nuevaRef)` (D2). ACEPT: falla por botón inexistente en template. TEST: sí.
- [x] 2.2 [GREEN] `cobro-pendiente-modal.component.ts`: `detallesAbiertos = signal<Set<number>>(new Set())` (D1); `toggleDetalle(id)` con mutación inmutable; `tieneDetalle(p) = !!(p.autorizadoPor ?? p.descripcion)` (D4); `effect` de reset al leer `cobroPendiente()` (D2).
- [x] 2.3 [GREEN] `cobro-pendiente-modal.component.html`: wrapper derecho (D5) total + botón secundario con chevron, `aria-expanded` y `(click)="toggleDetalle(p.id); $event.stopPropagation()"` (D3); bloque read-only `@if (detallesAbiertos().has(p.id) && tieneDetalle(p))` con labels condicionales "Autorizado por"/"Descripción". ACEPT: REQ-2..REQ-5; suite del componente en verde. TEST: sí.

## Fase 3: Verificación (test completo + build + commits)

- [x] 3.1 Ejecutar `ng test` completo (suite service + componente + existentes): 45 archivos / 758 tests TODO verde, sin regresión.
- [x] 3.2 Build de producción (script del repo) sin errores (solo warning pre-existente de budget).
- [x] 3.3 Commit unit 1 (service): `feat(service): expose autorizadoPor and descripcion in listarPendientes` → **`30feff0`** (incluye spec). — Ejecutado por el orquestador tras verify.
- [x] 3.4 Commit unit 2 (UI): `feat(ui): add "Ver detalles" toggle in cobro-pendiente-modal` → **`c02f233`** (incluye spec; incorpora el fix del warning `?? → ||` en `tieneDetalle` + test del caso mixto). — Ejecutado por el orquestador tras verify.

Rollback: revert display-only, sin migración ni cambios al flujo de cobro (del proposal).

## Verificación (sdd-verify, 2026-08-08)

- RED real confirmado: TS2339 en service (campos inexistentes) + 8 tests de componente (6 button-missing + 2 contraste REQ-4 reescritos).
- GREEN: suite completa **45 files / 758 tests PASS** (`ng test --watch=false`, Node 24.15.0 vía nvm4w); targeted 2 files / 37 tests PASS (14 service + 23 componente).
- Build producción ✅ (único warning pre-existente: bundle initial 702.63 kB > 500 kB, ajeno al cambio).
- Matriz REQ-1..REQ-6: **PASS** (evidencia línea a línea en verify-report #525).
- Diseño D1-D5: ✅ todos implementados según design (con 2 desviaciones menores documentadas en apply-progress).
- **WARNING 1 resuelto**: `tieneDetalle` usaba `??` (nullish) en vez de `||` (falsy) — caso mixto `autorizadoPor: ''` + `descripcion: 'x'` ocultaba el botón dejando 'x' inaccesible. Fix 1-liner `!!(p.autorizadoPor || p.descripcion)` + test del caso mixto, incorporado en `c02f233`. No rompe REQ-4 (definido por "ambos null").
- SUGGESTIONES del verify (a11y `aria-controls`, hit target del `li` flex-col, assert trivial `not.toContain`): no bloqueantes, aceptadas como están.
- Lint: 119 errores pre-existentes repo-wide; TS 0 errores en los 4 archivos del cambio; HTML: mismas 6 violaciones pre-existentes (patrón reubicado, NO nueva deuda).

## Nota para el orquestador (commits — RESUELTA)

- El working tree tenía cambios pre-existentes NO relacionados en `src/app/pages/pos/pos.page.ts` (`_auth` private→readonly, TS2341) y `pos.page.html` (spacing entre "Cobrar" y "Ver Pendientes"). NO se incluyeron en los 2 commits del change; se commitearon aparte como `b9463e0 fix(build): expose auth service to POS template` y `a69cfd8 fix(ui): separate pendientes section from Cobrar button`.
- Ejecutar tests con Node >= 24.15.0 (nvm4w): `PATH="/c/nvm4w/nodejs:$PATH" node node_modules/@angular/cli/bin/ng.js test`.

## Constancia de entrega

- **Cambio COMPLETE** — ciclo SDD cerrado (explore → proposal → spec → design → tasks → apply → verify → archive). Verify global **PASS**: 45 files / 758 tests (`ng test --watch=false`, Node 24.15.0). Build OK (warning de budget pre-existente no bloqueante).
- Commits de implementación en `deudas-features`: **`30feff0`** `feat(service): expose autorizadoPor and descripcion in listarPendientes` + **`c02f233`** `feat(ui): add "Ver detalles" toggle in cobro-pendiente-modal` (incluye fix del warning `?? → ||` en `tieneDetalle` + test del caso mixto).
- Commits de fixes POS asociados (cambios pre-existentes fuera del scope del change): **`b9463e0`** `fix(build): expose auth service to POS template` (TS2341) y **`a69cfd8`** `fix(ui): separate pendientes section from Cobrar button` (spacing).
- Warning del verify resuelto e incluido en `c02f233`: `tieneDetalle()` pasó de `??` a `||` con test del caso mixto (`autorizadoPor: ''` + `descripcion: 'x'`) — el botón ya no se oculta cuando un campo vacío convive con otro con valor.
- NO mergeado a main: el merge queda a criterio del flujo de branch de `deudas-features`.
- constancia de entrega al commit final <<FINAL_COMMIT>>
