# Proposal: Bug Fixes Julio 2026

## Intent

Fix 4 bugs affecting daily POS operations: a login UI layout issue, two Excel export calculation errors, and a non-functional currency payment method. All are confirmed with root cause analysis.

## Scope

### In Scope

- **Bug 1** — Login fullscreen scrollbar: Add `overflow-x: hidden` to `<body>` in `index.html`
- **Bug 2** — Excel "Cuenta Cosas" wrong total: Change calculation from `-cantidad` to `-(cantidad × precio_costo)` using `productosMap` lookup
- **Bug 3** — Excel Ventas "Total ingresos" includes pendientes: Split into `totalSinPendientes` + `totalPendientes`, show only non-pending in "Total ingresos"
- **Bug 4** — Divisas checkout: Make `montoDivisa` a computed signal `Math.ceil(total / tasaCambio)`, add `vuelto` computed, render read-only field + change display

### Out of Scope

- C11-nuevos-metodos-pago changes (separate active change)
- Other Excel report restructuring
- Payment method CRUD or backend changes

## Capabilities

### New Capabilities

None — all fixes are corrections to existing behavior, not new spec-level capabilities.

### Modified Capabilities

- `checkout` (delta from C11): Divisas sub-form becomes computed (montoDivisa readonly, vuelto displayed)
- `excel-reportes` (delta from C11): CuentaCosas uses `cantidad × precio_costo`; Ventas excludes pendientes from "Total ingresos"

## Approach

| Bug | Fix | Files |
|-----|-----|-------|
| 1 | Add `body { overflow-x: hidden; }` to `styles.css` (global) | `src/styles.css` |
| 2 | In `_agregarResumen` and `_agregarJornadaSheet`: `valor = -(item.cantidad * info?.precio_costo ?? 0)`, `totalCc += item.cantidad * (info?.precio_costo ?? 0)` | `src/app/services/excel.service.ts` |
| 3 | In `_agregarVentas` and `_agregarJornadaSheet`: track `totalSinPendientes` separately from `totalPendientes`. Footer row shows only `totalSinPendientes`. Add "Total esperado" row = both. | `src/app/services/excel.service.ts` |
| 4 | Add `computed` import. Replace `montoDivisa` signal with `montoDivisaCalc = computed(() => tasaCambio() ? Math.ceil(this.total() / tasaCambio()) : null)`. Add `vuelto = computed(...)`. Make input readonly. Add vuelto display below total. | `checkout-modal.component.ts`, `.html` |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/styles.css` | Modified | 1-line global overflow fix |
| `src/app/services/excel.service.ts` | Modified | CuentaCosas calc (2 methods) + Ventas pendientes split (2 methods) |
| `src/app/components/checkout-modal/` | Modified | Divisas computed signals + template update |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Excel calculation regression on existing reports | Low | Unit tests cover both `_agregarResumen` and `_agregarJornadaSheet` |
| Checkout divisas edge case: `tasaCambio = 0` | Low | Guard `tasaCambio() > 0` in computed |
| C11 spec conflict with new divisas behavior | Medium | Proposal explicitly supersedes C11 checkout scenario for divisas |

## Rollback Plan

All 4 fixes are isolated single-file changes. Revert each commit independently. No database or migration involved.

## Dependencies

- None. All fixes are internal to the Angular app.

## Success Criteria

- [ ] No horizontal scrollbar in login page (fullscreen and normal)
- [ ] CuentaCosas total = `Σ(cantidad × precio_costo)` in both Resumen and Jornada sheets
- [ ] "Total ingresos" in Ventas sheet excludes pendientes
- [ ] Divisas: `montoDivisa` auto-computed, vuelto displayed, no manual input
- [ ] All existing tests pass; new tests added for each fix
