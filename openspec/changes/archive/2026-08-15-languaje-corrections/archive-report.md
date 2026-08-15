# Archive Report: languaje-corrections

**Archived**: 2026-08-15
**SDD Cycle**: Complete ✅
**Branch**: `languaje-corrections` (base `d2d60e2`) — 5 commits, listos para PR single hacia `main` (delivery_strategy: single-pr)

## Verification Summary (estado FINAL al cierre)

| Check | Status |
|-------|--------|
| Verify verdict | ✅ PASS — 16/16 escenarios, 5/5 requirements (`verify-report.md`, `gentle-ai.verify-result/v1`) |
| Tests | ✅ 915 passed / 0 failed / 0 skipped — 47 test files (`bunx vitest run`, exit 0) |
| Build | ✅ `npx ng build` exit 0 (warnings pre-existentes NG8102 + bundle budget) |
| Lint | ✅ 0 errores NUEVOS; 117 errores pre-existentes (deuda BACKLOG-11, verificados contra base `d2d60e2`) |
| Tasks | ✅ 18/18 completos (`tasks.md` tiene 18 tasks, no 20; los 18 están `[x]`) |
| Closing greps | ✅ 0 `currency:'ARS'` · 0 voseo imperativos · 0 `La acceso`/`Error al registro` · 0 `CUP`/`pesos cubanos` en `src/` |
| CRITICAL / WARNING | ✅ Ninguno en el verify final |

> **Nota de estado final (jerarquía de autoridad)**: `apply-progress.md` (snapshot intermedio) reporta 4 commits y 908 tests. Tras esa fase, el verify-FAIL original detectó huecos (2 CRITICAL UNTESTED, 2 WARNING PARTIAL) que se cerraron con +7 tests de remediación en un quinto commit POST-verify `7a49f30`. El estado FINAL al cierre es **5 commits / 915 tests / PASS**, según verify-report y la confirmación del orquestador. `apply-progress` no registra el 5.º commit porque se escribió antes; no refleja el estado de cierre.

## Commits (estado final)

| Hash | Mensaje | Work unit |
|------|---------|-----------|
| `8ebdbb0` | `feat(pesos): add PesosPipe and MONEDA_LOCAL constant` | 1 |
| `d210855` | `feat(pesos): migrate 46 currency call-sites to the pesos pipe` | 2 |
| `2a42232` | `fix(ui): neutralizar voseo rioplatense y errores gramaticales` | 3 |
| `77f907b` | `fix(excel): usar etiquetas de divisa neutras en reportes` | 4 |
| `7a49f30` | `test(ui): cubrir textos neutralizados de divisas, errores y empty-states` | POST-verify (remediación; +7 tests) |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| local-currency | Created | 1 requirement, 3 escenarios (nueva capability: moneda local = pesos genérico, `PesosPipe` + `MONEDA_LOCAL`) |
| neutral-language | Created | 2 requirements, 4 escenarios (nueva capability: imperativos neutros + errores gramaticales) |
| checkout | Updated | Requirement «5 opciones de pago — Sub-formulario divisas» MODIFIED: + párrafo español neutro, + 2 escenarios («Complete», «Reduzca») → 6 escenarios |
| excel-reportes | Updated | ADDED requirement «Etiquetas de divisa neutras en reportes» (+3 escenarios) |

Main specs: `openspec/specs/local-currency/spec.md`, `openspec/specs/neutral-language/spec.md` (copy mecánica con `diff -r` vacío), `openspec/specs/checkout/spec.md`, `openspec/specs/excel-reportes/spec.md` (merge de deltas; requirements no mencionados preservados).

## Archive Contents

- proposal.md ✅
- specs/local-currency/spec.md ✅ (full spec)
- specs/neutral-language/spec.md ✅ (full spec)
- specs/checkout/spec.md ✅ (delta)
- specs/excel-reportes/spec.md ✅ (delta)
- design.md ✅
- tasks.md ✅ (18/18 tasks complete, 0 unchecked)
- apply-progress.md ✅ (snapshot intermedio; 4 commits/908 tests — ver nota de estado final)
- verify-report.md ✅ (reporte PASS oficial)
- archive-report.md ✅ (este archivo)

## Fuentes leídas (traza)

Artefactos de fase en filesystem (artifact_store hybrid; no hubo observation IDs de Engram para las fases previas):
- `openspec/changes/archive/2026-08-15-languaje-corrections/{proposal,design,tasks,apply-progress,verify-report}.md`
- `openspec/changes/archive/2026-08-15-languaje-corrections/specs/{local-currency,neutral-language,checkout,excel-reportes}/spec.md`
- `openspec/specs/{checkout,excel-reportes}/spec.md` (main specs previos)
- Status nativo `gentle-ai sdd-status` (taskProgress 18/18, dependencies.archive: ready)

## Review Gate

`reviewGate` estructuralmente ausente en el status nativo (kill switch off / sin review descubierto para este candidate). `reviewOffer` presente en el mismo output es una invitación, no una gate — el archivo procede bajo política ordinaria sin bloquear.

## Deuda / Notas de cierre

- **Lint 117 pre-existentes** (BACKLOG-11): la repo completa queda en 117 errores + 3 warnings hasta integrar `lint-errors-resolution`. NO introducidos por este change (verificados contra base `d2d60e2`).
- **Sugerencia de verify**: `estimadoDivisa = total / tasa` (float) vs spec `Math.ceil` — pre-existente, fuera del delta.
- **Desviación documentada (apply-progress)**: `checkout-modal` y `cobro-pendiente-modal` mantienen `CurrencyPipe` ADEMÁS de `PesosPipe` en `imports` — necesario por las 2 excepciones divisa (`currency: divisaTipo()==='USD' ? 'USD' : 'EUR'`) en sus templates.

## SDD Cycle Complete

El change `languaje-corrections` fue completamente planificado, implementado, verificado y archivado.

**Next**: PR single `languaje-corrections` → `main` (5 commits; los +7 tests de remediación del commit `7a49f30` ya están en el working tree de la branch). Fuera de scope: `lint-errors-resolution` (BACKLOG-11).
