# Proposal: IPVE Sheet — Stock Tienda Inicial + Entradas

## Intent

The IPVE sheet currently shows "Stock Tienda" as the end-of-day value, giving no visibility into stock flow during the journa. Store owners cannot see how much inventory started the day, how many units were transferred from the warehouse, or how that changed their position. This change adds two derived columns — "Stck Tienda Inicial" and "Entradas" — so the IPVE sheet tells the full stock story per product.

## Scope

### In Scope
- Rename "Stock Tienda" → "Stck Tienda Final" (no data change, label only)
- Add "Stck Tienda Inicial" column — derived from existing data
- Add "Entradas" column — derived from `stockMovimientos` (tipo='traslado')
- Reorder columns to 9-column layout
- Shift merma side-table from col offset 8 → 10
- Update all 8 existing IPVE tests + add new tests for derived values

### Out of Scope
- Schema changes (no new DB columns or tables)
- Monthly export (IPVE sheet is daily-only)
- Accurate initial stock when non-default ubicacion salidas/mermas occur (accepted trade-off)

## Capabilities

### Modified Capabilities
- `excel-reportes`: IPVE sheet column layout changes and derived stock flow calculations

## Approach

All new values are **derived** from existing `JornadaReportData` fields — no new interface fields or DB reads required.

| Concern | Solution |
|---------|----------|
| Entradas (warehouse→shop) | `stockMovimientos.filter(m.tipo==='traslado').sum(cantidad)` — unambiguous transfer signal |
| Ventas from shop | `ventas.flatMap(v.detalles).sum(d.cantidad)` — `registrarSalida` defaults ubicacion='shop' |
| Mermas from shop | `stockMovimientos.filter(m.tipo==='merma').sum(cantidad)` — `registrarMerma` defaults ubicacion='shop' |
| Stck Tienda Inicial | `stockShopFinal + ventasTienda + mermaTienda - entradas` (reverse engineering) |
| Edge: no movements | `stckTiendaInicial = stockShopFinal` (all derived terms = 0) |
| Column reorder | 9 data cols: Nombre, Stck Tienda Inicial, Entradas, Stck Tienda Final, Stock Almacén, Precio Venta, Ingreso Esperado, Total Invertido, Ganancia Potencial |
| Merma side-table | Shift from `{r:0, c:8}` → `{r:0, c:10}` (9 data cols + 1 blank) |
| Null values | Same `—` pattern as existing code when pv/stock fields are undefined |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/excel.service.ts:11-17` | Modified | `ProductoInfo` — no schema change needed (derived values computed in method) |
| `src/app/services/excel.service.ts:952-1008` | Modified | `_agregarIpve` — rewrite column layout, add derivation logic, shift merma offset |
| `src/app/services/excel.service.spec.ts:1141-1278` | Modified | 8 existing IPVE tests — update header expectations (7→9 cols), column indices, and add 2-3 new test cases for derived values |
| `openspec/specs/excel-reportes/spec.md` | Modified | Add IPVE stock-flow requirement with scenarios |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-default ubicacion salidas/mermas make initial inaccurate | Low (edge case) | Documented as accepted trade-off; shop ubicacion is the default |
| Ajuste absolute type resets shop to 0 | Low (rare) | Derived formula still holds — ajuste doesn't enter the equation |
| Merma offset shift breaks other consumers | None | Side-table is internal to the sheet, no external readers |
| `ventas` or `stockMovimientos` undefined | Low | Guard: if missing, derived values default to 0 |

## Rollback Plan

Revert changes to `_agregarIpve` in `excel.service.ts` and restore original 7-column layout in tests. The IPVE sheet is generated at export time — previously generated Excel files are unaffected.

## Dependencies

- None (all required data already flows through `JornadaReportData`)

## Success Criteria

- [ ] IPVE sheet has exactly 9 columns in the specified order
- [ ] "Stck Tienda Inicial" is correct: `final + ventas + merma - entradas` per product
- [ ] "Entradas" sums all `tipo='traslado'` movements for the journa
- [ ] Merma side-table appears at column offset 10
- [ ] Products with no movements show `inicial = final` and `entradas = 0`
- [ ] Null pv/stock products render `—` correctly across all 9 columns
- [ ] Totals row sums Ingreso Esperado, Total Invertido, Ganancia Potencial correctly (unchanged)
- [ ] All 8 existing tests pass + 2-3 new tests for derived values
- [ ] `npm run lint` and type-check pass with zero errors
