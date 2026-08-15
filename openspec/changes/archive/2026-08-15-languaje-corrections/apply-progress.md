# Apply Progress: languaje-corrections — Español neutro

> Fase apply COMPLETA. Modo Strict TDD. Test runner: `bunx vitest run`.
> Delivery strategy: single-pr (forecast ~230 líneas, riesgo Low, sin chain/split). Commit por work-unit.

## Estado

- **applyState**: all_done
- **Commits**: 4 work-unit commits atómicos en `languaje-corrections` (base `d2d60e2`)
- **Suite**: 47 test files / 908 tests PASS (baseline 283/10 archivos afectados → 908 totales)
- **Lint**: 0 errores NUEVOS introducidos; quedan 117 errores PRE-EXISTENTES (deuda BACKLOG-11, seguida aparte en `lint-errors-resolution`; el base `d2d60e2` ya los tiene)
- **Greps de cierre**: todos en 0

## Commits creados

| Hash | Mensaje | Work unit |
|---|---|---|
| `8ebdbb0` | `feat(pesos): add PesosPipe and MONEDA_LOCAL constant` | 1 |
| `d210855` | `feat(pesos): migrate 46 currency call-sites to the pesos pipe` | 2 |
| `2a42232` | `fix(ui): neutralizar voseo rioplatense y errores gramaticales` | 3 |
| `77f907b` | `fix(excel): usar etiquetas de divisa neutras en reportes` | 4 |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.3 | `src/app/pipes/pesos.pipe.spec.ts` | Unit | N/A (nuevo) | ✅ Written (module not found) | ✅ Passed 6/6 | ✅ 6 casos (500, 150000, 1500.2, default digits, null/undefined, sin ARS) | ➖ None needed |
| 2.1–2.3 | 7 template specs | Integration (TestBed) | ✅ 283/283 baseline | ✅ NG0302 x118 | ✅ Passed 180/180 | ➖ asserts de formato pre-existentes | ➖ None needed |
| 3.1–3.2 | db-error, ttl-expired, historial | Unit/Integration | ✅ en baseline | ✅ 3 failed | ✅ Passed 244/244 (8 archivos) | ➖ asserts puntuales | ➖ None needed |
| 4.1–4.2 | `excel.service.spec.ts` | Unit | ✅ en baseline | ✅ 2 failed | ✅ Passed 85/85 | ➖ asserts puntuales | ➖ None needed |

### Test Summary

- **Total tests written**: 6 (nuevos pipe) + 0 (asserts actualizados)
- **Total tests passing**: 908
- **Layers used**: Unit (6 pipe), Integration (TestBed render)
- **Approval tests**: None — no refactoring de lógica (solo swaps de string/import)
- **Pure functions created**: 1 (`PesosPipe.transform`)

## Work Unit Evidence

| Work unit | Focused test command + result | Runtime harness | Rollback boundary |
|-----------|------------------------------|-----------------|-------------------|
| 1 — PesosPipe + MONEDA_LOCAL | `bunx vitest run src/app/pipes/pesos.pipe.spec.ts` → 6/6 pass | N/A — vitest specs son el harness (sin e2e) | Borrar `src/app/pipes/`, `src/app/core/constants.ts` + revert imports |
| 2 — 46 call-sites + imports | 7 template specs → 180/180 pass | N/A — specs son el harness | Revertir swaps de template + imports de los 8 .ts |
| 3 — 14 strings neutros | 8 specs (db-error, ttl-expired, historial, inventario, pos, jornada, checkout, cobro) → 244/244 | N/A — string-only | Revertir edits de strings (14 archivos) |
| 4 — Excel labels | `bunx vitest run src/app/services/excel.service.spec.ts` → 85/85 | N/A — string-only | Revertir labels :190/:709 |

## Notas de implementación

- **Divisa exceptions**: `checkout-modal.component.html:187` y `cobro-pendiente-modal.component.html:210` usan `currency: divisaTipo() === 'USD' ? 'USD' : 'EUR'` — NO reemplazadas (fuera de scope). Por eso esos 2 componentes mantienen `CurrencyPipe` EN ADICIÓN a `PesosPipe` en `imports` (el design decía swap, pero la excepción obliga a ambos).
- **Sintaxis doble**: se reemplazaron las 2 variantes — compacta `currency:'ARS'` y espaciada `currency: 'ARS'` (checkout:190, cobro:53/96/218/225/245/254).
- **LOCALE_ID inyectado**: `PesosPipe` usa `inject(LOCALE_ID)`; en tests en-US el símbolo narrow ARS es `$`, mismo output que `es`. Output byte-idéntico al pipe anterior.
- **Excel spec :1608**: se actualizó también el comentario `Total CUP` → `Total en pesos` (dentro del work unit, para cerrar grep 0).
- **quantity-input**: no tiene spec (verificado); los asserts de formato de las otras 7 specs quedaron intactos.

## Desviaciones del design

1. `checkout-modal.component.ts` y `cobro-pendiente-modal.component.ts` mantienen `CurrencyPipe` junto a `PesosPipe` (design decía swap completo). Motivo: las 2 excepciones divisa de template siguen usando el pipe `currency` nativo. Sin esto, NG0302 en las líneas de excepción.
2. Ninguna otra desviación.

## Riesgos

- Los 117 errores de lint son deuda pre-existente (BACKLOG-11), no introducidos por este change. `ng lint` no queda en 0 hasta que `lint-errors-resolution` se integre a la branch.
- "Equivalente en Pesos" (excel.service.ts:248) NO se tocó: es nombre de columna de datos (out of scope por design "solo labels de totales").

## Next

- `sdd-verify`: validar que la implementación cumple las 4 specs deltas (local-currency, checkout, excel-reportes, neutral-language).
- Luego PR single hacia main (work-unit commits ya están listos).
