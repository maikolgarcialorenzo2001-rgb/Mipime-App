# SDD — Verify Report: `fix-reanudar-jornada-acceso` (MERGE PR 1 + PR 2 + PR 3 + PR 4)

> Reporte combinado (2026-08-08). PR 1: rama `pr1-query-abierta`. PR 2: rama `pr2-login` (base PR 1).
> PR 3: rama `pr3-purga-auto-cierre` (base PR 2). PR 4: rama `pr4-excel` (base PR 3).
> Modo: **Strict TDD**. Runner: `npx vitest run`.

## Verdicts por slice

| Slice | Rama | Verdict | Resumen |
|---|---|---|---|
| PR 1 | `pr1-query-abierta` | PASS | 764 tests; FR-1 COMPLIANT (query sin fecha LIMIT 1). Sin hallazgos. |
| PR 2 | `pr2-login` | PASS | 767 tests; FR-2/3/4 COMPLIANT. SUGGESTION: `formatearFecha` sin guard no-ISO. |
| PR 3 | `pr3-purga-auto-cierre` | PASS | 756 tests; purga autoCerrarSiOtroUsuario verificada (0 callers productivos). Sin hallazgos. |
| **PR 4** | `pr4-excel` | **FAIL** | FR-6 COMPLIANT (9/9 escenarios) y 768/768 tests verdes, pero `tsc --noEmit` falla: TS1117 propiedad duplicada `jornada.service.ts:309-310`. Fix trivial. |

---

## PR 4 — Verify (slice Excel, tareas 4.1–4.4)

## Verdict PR 4: **FAIL** (build roto)

FR-6 está implementado y 100% cubierto por tests que pasan (768/768), pero **`npx tsc --noEmit -p tsconfig.app.json` falla**
con TS1117 por una propiedad duplicada en `jornada.service.ts:309-310`. El apply-progress reportó
"tsc --noEmit limpio" — **incorrecto**. Esto rompe `ng build` (AOT usa tsc). TDD/requisitos OK; build NO.

## Cumplimiento tareas 4.1–4.4 (FR-6 / AC6 / excel-reportes)

| Tarea | Estado | Evidencia |
|---|---|---|
| 4.1 (RED) spec service | ✅ | 6 tests nuevos `userAperturaNombre en cierre y exportaciones` (L1730-1885) + 1 mock extra en test de arqueo (L1148). Pasan 168/168 targeted. |
| 4.2 (GREEN) `_ejecutarCierre` + `_recolectarDatosJornada` | ✅ | `jornada.service.ts:471-478` (`SELECT nombre FROM usuarios WHERE id = user_apertura_id` con guard `!== null`) y `:709-714` (LEFT JOIN única `jornadas j LEFT JOIN usuarios u ON u.id = j.user_apertura_id WHERE j.id = ?`). |
| 4.3 (RED) spec excel | ✅ | 6 tests nuevos `FR-6 — Abierta por / Cerrada por (firma condicional)` excel.service.spec (L1758-1863). Verifican Resumen Y JornadaSheet del mensual, A≠B, A=B y legacy NULL. |
| 4.4 (GREEN) `JornadaReportData.userAperturaNombre` + condicional D5 | ✅ | `excel.service.ts:43` (campo aditivo opcional) y bloques `:176-180` y `:597-601` (firma condicional exacta a D5). |

## Cumplimiento FR-6 (spec 03-spec.md L42-53)

- `JornadaReportData.userAperturaNombre?: string | null` — **existe** (`excel.service.ts:43`). ✅
- `_ejecutarCierre` resuelve nombre con `user_apertura_id` (`jornada.service.ts:471-478`). ✅
- `_recolectarDatosJornada` LEFT JOIN única (`jornada.service.ts:709-714`). ✅
- Ambos sheets condicional A≠B → "Abierta por"/"Cerrada por"; A===B o apertura NULL → "Firmado por" idéntico a antes. ✅ (back-compat preservado por estructura D5).
- Sin cambios de esquema; sin tocar login/pos; sin reescribir deltas openspec (diff solo: 2 services + 2 specs + 05-tasks.md). ✅
- Sin push/merge: `git status -sb` = `## pr4-excel` (sin upstream), worktree limpio, 2 commits (`7ec8956` feat + `a5dd26b` docs). ✅

## Resultados comandos

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | ❌ exit 2 — `TS1117` `jornada.service.ts(310,7)` |
| `npx vitest run src/app/services/jornada.service.spec.ts src/app/services/excel.service.spec.ts` | ✅ 2 files / **168 passed** |
| `npx vitest run` | ✅ **45 files / 768 passed** |

## Spec Compliance Matrix (PR 4 — FR-6, AC6)

| Escenario | Test | Resultado |
|---|---|---|
| A≠B → "Abierta por Ana"+"Cerrada por Beto" (Resumen) | `excel.service.spec > RED: A≠B — Resumen...` | ✅ COMPLIANT |
| A≠B → idem (JornadaSheet mensual) | `excel.service.spec > RED: A≠B — hoja de jornada...` | ✅ COMPLIANT |
| A===B → única "Firmado por" (Resumen) | `excel.service.spec > RED: A===B — Resumen...` | ✅ COMPLIANT |
| A===B → única "Firmado por" (JornadaSheet) | `excel.service.spec > RED: A===B — hoja...` | ✅ COMPLIANT |
| legacy NULL apertura → "Firmado por" (Resumen) | `excel.service.spec > RED: apertura NULL — Resumen...` | ✅ COMPLIANT |
| legacy NULL → "Firmado por" (JornadaSheet) | `excel.service.spec > RED: apertura NULL — hoja...` | ✅ COMPLIANT |
| `_ejecutarCierre` resuelve+nombra apertura | `jornada.service.spec 4.1 RED...` | ✅ COMPLIANT |
| id apertura inexistente / NULL → null sin query | `jornada.service.spec 4.2/4.3` | ✅ COMPLIANT |
| `_recolectarDatos` LEFT JOIN + propagación Mensual/Rango/obtenerDatos | `jornada.service.spec 4.4-4.6` | ✅ COMPLIANT |

**Compliance summary**: 9/9 escenarios FR-6 COMPLIANT en runtime.

## Correctness (Static)

| Requisito | Status | Notas |
|---|---|---|
| Campo aditivo opcional | ✅ Implementado | `excel.service.ts:43` |
| Query nombre aperturista en `_ejecutarCierre` | ✅ Implementado | `jornada.service.ts:471-478` |
| LEFT JOIN única en `_recolectarDatosJornada` | ✅ Implementado | `jornada.service.ts:709-714` |
| Propagar `userAperturaNombre` a todas las exportaciones | ✅ Implementado | L528/L766 (datos), L310 (duplicado), L566/L598/L854 (mappers) |
| Firma condicional D5 en ambos sheets | ✅ Implementado | `excel.service.ts:176-180`, `:597-601` |
| Back-compat A===B y legacy NULL | ✅ Implementado | branch `else if (userCierreNombre)` idéntico al previo |
| Tipo-check compila | ❌ **FALLADO** | TS1117 propiedad duplicada `jornada.service.ts:309-310` |

## Coherence (Design D4/D5)

| Decisión | ¿Seguida? | Notas |
|---|---|---|
| Resolución en los mismos puntos que `userCierreNombre` | ✅ Yes | `_ejecutarCierre` L471 (jornada via RETURNING), `_recolectarDatos` L709 (LEFT JOIN). |
| `userAperturaNombre` opcional aditivo | ✅ Yes | No rompe snapshots/consumidores. |
| Back-compat "Firmado por" | ✅ Yes | Branch condicional exacto al diseño. |
| LEFT JOIN única 1 query | ✅ Yes | Solo la de L709-714. |
| SIN cambios de esquema / SIN migraciones | ✅ Yes | diff no incluye migraciones. |

## TDD Compliance (Strict)

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | apply-progress PR4: RED "solo los 2 tests A≠B" (83/85 ya pasaban por back-compat) → GREEN 768/768. |
| All tasks have tests | ✅ | 4.1-4.4 con 12 tests nuevos + mock extra arqueo. |
| RED confirmed (tests existen) | ✅ | 12 tests nuevos en 2 files; todos corren y pasan. |
| GREEN confirmed (pasan al ejecutar) | ✅ | 168 targeted + 768 suite, ejecutado en vivo. |
| Triangulation adequate | ✅ | 3 comps x 2 sheets (excel) + 6 escenarios (service). |
| Safety Net para specs modificados | ✅ | Reportado 83/85 (2 RED expected fail por A≠B) — archivos no nuevos (modificados) con net previa. |

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 768 | 45 | vitest |

## Changed-File Coverage

Coverage analysis skipped — ninguna herramienta de cobertura configurada en capabilities (no es fallo).

## Assertion Quality

✅ Sin tautologías, ghost loops, ni smoke-only. Los tests A≠B asertan contenido REAL parseado del XLSX (`sheet_to_json` → `toContainEqual(['Abierta por','Ana'])`) y ausencia de caso (`some(...)==='Firmado por' === false`). Los tests de service asertan propagación del valor y la query LEFT JOIN con params `[10]` — verifican comportamiento real del SQL.

## Issues Found (PR 4)

**CRITICAL**:
- `src/app/services/jornada.service.ts:309-310` — Propiedad `userAperturaNombre` DUPLICADA en el mismo object literal dentro de `_generarYGuardarExcel` (una con indentación de 14 espacios). Rompe `tsc --noEmit` (TS1117) y por lo tanto `ng build`. Tests pasan porque vitest transforma sin type-check y en runtime la última gana (mismo valor). **Fix**: borrar UNA de las dos líneas (309 o 310).
- Consecuencia: la afirmación de apply-progress "tsc --noEmit limpio" es incorrecta → estado reportado engañoso.

**WARNING**:
- `jornada.service.ts:566`, `:598`, `:854` — indentación de `userAperturaNombre:` con 14 espacios (estilo inconsistente con el resto a 6). Cosmético; sin impacto. Junto con el duplicado indica edición manual no limpia.

**SUGGESTION**:
- apply-progress no incluye tabla "TDD Cycle Evidence" en el cuerpo del pasaje (solo resumen RED/GREEN en texto). No bloquea: evidencia comprobable en vivo.

## Recomendación PR

PR 4 NO está listo para merge: fix obligatorio de `jornada.service.ts:309-310` (duplicado) + normalizar indentación (566/598/854), re-correr `tsc --noEmit` (debe dar exit 0) y re-verificar. Con eso, PASS — los 768 tests ya son verdes y FR-6 está completo. Tras merge a `pr3-purga-auto-cierre` (o tracker), quedaría cerrar PR 3 y PR 2 en cadena (feature-branch-chain).

## Evidencia comandos

- `npx tsc --noEmit -p tsconfig.app.json` → exit 2, `src/app/services/jornada.service.ts(310,25): error TS1117` (estado PRE-fix; ver addendum abajo).
- `npx vitest run src/app/services/jornada.service.spec.ts src/app/services/excel.service.spec.ts` → 2 files, **168 passed**.
- `npx vitest run` → 45 files, **768 passed**.
- `git status -sb` → `## pr4-excel` sin upstream, worktree limpio. `git log pr3-purga-auto-cierre..pr4-excel` → `a8f3ea3` fix + `a5dd26b` docs + `7ec8956` feat (3 commits).

---

## Addendum (archive, 2026-08-08): CRITICAL resuelto → PASS final

El CRITICAL TS1117 (propiedad `userAperturaNombre` duplicada en `jornada.service.ts:309-310`) fue **resuelto por el commit `a8f3ea3`** `fix(jornada): eliminar userAperturaNombre duplicado que rompia el build` (se eliminó una de las dos líneas del object literal en `_generarYGuardarExcel`). Re-verificado en vivo durante archive:

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ **exit 0** (limpio) |
| `npx vitest run` | ✅ **45 files / 768 passed** |

**Verdict final global: PASS** — los 4 slices (PR 1→PR 4) quedan verificados y verificables; `ng build` ya no se rompe por AOT. Los WARNING de indentación (14 espacios en `jornada.service.ts:566/598/854`) quedan como cosmético no bloqueante; el SUGGESTION de `formatearFecha` sin guard no-ISO queda aceptado como está.
