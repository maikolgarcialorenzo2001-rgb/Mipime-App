# Tasks: lint-errors-resolution — Eliminar deuda de lint (BACKLOG-11)

> **Estado: IMPLEMENTADO** (rama `lint-errors-resolution`). Este artifact documenta el trabajo YA completado en 5 commits atómicos (`d9cf6a7` → `7a5fbd8`), verificado con `ng lint` 0/0, `bunx vitest run` 902 passed y `ng build` OK. Todos los checkboxes están `[x]`; ninguna tarea queda pendiente de código.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Auto-fixables (commit `d9cf6a7`)

- [x] 1.1 `consistent-type-definitions` — `app.routes.spec.ts:6` autofix (interface → type)
- [x] 1.2 `consistent-generic-constructors` — `excel.service.spec.ts:1408` autofix (Array/Map generic)

## Phase 2: Tipar no-explicit-any — prod (commit `90a8410`)

- [x] 2.1 `excel.service.ts` — eliminar los 29 casts `(v as any).x` → `v.x` (campos ya en `Venta`/`VentaConDetalles`/`ProductoInfo`)

## Phase 3: Tipar no-explicit-any — specs (commit `90a8410`, 23 any / 8 archivos)

- [x] 3.1 `excel.service.spec.ts` — fixtures tipados (`VentaLote`, `VentaConDetalles`, `ProductoInfo`); `pmap`/`productosMap` sin `as any`
- [x] 3.2 `auth.guard.spec.ts` — `{} as unknown as ActivatedRouteSnapshot` / `RouterStateSnapshot`
- [x] 3.3 `jornada.service.spec.ts` — any tipados con modelos existentes
- [x] 3.4 `app.routes.spec.ts`, `historial.page.spec.ts`, `user.service.spec.ts` — fixtures y rutas tipadas
- [x] 3.5 `admin.page.spec.ts`, `login.page.spec.ts`, `electron-file.service.spec.ts` — `as unknown as T` / modelos

## Phase 4: Templates — labels, a11y keyboard, eqeqeq (commit `6523e99`)

- [x] 4.1 `inventario.page.html` — 16 labels `for`+`id` (ids dinámicos `[attr.id]` en `@for`), 2 click + 2 focus (patrón checkout-modal, `onOverlayKeydown`)
- [x] 4.2 `checkout-modal.component.html` — 9 labels `for`+`id`
- [x] 4.3 `cobro-pendiente-modal.component.html` — 4 labels, 1 click + 1 focus (fila `@for`), 1 eqeqeq `!=`→`!==`
- [x] 4.4 `producto.page.html` — 3 labels (merma `[attr.id]`), 1 click + 1 focus, 1 eqeqeq
- [x] 4.5 `quantity-input.component.html` — 2 click + 2 focus (backdrop+card `role="dialog"` + `tabindex` + `(keydown)`)
- [x] 4.6 `app-nav.component.html` — 2 labels display-only → `span` (D4, sin asociación espuria)

## Phase 5: Unused vars + no-empty-function (commit `6f4cb83`)

- [x] 5.1 `auth.service.ts` — remover import `map` unused
- [x] 5.2 `user.service.ts` — remover `Database` unused
- [x] 5.3 `electron-file.service.spec.ts:147` — quitar binding `const` muerto (spy load-bearing intacto, WARN-2)
- [x] 5.4 `user.service.spec.ts` + specs varios — imports/vars muertas removidas (14 total, sin tocar assertions, FR-4)
- [x] 5.5 `historial.page.spec.ts` — `no-empty-function` (1): rellenar/remover body + arreglar disable comment roto

## Phase 6: Excepción triple-slash (commit `7a5fbd8`)

- [x] 6.1 `electron-file.service.ts:1` — conservar triple-slash (load-bearing, D5) con único `// eslint-disable-next-line @typescript-eslint/triple-slash-reference` documentado

## Phase 7: Verification & Delivery

- [x] 7.1 `ng lint` → 0 errores / 0 warnings (FR-1, AC1)
- [x] 7.2 `bunx vitest run` → 902 passed / 902 (FR-3, AC2; baseline 783 → 902)
- [x] 7.3 `ng build` (web) OK — warning bundle budget preexistente (WARN-3, AC5); `bun run electron:ts` OK (AC6)
- [x] 7.4 1 único `eslint-disable` (electron-file.service.ts:1) — 0 nuevos salvo excepción (FR-2, AC3); sin cambios en `eslint.config.js`/`angular.json` (AC7); sin assertions modificadas (AC8)
- [ ] 7.5 Smoke visual a11y pendiente (AC4): labels asociados, ids únicos en `@for`, modales/filas focusables y operables por teclado — checkout-modal, inventario, producto, cobro-pendiente-modal, quantity-input, app-nav

### Delivery note

Low risk, no chaining needed: ~200–350 líneas, fixes de 1 línea, commits atómicos por grupo de regla permiten revert granular. Único pendiente no-code: el smoke visual AC4 (los tests no detectan atributos DOM).
