# Lint Errors Resolution — Progreso por Fase (BACKLOG-11)

Branch: `lint-errors-resolution` (base: main `405f0af`, v0.1.15-beta)
Última actualización: 2026-08-14

---

## Fase 0 — Diagnóstico (2026-08-14)

### Contexto
La rama original `lint-corrections` (base `981be23`) contenía SOLO el plan (proposal + spec) y skills de `.openclaw/`. La resolución de los 121 errores NUNCA se ejecutó. Como la rama había divergido de main (main avanzó con F1–F9, cuenta-casas, etc.), se descartó y se reabrió como `lint-errors-resolution` desde main actual (`405f0af`). El plan se reusó.

### Hallazgo clave
- El conteo real tras el merge con main era **117 errores / 19 archivos** (no 121/21 del plan original).
- `array-type` de `stock-movimiento.service.ts` → **ya resuelto en main** (fix `(...)[]` de F4–F7).
- `no-empty-function` bajó de 2 → 1; `no-unused-vars` de 16 → 14 (main limpió algunos).
- Entraron archivos nuevos de main con errores: `jornada.service.spec.ts` (5), `auth.guard.spec.ts` (9), `user.service.spec.ts` (1).

### Desglose inicial (117)
| Regla | Cantidad |
|---|---|
| no-explicit-any | 52 |
| label-has-associated-control | 34 |
| no-unused-vars | 14 |
| interactive-supports-focus | 5 |
| click-events-have-key-events | 5 |
| eqeqeq | 2 |
| triple-slash-reference | 1 |
| no-empty-function | 1 |
| consistent-type-definitions | 1 |
| consistent-generic-constructors | 1 |

---

## Fase 1 — Resolución aplicada (2026-08-14) ✅

### Resultado final
- **`ng lint`: 0 errores / 0 warnings** (`All files pass linting`)
- **`bunx vitest run`: 902 passed / 902** (46 archivos)
- **`ng build`: OK** (solo warning pre-existente bundle 799 kB > 500 kB = BACKLOG-8, fuera de scope)
- Sin cambios en `eslint.config.js` ni `angular.json`
- Exactamente 1 `eslint-disable` en todo el diff (excepción verificada: `electron-file.service.ts:1` triple-slash)

### Commits creados (atómicos por grupo de regla)
| Commit | Contenido |
|---|---|
| `d9cf6a7` | autofix consistent-type-definitions + consistent-generic-constructors |
| `6523e99` | labels `for`+`id` + a11y key-events/focus en templates |
| `6f4cb83` | imports/vars no utilizados removidos |
| `90a8410` | `any` tipados con tipos concretos (excel, guards, specs) |
| `7a5fbd8` | excepción documentada triple-slash electron |

### Detalle por grupo
- **52 no-explicit-any**: 29 en prod `excel.service.ts` (casts ruido `(v as any).x` → `v.x` con tipos existentes `Venta`, `VentaConDetalles`, `ProductoInfo`, `JornadaReportData`) + 23 en specs (`as unknown as T` para acceso privado).
- **34 labels**: `for`+`id`; ids dinámicos con `[attr.for]`/`[attr.id]` en `@for` de inventario edit-form y producto merma.
- **10 a11y**: patrón in-repo de `checkout-modal` (`role`, `tabindex`, `(keydown)`) replicado en quantity-input, inventario, cobro-pendiente-modal, producto.
- **2 eqeqeq**: `!=` → `!==` (semántica verificada: `vuelto()` es `computed<number|null>`, `precio_costo` es `number|null`).
- **1 no-empty-function**: `historial.page.spec` + disable comment roto arreglado.
- **1 triple-slash**: conservado con `eslint-disable-next-line` único (load-bearing: build falla sin él).

---

## Fase 2 — Pendiente / Próximos pasos

- [ ] Review humano (pana) del diff antes de mergear a main
- [ ] Merge de `lint-errors-resolution` → `main`
- [ ] (Fuera de scope, BACKLOG-8) bundle budget 799 kB vs 500 kB — `excel.service.ts` solapa
- [ ] (Fuera de scope, BACKLOG-9) CI
