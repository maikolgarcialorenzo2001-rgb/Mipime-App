# Proposal: fix-pago-mixto-divisa-efectivo

## Intent

Mixed divisa+cash payments (`completacion_efectivo`) exist in the DB and UI but are invisible to all financial tracking — jornada balances, auto-cierre, and Excel reports. Every downstream calculation using `forma_pago === 'efectivo'` misses the cash completion from divisa sales, underreporting efectivo and inflating saldo_esperado.

## Scope

### In Scope
- Add `completacion_efectivo` field to `Venta` model interface
- Update `_calcularTotalEnCaja()` in `jornada.service.ts` to sum `COALESCE(completacion_efectivo, 0)` from divisa ventas + total from efectivo ventas
- Update `_ejecutarCierre()` and auto-cierre query to use same logic for `saldo_real`
- Add `completacion_efectivo` column to Ventas sheet in Excel export
- Update Resumen sheet "Total efectivo" to include completacion_efectivo
- Update Arqueo sheet cash comparison to include completacion_efectivo

### Out of Scope
- Divisas tracking itself (monto_divisa, tasa_cambio, divisa_tipo)
- UI changes to checkout-modal (already done)
- Migration V16 (already applied)
- Changing the `total_ventas` / `saldo_esperado` increment logic on insert
- Retroactive data migration for old rows

## Capabilities

### New Capabilities
None — this is a bugfix across existing capabilities, no new spec-level behavior.

### Modified Capabilities
- `jornada-lifecycle`: "Jornada Financial Calculations" and closure scenarios must account for `completacion_efectivo` when computing saldo_real and totalEnCaja. saldo_esperado currently inflates for divisa sales — the insert-time increment logic stays unchanged, but read-time calculations (totalEnCaja signal, saldo_real) must be fixed.
- `excel-reportes`: Ventas sheet needs a `completacion_efectivo` column. Resumen "Total efectivo" and Arqueo cash comparison must include completacion_efectivo from divisa ventas.

## Approach

Replace all `WHERE forma_pago = 'efectivo'` filters with a helper pattern:

```sql
SUM(CASE
  WHEN forma_pago = 'efectivo' THEN total
  WHEN forma_pago = 'divisas'  THEN COALESCE(completacion_efectivo, 0)
  ELSE 0
END) AS total_efectivo
```

Mirror this in TypeScript: `_calcularTotalEnCaja()` iterates ventas and sums efectivo.total + divisa.completacionEfectivo. Same for `_ejecutarCierre()` and auto-cierre.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/models/venta.ts` | Modified | Add `completacion_efectivo?: number` |
| `src/app/services/jornada.service.ts` | Modified | `_calcularTotalEnCaja()`, `_ejecutarCierre()`, auto-cierre SQL |
| `src/app/services/excel.service.ts` | Modified | Ventas column, Resumen/Arqueo cash totals |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| NULL `completacion_efectivo` on pre-V16 ventas | High | Always `COALESCE(..., 0)` |
| Fixing saldo_esperado changes expected balances if recalculated | Low | Only read-time calcs change; insert-time increment stays same |
| Divisa ventas with `completacion_efectivo = total` (100% cash) | Low | Edge case works — sums correctly as cash |

## Rollback Plan

Revert changes to `venta.ts`, `jornada.service.ts`, `excel.service.ts`. No DB rollback needed — no schema changes.

## Dependencies

None. Migration V16 is already applied; the column exists.

## Success Criteria

- [ ] `totalEnCaja` signal returns $100 for a $4900 divisa + $100 cash venta
- [ ] `saldo_real` after cierre matches physical cash + completacion_efectivo for divisas
- [ ] Excel Ventas sheet shows `completacion_efectivo` column with correct values
- [ ] Excel Resumen "Total efectivo" matches cash actually received
- [ ] All pre-V16 ventas with NULL completacion_efectivo handled without errors
