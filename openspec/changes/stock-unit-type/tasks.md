# Tasks: Stock Unit Type (unidades vs gramaje)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR on feat/stock-unit-type |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full feature: migration + model + UI + tests | feat/stock-unit-type commit | All changes stay local, no merge to main |

---

## Phase 1: Foundation — Migration & Model

- [x] **1.1** Add `migrationV19` to `db-migrations.ts`: `ALTER TABLE productos ADD COLUMN unidad_medida TEXT NOT NULL DEFAULT 'unidad'` with try/catch; add runner branch `if (currentVersion < 19) await migrationV19(exec)`
- [x] **1.2** Update `db-migrations.spec.ts`: "inserts 18" → "19", add v19 idempotency test, update all version arrays in existing tests
- [x] **1.3** Add `UnidadMedida` type + `UNIDAD_MEDIDA` constant map + `unidad_medida` field to `Producto` interface in `models/producto.ts`
- [x] **1.4** Rename `MAX_STOCK_UNIDADES` → `MAX_STOCK_CANTIDAD` in `stock-movimiento.service.ts` + update all 2 references

## Phase 2: Data Read Path

- [x] **2.1** Verify all SELECT/cursor queries already SELECT * from productos (no column list filtering) — confirm column auto-appears without code changes

## Phase 3: Display Layer — Suffix Propagation

- [x] **3.1** Add `unidadMedida` input (default `'unidad'`) to `StockBadgeComponent`; template renders `{{ stock() }} {{ sufijo }}` via `UNIDAD_MEDIDA` lookup
- [x] **3.2** Pass `[unidadMedida]="producto.unidad_medida"` on stock-badge usages in `inventario.page.html` (2 badges), `product-card.component.html`, `producto.page.html` (2 badges)
- [x] **3.3** Update lot selectors in `inventario.page.html` (×3 `{{ lote.cantidad }}u` → dynamic suffix via `UNIDAD_MEDIDA`)
- [x] **3.4** Update toast suffix in `inventario.page.ts` to derive from `actualizado.unidad_medida`

## Phase 4: Registration Form

- [x] **4.1** Add `formUnidadMedida` signal (default `'unidad'`) + validation + pass to `crear()` in `inventario.page.ts`
- [x] **4.2** Add unit type selector (radio/toggle) to `inventario.page.html` product form with "Unidad"/"Gramaje" options

## Phase 5: Quantity Input — Conditional Behavior

- [x] **5.1** Add conditional regex in `quantity-input.component.ts` `onInputKeydown`: gramaje allows `.` (single decimal, max 2 places); unidad remains integer-only
- [x] **5.2** Conditional `inputmode` in template: `"decimal"` for gramaje, `"numeric"` for unidad
- [x] **5.3** Dynamic step (±1 vs ±0.1) and dynamic label "c/u" → "por lb" in `quantity-input.component.html`

## Phase 6: Cart & POS — Per-Product Step

- [x] **6.1** Add `stepPara(producto)` helper in `cart.service.ts` returning `UNIDAD_MEDIDA[producto.unidad_medida].step`
- [x] **6.2** POS keyboard shortcuts in `pos.page.ts` use `stepPara()` for ± instead of hardcoded 1
- [x] **6.3** Dynamic "c/u" → "por lb" label in `cart-item-row.component.html`

## Phase 7: TDD — Specs (RED→GREEN)

- [x] **7.1** Extend `stock-badge.component.spec.ts`: suffix assertions "5 u." / "2.5 lb"; add `unidadMedida` input to all existing fixtures
- [x] **7.2** Create `quantity-input.component.spec.ts`: gramaje decimal filter, inputmode, ±0.1 step, unidad regression
- [x] **7.3** Extend `db-migrations.spec.ts`: v19 column default test, idempotency, version count 19
- [x] **7.4** Extend `inventario.page.spec.ts` + `pos.page.spec.ts` + `cart.service.spec.ts`: product fixtures gain `unidad_medida: 'unidad'`; add gramaje-path scenarios
- [x] **7.5** Extend `cart-item-row.component.spec.ts`: dynamic label assertion

## Phase 8: Cleanup

- [x] **8.1** Update component fix comment in `db-migrations.ts` line 17 header ("v1–v16" → "v1–v19")
