# Proposal: Stock Unit Type (unidades vs gramaje)

## Intent

Product stock is currently displayed and input as integer units everywhere, but the DB already stores quantities as REAL. Users selling by weight (pounds/grammage) need decimal-capable quantity inputs with appropriate unit labels. This adds a per-product `unidad_medida` field and propagates the correct suffix and input behavior across all UI points.

## Scope

### In Scope
- Migration V12: add `unidad_medida TEXT NOT NULL DEFAULT 'unidad'` to `productos`
- Producto model interface update
- Unit type selector in product registration/edit form (inventario page)
- Dynamic unit suffix in all display components (stock-badge, lot selectors, toasts)
- POS: decimal quantity input for gramaje products (quantity-input regex, inputmode, ± step)
- Rename `MAX_STOCK_UNIDADES` → `MAX_STOCK_CANTIDAD` in stock-movimiento.service
- Update existing specs + add gramaje-path tests

### Out of Scope
- Precision/rounding config per unit type (Opción B)
- `unidades_medida` lookup table with FK (Opción C)
- FIFO/lote logic changes (already works with decimals)

## Capabilities

### New Capabilities
- `inventario-operaciones`: Product registration and stock display — unit type selection at creation, dynamic suffix rendering, and decimal-aware quantity inputs across inventario, POS, and stock-badge components.

### Modified Capabilities
- `checkout`: Cart quantity input MUST accept decimals for gramaje products; ± step becomes ±0.1 for gramaje vs ±1 for unidades.

## Approach

1. **DB + Model**: Add `unidad_medida` column with migration V12; update `Producto` interface with `'unidad' | 'gramaje'` union.
2. **Form**: Add radio/toggle in inventario product form; existing products default to `'unidad'`.
3. **Display layer**: Component inputs receive a `unidad` signal/property; stock-badge, lot selectors, toasts, and validation messages render suffix dynamically ("u." vs "lb").
4. **Quantity input**: Conditional `inputmode` (numeric vs decimal), regex filter (digits-only vs digits+decimal), step size (1 vs 0.1).
5. **Cart service**: `cantidad` default remains 1 for unidades; step becomes configurable per product.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/models/producto.ts` | Modified | Add `unidad_medida` to Producto interface |
| `src/app/services/db-migrations.ts` | Modified | New V12 migration |
| `src/app/pages/inventario/inventario.page.ts` | Modified | Form signal, validation, toast suffix |
| `src/app/pages/inventario/inventario.page.html` | Modified | Unit selector, dynamic suffix in lot/toast |
| `src/app/components/stock-badge/stock-badge.component.html` | Modified | Dynamic suffix |
| `src/app/components/quantity-input/quantity-input.component.ts` | Modified | Conditional inputmode/regex/step |
| `src/app/services/stock-movimiento.service.ts` | Modified | Rename constant |
| `src/app/services/cart.service.ts` | Modified | Step per product type |
| `src/app/pages/pos/pos.page.ts` | Modified | Keyboard shortcuts ±0.1 for gramaje |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing products have no unidad_medida | High | Migration defaults to 'unidad'; all current code paths unaffected |
| Quantity-input conditional behavior breaks existing integer tests | Medium | Add dedicated gramaje test scenarios; guard decimal path with unidad check |
| Cart ±0.1 for gramaje creates UX confusion if user mixes unit types | Low | Cart step resolved per-product at add time, not globally |

## Rollback Plan

Revert migration V12 by dropping the `unidad_medida` column; revert Producto interface; restore hardcoded "u." suffixes. No data loss — only new column removed. All existing products remain functional with integer display as before.

## Dependencies

- None external. Migration V12 must run after V11.

## Success Criteria

- [ ] New product with `unidad_medida='gramaje'` displays "lb" suffix in stock badge, lots, and toast
- [ ] Quantity-input allows decimal entry and ±0.1 step for gramaje products
- [ ] Existing unidad products display "u." and behave identically to current behavior
- [ ] All existing specs pass; new gramaje scenarios pass
