# Delta for Excel Reportes — IPVE Stock Flow

## RENAMED Requirements

### Requirement: IPVE "Stock Tienda" column → "Stck Tienda Final"

(Reason: Clarifies end-of-day store stock, distinguishing from new initial stock column.)
(Migration: Update header string in `_agregarIpve` and test expectations for header[3].)

## ADDED Requirements

### Requirement: IPVE "Stck Tienda Inicial" derived column

The IPVE sheet SHALL include a "Stck Tienda Inicial" column (index 1). Per product, the system SHALL compute:

```
stckTiendaInicial = stockShopFinal + ventasTienda + mermaTienda - entradas
```

- `ventasTienda` = `ventas.flatMap(v => v.detalles).filter(d => d.producto_id === id).sum(cantidad)`
- `mermaTienda` = `stockMovimientos.filter(m => m.producto_id === id && m.tipo === 'merma').sum(cantidad)`
- `entradas` = `stockMovimientos.filter(m => m.producto_id === id && m.tipo === 'traslado').sum(cantidad)`

If `ventas` or `stockMovimientos` is undefined, the corresponding term SHALL default to 0.

#### Scenario: Mixed movements

- GIVEN Harina: stock_shop=20, ventas=5, merma=2, entradas=7
- WHEN the IPVE sheet is generated
- THEN "Stck Tienda Inicial" = 20 + 5 + 2 - 7 = 20

#### Scenario: No movements

- GIVEN Azúcar: stock_shop=5, no ventas, no mermas, no traslados
- WHEN the IPVE sheet is generated
- THEN "Stck Tienda Inicial" = 5 (equals stock_shop)

#### Scenario: Only merma, no ventas or entradas

- GIVEN Leche: stock_shop=10, merma=3, no ventas, no traslados
- WHEN the IPVE sheet is generated
- THEN "Stck Tienda Inicial" = 10 + 0 + 3 - 0 = 13

#### Scenario: undefined stockMovimientos

- GIVEN stock_shop=8, ventas=2, stockMovimientos undefined
- WHEN the IPVE sheet is generated
- THEN "Stck Tienda Inicial" = 8 + 2 + 0 - 0 = 10

### Requirement: IPVE "Entradas" derived column

The IPVE sheet SHALL include an "Entradas" column (index 2) for warehouse-to-store transfers. The system SHALL compute per product:

```
entradas = stockMovimientos.filter(m => m.producto_id === id && m.tipo === 'traslado').sum(cantidad)
```

If `stockMovimientos` is undefined, entradas SHALL default to 0.

#### Scenario: Has traslado movements

- GIVEN Harina: stockMovimientos includes tipo='traslado' cantidad=7
- WHEN the IPVE sheet is generated
- THEN "Entradas" = 7

#### Scenario: No traslado movements

- GIVEN Azúcar: stockMovimientos exists but no tipo='traslado'
- WHEN the IPVE sheet is generated
- THEN "Entradas" = 0

#### Scenario: undefined stockMovimientos

- GIVEN stockMovimientos undefined
- WHEN the IPVE sheet is generated
- THEN "Entradas" = 0 for all products

### Requirement: IPVE 9-column layout

The IPVE sheet SHALL have exactly 9 data columns in this order:

| Index | Header |
|-------|--------|
| 0 | Nombre |
| 1 | Stck Tienda Inicial |
| 2 | Entradas |
| 3 | Stck Tienda Final |
| 4 | Stock Almacén |
| 5 | Precio Venta |
| 6 | Ingreso Esperado |
| 7 | Total Invertido |
| 8 | Ganancia Potencial |

Existing formulas for Ingreso Esperado, Total Invertido, and Ganancia Potencial SHALL remain unchanged. The Totals row SHALL sum columns 6, 7, and 8.

#### Scenario: Header row has 9 columns

- GIVEN any journa with inversionPorProducto defined
- WHEN the IPVE sheet is generated
- THEN header contains exactly 9 cells in the specified order

#### Scenario: Null pv/stock renders dash

- GIVEN a product with precio_venta undefined
- WHEN the IPVE sheet is generated
- THEN Stck Tienda Inicial, Stck Tienda Final, Stock Almacén, Precio Venta, Ingreso Esperado, Ganancia Potencial show '—'
- AND Total Invertido shows the inversion value (or 0)

### Requirement: IPVE merma side-table offset 10

The merma side-table ("Merma del día") SHALL be placed at column offset 10 (9 data columns + 1 blank), shifted from current offset 8.

#### Scenario: Merma at correct offset

- GIVEN journa with total_merma=2500
- WHEN the IPVE sheet is generated
- THEN merma label is at column index 10, value at column index 11
