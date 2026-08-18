# Tasks: IPVE Sheet — Stock Tienda Inicial + Entradas

## Workload Forecast

| Metric | Value |
|--------|-------|
| Total estimated changed lines | ~135 |
| Chained PRs needed | No (budget: 400 lines) |
| Risk level | Low — single method + tests, no schema changes |

---

## T1: Compute journa-scoped aggregates

**Description**: Add per-product Maps (entradasMap, mermaMap, ventasMap) at the top of `_agregarIpve`, derived from `data.stockMovimientos` and `data.ventas`.

**File**: `src/app/services/excel.service.ts:956-957` (insert after `if (!inv || !pmap) return;`)

**What to do**:
1. Default `data.ventas` and `data.stockMovimientos` to `[]` if undefined.
2. Declare three `Map<number, number>` maps: `entradasMap`, `mermaMap`, `ventasMap`.
3. Single pass over `stockMovs` — accumulate `entradasMap` for `tipo === 'traslado'`, `mermaMap` for `tipo === 'merma'`.
4. Nested loop over `ventas.flatMap(v => v.detalles)` — accumulate `ventasMap` by `d.producto_id`.

**Estimated changed lines**: +17

**Acceptance criteria**:
- No compile errors; maps are typed as `Map<number, number>`.
- Each map is empty when `stockMovimientos`/`ventas` are undefined or empty.
- `npm run lint` passes.

**Dependencies**: None.

---

## T2: Update header and row construction

**Description**: Replace the 7-column header array and update per-product row construction to produce 9 columns with the new derived values.

**File**: `src/app/services/excel.service.ts:960, 967-984`

**What to do**:
1. Replace header at line 960 with 9-element array: `['Nombre', 'Stck Tienda Inicial', 'Entradas', 'Stck Tienda Final', 'Stock Almacén', 'Precio Venta', 'Ingreso Esperado', 'Total Invertido', 'Ganancia Potencial']`.
2. Inside the `for` loop (line 967), after extracting `stockShop`, compute derived values:
   ```
   entradas = entradasMap.get(productoId) ?? 0
   ventasProd = ventasMap.get(productoId) ?? 0
   mermaProd = mermaMap.get(productoId) ?? 0
   stckTiendaInicial = stockShop != null ? stockShop + ventasProd + mermaProd - entradas : null
   ```
3. Update valid-path row (line 980) to 9-element array: `[info.nombre, stckTiendaInicial, entradas, stockShop, stockAlmacen, pv, ingreso, inversion, ganancia]`.
4. Update null-path row (line 983) to 9-element array: `[info.nombre, stckTiendaInicial ?? '—', entradas, stockShop ?? '—', stockAlmacen ?? '—', '—', '—', inversion, '—']`.

**Estimated changed lines**: +18 (1 header + 8 derived vars + 2 row arrays + 7 index shifts)

**Acceptance criteria**:
- Row arrays always have exactly 9 elements.
- `stckTiendaInicial` equals `stockShop + ventas + merma - entradas` when stockShop is defined.
- `stckTiendaInicial` is `null` when `stockShop` is undefined.
- `npm run lint` passes.

**Dependencies**: T1 (uses the maps).

---

## T3: Update totals row and merma offset

**Description**: Adjust totals row to place sums at column indices 6/7/8 and shift merma side-table from offset 8 to 10.

**File**: `src/app/services/excel.service.ts:988, 994`

**What to do**:
1. Line 988 — change totals row to: `filas.push(['TOTALES', '', '', '', '', '', sumIngreso, sumInversion, sumGanancia]);` (9 elements, sums at indices 6,7,8).
2. Line 994 — change `c: 8` to `c: 10`.

**Estimated changed lines**: 2

**Acceptance criteria**:
- Totals row has 9 elements; sums are at indices 6, 7, 8.
- Merma side-table appears at column index 10 in the generated sheet.
- `npm run lint` passes.

**Dependencies**: T2 (header layout must be final).

---

## T4: Update column widths

**Description**: Replace the 7-element `!cols` array with a 9-element array matching the new column order.

**File**: `src/app/services/excel.service.ts:996-1004`

**What to do**:
Replace the existing `!cols` block with:
```ts
ws['!cols'] = [
  { wch: 20 },  // Nombre
  { wch: 18 },  // Stck Tienda Inicial
  { wch: 12 },  // Entradas
  { wch: 18 },  // Stck Tienda Final
  { wch: 16 },  // Stock Almacén
  { wch: 14 },  // Precio Venta
  { wch: 18 },  // Ingreso Esperado
  { wch: 18 },  // Total Invertido
  { wch: 18 },  // Ganancia Potencial
];
```

**Estimated changed lines**: 9

**Acceptance criteria**:
- `ws['!cols']` has exactly 9 entries.
- Widths match the spec values.
- `npm run lint` passes.

**Dependencies**: T2 (column order must be final).

---

## T5: Update existing tests

**Description**: Update the 8 existing IPVE tests in the spec file to match the new 9-column layout and shifted column indices.

**File**: `src/app/services/excel.service.spec.ts:1141-1284`

**What to do**:
1. **`ipveData()` factory** (line 1153): Add `ventas` and `stockMovimientos` to the returned object. For the existing test data, use empty arrays (`[]`) so the default behavior tests still pass (stckTiendaInicial = stockShopFinal, entradas = 0).
2. **Test 4.1 "sheet exists"** (line 1159): No change needed.
3. **Test 4.2 "header 7 columns"** (line 1166): Update to assert 9 headers. Rename test description to "9 columnas". Change assertions:
   - `header[0]` → `'Nombre'`
   - `header[1]` → `'Stck Tienda Inicial'`
   - `header[2]` → `'Entradas'`
   - `header[3]` → `'Stck Tienda Final'`
   - `header[4]` → `'Stock Almacén'`
   - `header[5]` → `'Precio Venta'`
   - `header[6]` → `'Ingreso Esperado'`
   - `header[7]` → `'Total Invertido'`
   - `header[8]` → `'Ganancia Potencial'`
4. **Test 4.3 "ingreso y ganancia por producto"** (line 1182): Shift column indices for Harina and Azúcar:
   - `[1]` was Stock Almacén(80) → now `[1]` is Stck Tienda Inicial (= 20 with no movements), `[4]` is Stock Almacén(80)
   - `[2]` was Stock Tienda(20) → now `[2]` is Entradas(0), `[3]` is Stck Tienda Final(20)
   - `[3]` was Precio Venta(850) → now `[5]` is Precio Venta(850)
   - `[4]` Ingreso Esperado(85000) → now `[6]`
   - `[5]` Total Invertido(55000) → now `[7]`
   - `[6]` Ganancia Potencial(30000) → now `[8]`
   - Same pattern for Azúcar.
5. **Test 4.6 "merma offset"** (line 1210): Change `r[8]` → `r[10]`, `r[9]` → `r[11]`. Update description to "columna 10".
6. **Test 4.4 "totales"** (line 1224): Shift indices: `[4]` → `[6]`, `[5]` → `[7]`, `[6]` → `[8]`.
7. **Test 4.5 "null pv"** (line 1239): Shift indices: `[3]` → `[5]`, `[4]` → `[6]`, `[6]` → `[8]`. Also add assertions for new columns: `[1]` (Stck Tienda Inicial), `[2]` (Entradas), `[3]` (Stck Tienda Final) should all be `'—'` or 0 since stock_shop is undefined.
8. **Test 4.1 "inversionPorProducto undefined"** (line 1257): No change needed.
9. **Test 4.1 "producto sin inversión"** (line 1265): Shift `azucarRow![5]` → `azucarRow![7]`.

**Estimated changed lines**: ~55

**Acceptance criteria**:
- All 8 existing tests pass with the new column layout.
- `ipveData()` factory provides `ventas: []` and `stockMovimientos: []`.
- `npm run lint && npm run test` passes.

**Dependencies**: T1, T2, T3, T4 (implementation must be complete).

---

## T6: Add new tests for derived values

**Description**: Add 2 new test cases covering the derived column formulas: no-movements scenario and mixed-movements scenario.

**File**: `src/app/services/excel.service.spec.ts` (insert after test 4.1 "sin inversión", before line 1286 closing `});`)

**What to do**:
1. **Test 4.7 — No movements**: Create data with `ventas: []`, `stockMovimientos: []`. Assert:
   - `stckTiendaInicial === stockShopFinal` for each product.
   - `entradas === 0` for each product.
2. **Test 4.8 — Mixed movements**: Create data with:
   - `stockMovimientos: [{tipo:'traslado', cantidad:7, producto_id:1}, {tipo:'merma', cantidad:2, producto_id:1}]`
   - `ventas` with a VentaConDetalles where `detalles: [{producto_id:1, cantidad:5}]`
   - Assert for product 1 (Harina, stock_shop=20):
     - `entradas = 7` (column 2)
     - `stckTiendaInicial = 20 + 5 + 2 - 7 = 20` (column 1)

**Estimated changed lines**: +40

**Acceptance criteria**:
- Both new tests pass.
- Derived formula is verified for both edge cases (empty and mixed).
- `npm run lint && npm run test` passes.

**Dependencies**: T5 (existing test patterns established).

---

## Execution Order

```
T1 → T2 → T3 → T4 → T5 → T6
```

Sequential chain — each task depends on the prior one being in place. No parallelizable work units.
