# Design: lint-errors-resolution — Eliminar deuda de lint (BACKLOG-11)

## Context

Refactor puro de typing/atributos: 117 errores de lint → 0, cero cambios de comportamiento observable. La propuesta declara cero New/Modified Capabilities y la spec lo garantiza (FR-1..FR-5). Se eligió **Camino B** (tipar los `any` con modelos existentes) sobre **Camino A** (override de eslint en config) — refrendado por AC7 ("sin cambios en `eslint.config.js` ni `angular.json`").

Trazabilidad: esta rama está implementada (5 commits d9cf6a7→7a5fbd8) y verificada (`ng lint` 0/0, 902 tests, `ng build` OK). Este diseño documenta el enfoque técnico usado y las consideraciones residuales.

## Architecture Decisions

| # | Decisión | Opciones | Tradeoff | Decisión |
|---|----------|----------|----------|----------|
| D1 | no-explicit-any | A) Override eslint / B) Tipar | A silencia el detector sin mejorar el tipo; B es aditivo y type-safe | **B**: tipar con modelos existentes |
| D2 | Acceso a privados en specs | `as any` / `as unknown as T` | `as any` recae en no-explicit-any; `as unknown as T` es explícito y lint-clean | **`as unknown as T`** (`ActivatedRouteSnapshot`, `RouterStateSnapshot`) |
| D3 | Ruido de casts en excel.service.ts | Mantener `(v as any).x` / `v.x` | Los campos ya existen en el modelo tipado; el cast es ruido puro | **Eliminar el cast** → `v.x` |
| D4 | Labels display-only (app-nav) | `for`+`id` espurio / `span` | `label` display-only exige asociación forzada; `span` evita asociaciones falsas sin romper layout | **`span`** (spec a11y: "evitar asociaciones espurias") |
| D5 | Triple-slash electron | side-effect import / `eslint-disable-next-line` / nada | Import rompe build (esbuild no resuelve .d.ts aislado); sin referencia falla TS2339/TS2304 | **Único `eslint-disable-next-line` permitido** (sección Excepción) |

## Typing Strategy

- **Prod (`excel.service.ts`)**: 29 casts `(v as any).x` → `v.x`; los campos ya existen en `Venta`/`VentaConDetalles` (`divisa_tipo`, `monto_divisa`, `tasa_cambio`, `completacion_efectivo`, `comprador_nombre`). `JornadaReportData` se reutiliza sin casts.
- **Specs (23 any)**: fixtures tipados con `VentaLote`, `VentaConDetalles`, `ProductoInfo`; guards usan `{} as unknown as ActivatedRouteSnapshot` / `RouterStateSnapshot`; `pmap` (Map con `ProductoInfo`) se tipa directo, eliminando `as any` en `productosMap`.
- **Patrón**: ningún `eslint-disable` nuevo salvo la excepción D5; cero cambios de config.

## Template Strategy

- **Labels**: `for`+`id` estáticos (checkout-modal, cobro-pendiente, producto); `[attr.for]`/`[attr.id]` con ids por iteración (`inv-editar-{id}`, `inv-mov-cantidad-{id}`, `merma-cantidad-{id}`) en `@for` de inventario/producto → ids únicos (FR-5).
- **a11y keyboard**: patrón in-repo checkout-modal (`role="dialog"` + `tabindex` + `(keydown)`) replicado en quantity-input (backdrop+card), inventario (modal producto, `onOverlayKeydown` en `.ts` para Escape) y cobro-pendiente (fila en `@for`).
- **app-nav**: labels display-only → `span` (D4).

## Excepción Verificada (D5)

`electron-file.service.ts:1` conserva `/// <reference path="../../../electron/types.d.ts" />` porque:
1. `import '../../../electron/types'` → build falla ("Could not resolve...": esbuild no resuelve .d.ts aislado).
2. Sin referencia → TS2339 (`window.electronAPI`) + TS2304 (tipos `Db*`).
3. `bun run electron:ts` pasa porque no compila `src/`.

`electron/types.d.ts` es ambient global sin exports; el triple-slash es **load-bearing**. Se documenta con un único `// eslint-disable-next-line @typescript-eslint/triple-slash-reference`. Cumple FR-2 (máx. 1 disable).

## Semántica Verificada (eqeqeq)

`!=` → `!==` son equivalentes en ambos casos:
- `vuelto()` en cobro-pendiente-modal: `computed<number|null>` → `!= null` ≡ `!== null`.
- `precio_costo` en producto.page.html: propiedad `number|null` → idem.

## Data Flow

N/A — refactor sin movimiento de datos; los únicos cambios de runtime son handlers de teclado (`onOverlayKeydown`, `(keydown)`) que re-despachan acciones existentes (cerrar modal).

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/services/excel.service.ts` | Modify | 29 casts any eliminados, campos ya tipados |
| `src/app/guards/auth.guard.spec.ts` | Modify | `as unknown as ActivatedRouteSnapshot`/`RouterStateSnapshot` |
| `src/app/services/excel.service.spec.ts` | Modify | Fixtures tipados (VentaLote, VentaConDetalles, ProductoInfo) |
| `src/app/**/*.spec.ts` (historial, jornada, app.routes, admin, login, user, electron-file) | Modify | any tipados, unused removidos, no-empty + disable comment roto |
| `src/app/services/auth.service.ts`, `user.service.ts` | Modify | Imports unused removidos |
| `inventario.page.html/.ts`, `producto.page.html`, `checkout-modal.component.html`, `cobro-pendiente-modal.component.html`, `quantity-input.component.html`, `app-nav.component.html` | Modify | Labels + a11y (FR-5) |
| `src/app/services/electron-file.service.ts` | Modify | Único eslint-disable documentado (D5) |

## Testing Strategy

| Capa | Qué | Cómo |
|------|-----|------|
| Lint | 0 errores/warnings | `ng lint` (FR-1) |
| Unit | Suite completa sin regresiones | `ng test -- --watch=false` (FR-3; baseline 783 → 902) |
| Build | Web + electron | `ng build`, `bun run electron:ts` |
| Visual (AC4) | Labels asociados, ids únicos, focus/keyboard | Smoke manual — los tests no detectan atributos DOM |

## Threat Matrix

N/A — no hay routing, shell, subprocess, VCS/PR automation, executable-file classification ni process-integration boundary en este cambio.

## Migration / Rollout

No se requiere migración. Rama aislada; commits atómicos por grupo de regla (d9cf6a7 autofix → 6523e99 templates → 6f4cb83 unused → 90a8410 typing → 7a5fbd8 excepción) permiten revert granular.

## Open Questions

- [ ] Discrepancia de conteo `no-explicit-any`: spec FR-2 dice 53, proposal dice 52 — conciliar en verify.
- [ ] Smoke visual a11y (AC4) pendiente: los tests no detectan atributos DOM.
- [ ] Bundle budget (BACKLOG-8) es warning preexistente, fuera de scope (WARN-3).
