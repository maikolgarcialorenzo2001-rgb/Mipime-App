# Tasks: login-page-cierre-bug — Eliminar parámetro muerto `saldoReal`

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~32 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Eliminar saldoReal de service y callers + tests | PR 1 | Single atomic commit |

## Phase 1: Service — cambiar firma

- [ ] 1.1 `src/app/services/jornada.service.ts`: quitar `saldoReal` de `cerrar()`, `_cerrarAsync()`, `_ejecutarCierre()` — firma pasa de `(id, saldoReal, userId, arqueo?)` a `(id, userId, arqueo?)`

## Phase 2: Callers — actualizar invocaciones

- [ ] 2.1 `src/app/pages/login/login.page.ts` línea 85: cambiar `cerrar(j.id, j.saldo_esperado, uid)` → `cerrar(j.id, uid)`
- [ ] 2.2 `src/app/components/layout/app-nav.component.ts` líneas 150-155: eliminar `const saldoReal = this.arqueoTotal()` y cambiar `cerrar(j.id, saldoReal, uid, entries)` → `cerrar(j.id, uid, entries)`

## Phase 3: Tests — actualizar mocks

- [ ] 3.1 `src/app/services/jornada.service.spec.ts`: cambiar todos los `cerrar(` (20+ calls) para que usen la nueva firma sin `saldoReal`

## Phase 4: Verificación

- [ ] 4.1 Verificar que `npm test` pasa sin errores
- [ ] 4.2 Verificar que `ng build` compila sin errores de tipo
- [ ] 4.3 Verificar con `grep` que no quedan calls viejas a `cerrar(` con 4 args
