# Apply Progress: Stock Unit Type (unidades vs gramaje)

Change: `stock-unit-type`
Branch: `feat/stock-unit-type`
Status: **Implemented — verified GREEN** (all stock-unit-type specs pass)
Date: 2026-09-03

## Summary

Implemented the full `stock-unit-type` change: products now carry a `unidad_medida`
(`'unidad' | 'gramaje'`) field that drives display suffixes, quantity stepping, and
decimal input behavior throughout the app.

## Completed Tasks (all `[x]` in `tasks.md`)

### Phase 1 — Foundation
- **1.1** `migrationV19` in `db-migrations.ts`: `ALTER TABLE productos ADD COLUMN unidad_medida TEXT NOT NULL DEFAULT 'unidad'` (try/catch) + runner branch `currentVersion < 19`.
- **1.2** `db-migrations.spec.ts` updated: v19 column default + idempotency tests, version count.
- **1.3** `UnidadMedida` type + `UNIDAD_MEDIDA` map (`unidad {suffix:'u.',step:1,allowsDecimal:false}` / `gramaje {suffix:'lb',step:0.1,allowsDecimal:true}`) + required `unidad_medida` on `Producto`.
- **1.4** `MAX_STOCK_UNIDADES` → `MAX_STOCK_CANTIDAD` rename in `stock-movimiento.service.ts`.

### Phase 2 — Data Read Path
- **2.1** Confirmed SELECT/cursor queries use `SELECT *`, so the new column auto-appears.

### Phase 3 — Display Layer
- **3.1** `StockBadgeComponent` gains `unidadMedida` input + dynamic suffix via `UNIDAD_MEDIDA`.
- **3.2** `[unidadMedida]` passed on badges in `inventario.page.html`, `product-card.component.html`, `producto.page.html`.
- **3.3** Lot selectors in `inventario.page.html` use dynamic suffix.
- **3.4** Toast suffix derived from `actualizado.unidad_medida`.

### Phase 4 — Registration Form
- **4.1** `formUnidadMedida` signal (default `'unidad'`) + passed to `crear()`; reset on open/close.
- **4.2** Radio "Unidad"/"Gramaje" selector added to `inventario.page.html` product form.

### Phase 5 — Quantity Input
- **5.1** Conditional `onInputKeydown`: gramaje allows `.` (max 2 decimals); unidad integer-only.
- **5.2** Conditional `attr.inputmode`: `"decimal"` (gramaje) vs `"numeric"` (unidad).
- **5.3** Dynamic step ±1/±0.1 and dynamic label "c/u" → "por lb".

### Phase 6 — Cart & POS
- **6.1** `stepPara(producto)` helper in `cart.service.ts` (+ `incrementar`/`decrementar` with float `_redondear`).
- **6.2** POS Backspace + cart-item-row +/- buttons use `incrementar`/`decrementar` (step-aware).
- **6.3** Dynamic "c/u" → "por lb" label in `cart-item-row.component.html`.

### Phase 7 — TDD Specs
- **7.1** `stock-badge.component.spec.ts`: suffix assertions ("5 u.", "2.5 lb").
- **7.2** `quantity-input.component.spec.ts` created (10 tests: inputmode, decimal filter, max-2-decimals, label).
- **7.3** `db-migrations.spec.ts`: v19 tests.
- **7.4** Product fixtures gained `unidad_medida: 'unidad'` across inventario/pos/cart/producto/jornada/venta; added gramaje-path scenarios (inventario `crear()` with gramaje, cart step tests).
- **7.5** `cart-item-row.component.spec.ts`: dynamic label ("c/u" vs "por lb").

### Phase 8 — Cleanup
- **8.1** Header comment updated to "v1–v19" in `db-migrations.ts`.

## Verification

Clean run (pre-existing broken admin-setup specs temporarily excluded to unblock the
Angular unit-test builder compile):

```
Test Files:  49 passed | 1 skipped (50)
Tests:       939 passed | 2 skipped | 0 failed
```

## Pre-existing failures (NOT part of this change — reported)

These admin-setup-flow specs fail in the baseline and block the whole Angular unit-test
builder compile/runtime. They are unrelated to `stock-unit-type` and were left untouched:

| Spec | Failure |
|------|---------|
| `pages/setup/setup.page.spec.ts` | TS compile errors (mock-typing pattern: `mockReturnValue`/`mockResolvedValue` on `Partial<Service>`, ParamMap/ActivatedRouteSnapshot shape) |
| `pages/setup/setup.page.integration.spec.ts` | Same mock-typing TS errors |
| `guards/setup.guard.spec.ts` | Same mock-typing TS errors |
| `pages/admin/admin.page.spec.ts` | Same mock-typing TS errors |
| `services/setup.service.spec.ts` | Runtime: `vi.mock` on relative imports unsupported by Angular unit-test system |

## Key Files

- `src/app/models/producto.ts` — `UnidadMedida`, `UNIDAD_MEDIDA`, required field
- `src/app/services/db-migrations.ts` (+ `.spec.ts`) — migrationV19
- `src/app/components/stock-badge/*` — dynamic suffix
- `src/app/components/quantity-input/*` — decimal/step/label conditional
- `src/app/components/cart-item-row/*` — dynamic label
- `src/app/services/cart.service.ts` (+ `.spec.ts`) — `stepPara`/`incrementar`/`decrementar`
- `src/app/pages/inventario/*` — form selector + pass to `crear()`
- `src/app/pages/pos/*` — step-aware shortcuts
- `src/app/services/producto.service.ts` — INSERT includes `unidad_medida`
