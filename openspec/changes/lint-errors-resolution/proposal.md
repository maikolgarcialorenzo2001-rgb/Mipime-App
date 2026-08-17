# Proposal: lint-errors-resolution — Eliminar deuda de lint (BACKLOG-11)

## Intent

Eliminar TODO el debt de lint en `src/**` (TS + templates HTML) en branch `lint-errors-resolution` (base main `405f0af`, 0.1.15-beta): **117 errores → 0**. Sin cambios de config de eslint (Camino B: tipar los `any`, no override). Sin feature work.

> **HISTORIAL (2026-08-14)** — La rama original `lint-corrections` se creó sobre `981be23` con SOLO el plan (proposal+spec) y skills; la resolución de los errores **nunca se ejecutó**. Como había divergido y el conteo ya no coincidía (main avanzó con F1–F9, cuenta-casas, etc.), se descartó y se reabrió como `lint-errors-resolution` desde main actual. El plan se reusó tal cual. El merge absorbió en main algunos fixes del plan original:
> - `array-type` en `stock-movimiento.service.ts:611` → **ya resuelto** en main (fix `(...)[]` de F4-F7) — por eso no está en el desglose real.
> - `no-empty-function` bajó de 2 → 1 (`historial.page.spec`).
> - `no-unused-vars` bajó de 16 → 14 (main limpió algunos).
> - Entraron archivos nuevos de main con errores: `jornada.service.spec.ts` (5), `guards/auth.guard.spec.ts` (9), `user.service.spec.ts` (1).
>
> **Desglose real por regla (117):** 52 no-explicit-any · 34 label-has-associated-control · 14 no-unused-vars · 5 interactive-supports-focus · 5 click-events-have-key-events · 2 eqeqeq · 1 triple-slash-reference · 1 no-empty-function · 1 consistent-type-definitions · 1 consistent-generic-constructors.
>
> **Desglose real por archivo (19):** excel.service.ts 29 · inventario.page.html 20 · excel.service.spec.ts 9 · auth.guard.spec.ts 9 · checkout-modal.component.html 9 · historial.page.spec.ts 8 · cobro-pendiente-modal.component.html 7 · jornada.service.spec.ts 5 · user.service.ts 4 · producto.page.html 4 · quantity-input.component.html 4 · app.routes.spec.ts 4 · app-nav.component.html 2 · user.service.spec.ts 1 · electron-file.service.ts 1 · electron-file.service.spec.ts 1 · auth.service.ts 1 · login.page.spec.ts 1 · admin.page.spec.ts 1.

## Scope

### In Scope (117 errores / 19 archivos — estado real post-merge)
- **3 auto-fixables**: consistent-type-definitions (`app.routes.spec.ts:6`), consistent-generic-constructors (`excel.service.spec.ts:1408`), + 2 fixables de unused (`--fix`). `array-type` de stock-movimiento YA resuelto en main.
- **52 no-explicit-any**: 29 prod `excel.service.ts` + 23 specs — tipar con modelos existentes (`Venta`, `VentaConDetalles`, `ProductoInfo`, `ActivatedRouteSnapshot`, etc.)
- **34 label-has-associated-control**: `for`+`id` (o `[attr.for]`/`[attr.id]` en `@for`)
- **14 no-unused-vars**: imports/vars muertas en specs + `auth.service.ts` (`map`) + `user.service.ts` (`Database`) + `electron-file.service.spec.ts` + `user.service.spec.ts`
- **10 a11y**: 5 click-events-have-key-events + 5 interactive-supports-focus (replicar patrón `checkout-modal`)
- **2 eqeqeq**: `!=`→`!==` (semántica verificada)
- **1 no-empty-function**: `historial.page.spec` (incluye arreglar el disable comment roto)
- **1 triple-slash-reference**: `electron-file.service.ts` — único riesgo de build

### Out of Scope
- Override de `no-explicit-any` en config (Camino A — descartado por exploración)
- Feature work / cambios de comportamiento observable
- BACKLOG-8 (bundle budget) — `excel.service.ts` solapa pero los cambios son independientes
- CI (BACKLOG-9)
- Rama `palmar-feature` — NO tocar archivos de palmar
- Artefactos de build fuera de `lintFilePatterns` (`release/**`, parse error ignorable)

## Capabilities

### New Capabilities
None — refactor de typing/lint, sin comportamiento observable nuevo.

### Modified Capabilities
None — cero cambios de requerimientos a nivel spec.

## Approach

Camino B (exploración): tipar todos los `any` con modelos existentes — los 29 casts de `excel.service.ts` son ruido puro (`(v as any).x` → `v.x`); specs con tipos reales o `as unknown as T` para acceso privado en tests. Labels: `for`+`id` aditivo (ids dinámicos en `@for` de inventario edit-form y producto merma). a11y: replicar patrón in-repo de `checkout-modal` (`role="dialog"` + `tabindex` + `(keydown)`) en quantity-input / inventario / cobro-pendiente. Triple-slash: `electron/types.d.ts` es ambient global sin exports → **side-effect import** `import '../../../electron/types'` + verificar build; alternativa `eslint-disable` de la línea. Sin tocar `eslint.config.js` ni `angular.json`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/excel.service.ts` | Modified | 29 casts any → tipos reales |
| `src/app/**/*.spec.ts` (13 archivos) | Modified | any tipados, unused removidos, no-empty |
| `inventario.page.html` | Modified | 16 label + 2 click + 2 focus |
| `checkout-modal.component.html` | Modified | 9 label |
| `cobro-pendiente-modal.component.html` | Modified | 4 label + 1 click + 1 focus + 1 eqeqeq |
| `quantity-input.component.html` | Modified | 2 click + 2 focus |
| `producto.page.html` | Modified | 3 label + 1 eqeqeq |
| `app-nav.component.html` | Modified | 2 label |
| `electron-file.service.ts` | Modified | triple-slash → side-effect import |
| `auth.service.ts`, `user.service.ts`, `stock-movimiento.service.ts` | Modified | unused / array-type |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Triple-slash → side-effect import rompe build | Med | Verificar `bun run build` + `bun run electron:ts`; fallback `eslint-disable` de línea |
| Labels en `@for` dinámico (inventario edit-form, producto merma) | Med | Ids dinámicos `[attr.id]`; verificación visual |
| a11y click/focus cambia UX de modales | Med | Replicar patrón existente checkout-modal; verificación visual |
| eqeqeq semántica | Low | Verificado: `vuelto()` es `computed<number\|null>`, `precio_costo` es `number\|null` → `!= null` ≡ `!== null` |
| Unused vars destapan assertions faltantes | Low | Exploración verificó item por item: ninguno (login ya tiene assertion, pos ya limpiado) |

## Rollback Plan

Rama aislada de main (`981be23`), sin dependencias externas. Revertir selectivo por grupo de regla (`git checkout -- <archivo>`), o descartar la rama completa. Commits atómicos por regla para revertir granular.

## Dependencies

- Modelos existentes en repo (`venta.ts`, `ProductoInfo`, `ActivatedRouteSnapshot`/`RouterStateSnapshot`)
- `electron/types.d.ts` (ambient global) para el fix triple-slash

## Success Criteria

- [ ] `ng lint`: 0 errores / 0 warnings
- [ ] `ng test` verde
- [ ] `ng build` (web) OK
- [ ] `bun run electron:ts` OK (triple-slash)
- [ ] Verificación visual: checkout-modal, inventario, producto, cobro-pendiente-modal, quantity-input, app-nav
- [ ] Sin cambios en `eslint.config.js` ni `angular.json`

## Delivery Forecast (ask-on-risk)

- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Low (estimado ~200–350 líneas: fixes mayormente de 1 línea; labels ~68 líneas for+id; handlers a11y ~40)
