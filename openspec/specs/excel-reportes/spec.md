# Excel Reportes Specification — Bug Fixes Delta

## MODIFIED Requirements

### Requirement: Tabla Cuenta Cosas con precio_costo

(Full replacement of C11 "Tabla Cuenta Cosas en Resumen")

La tabla Cuenta Cosas DEBE calcular "Total" como `−(cantidad × precio_costo)` usando `productosMap.precio_costo`. "Total C.C." suma estos valores.

(Previously: Total era `−cantidad` sin precio_costo)

#### Scenario: CC con precio_costo

- GIVEN CC: producto A cant=2, precio_costo=$1000
- WHEN generar Excel
- THEN columna Total = -$2000, Total C.C. = -$2000

#### Scenario: CC mixto

- GIVEN CC: A (cant=2, costo=$1000), B (cant=1, costo=$500)
- WHEN generar Excel
- THEN Total C.C. = -$2500

### Requirement: Total ingresos sin pendientes

(Full replacement of C11 "Pendientes entre paréntesis en Resumen" + "Columnas condicionales en Ventas" fila total)

La hoja Ventas y JornadaSheet DEBEN calcular "Total ingresos" excluyendo `forma_pago='pendiente'`. Los pendientes en fila separada "Pendientes del día". Resumen individual conserva comportamiento actual (fila entre paréntesis).

(Previously: "Total ingresos" incluía todas las ventas)

#### Scenario: Total excluye pendientes

- GIVEN $5000 efectivo, $3000 pendiente
- WHEN generar Excel
- THEN Ventas "Total ingresos"=$5000
- AND "Pendientes del día"=$3000
- AND JornadaSheet "Total ingresos"=$5000

#### Scenario: Solo pendientes

- GIVEN una venta pendiente de $2000
- WHEN generar Excel
- THEN "Total ingresos"=$0
- AND "Pendientes del día"=$2000
- AND hoja Resumen muestra "($2000)"

#### Scenario: Sin pendientes

- GIVEN jornada sin ventas pendientes
- WHEN generar Excel
- THEN "Total ingresos" suma normal
- AND no hay fila "Pendientes del día"

## ADDED Requirements

### Requirement: Total efectivo includes cash from divisa completacion

The Resumen, JornadaSheet, and Arqueo sheets MUST calculate "Total efectivo" by summing `efectivo.total` plus `COALESCE(divisas.completacion_efectivo, 0)` — the cash that actually entered the register, not just what was marked as efectivo payment.

(Previously: Only `forma_pago === 'efectivo'` was summed, missing cash completacion from divisa ventas)

#### Scenario: Resumen sheet shows correct cash total

- GIVEN a jornada with $3000 efectivo sale, $5000 divisa sale with $100 completacion, $2000 transferencia
- WHEN the Resumen Excel is generated
- THEN "Total efectivo" = $3000 + $100 = $3100
- AND "Total en caja" = monto_inicial + $3100 + ingresosExtra - gastos - compraDivisa

#### Scenario: Arqueo sheet comparison includes completacion

- GIVEN an arqueo total of $3050 and a jornada with $3000 efectivo + $100 completacion from divisas
- WHEN the Arqueo sheet is generated
- THEN totalEnCaja = monto_inicial + $3100 + movimientos
- AND the difference is calculated against that totalEnCaja

### Requirement: Completacion efectivo column in Ventas sheet

The Ventas sheet MUST show a "Completación efectivo" column in the divisa conditional columns section, displaying the cash completion amount for each divisa venta row.

#### Scenario: Divisa venta shows completacion column

- GIVEN a venta with `forma_pago = 'divisas'` and `completacion_efectivo = $100`
- WHEN the Ventas sheet is generated
- THEN the row includes a "Completación efectivo" cell with value $100

#### Scenario: Divisa venta without completacion shows 0

- GIVEN a venta with `forma_pago = 'divisas'` and NULL `completacion_efectivo`
- WHEN the Ventas sheet is generated
- THEN the "Completación efectivo" cell shows 0 or '-'

### Requirement: Abierta por / Cerrada por when opener differs from closer

The `JornadaReportData` MUST carry an optional additive field `userAperturaNombre: string | null` resolved from `user_apertura_id` (JOIN `usuarios`) at the same points where `userCierreNombre` is resolved today. In `_agregarResumen` and `_agregarJornadaSheet`, when BOTH `userAperturaNombre` and `userCierreNombre` exist AND differ, the sheet MUST write two rows `['Abierta por', userAperturaNombre]` and `['Cerrada por', userCierreNombre]`.

(Previously: only `['Firmado por', userCierreNombre]` was written; there was no opener name in the report data.)

#### Scenario: Resumen sheet shows opener and closer

- GIVEN a jornada opened by "Ana" (`user_apertura_id` names "Ana") and closed by "Beto"
- WHEN the Resumen sheet is generated
- THEN rows read "Abierta por Ana" and "Cerrada por Beto"

#### Scenario: JornadaSheet shows opener and closer

- GIVEN the same jornada with different opener/closer
- WHEN the JornadaSheet is generated
- THEN it also includes "Abierta por Ana" and "Cerrada por Beto"

### Requirement: Back-compat "Firmado por" when same user or legacy

When `userAperturaNombre` is null (legacy jornada without opener) OR opener and closer are the same user, the report MUST keep the current single row `['Firmado por', userCierreNombre]`. If `userCierreNombre` is also null, neither row is written (current behavior preserved).

#### Scenario: Same user opened and closed

- GIVEN `userAperturaNombre` equals `userCierreNombre` ("Ana")
- WHEN the report is generated
- THEN the single row "Firmado por Ana" is written

#### Scenario: Legacy jornada without opener name

- GIVEN `userAperturaNombre = null` and `userCierreNombre = "Beto"`
- WHEN the report is generated
- THEN the single row "Firmado por Beto" is written (no "Abierta por")

#### Scenario: Existing reports untouched

- GIVEN previously saved Excel reports
- WHEN the app is upgraded
- THEN stored `jornada_reportes` base64 content is never regenerated or altered

### Requirement: Etiquetas de divisa neutras en reportes

Los reportes Excel DEBEN rotular totales y cabeceras de divisa sin nombres regionales de moneda: la cabecera de la columna de divisa en la hoja Ventas DEBE leer "Total en pesos" (nunca "Total CUP"), y la fila de total de divisas en Resumen/JornadaSheet DEBE leer "Total divisas en pesos" (nunca "Total divisas en pesos cubanos"). "pesos cubanos" NO DEBE aparecer en ninguna etiqueta.

Los valores y cálculos NO DEBEN cambiar: solo cambian las etiquetas.

#### Scenario: Cabecera Ventas neutra

- GIVEN una venta con pago en divisas
- WHEN se genera la hoja Ventas
- THEN la cabecera de la columna de divisa lee "Total en pesos"
- AND ninguna cabecera contiene "Total CUP"

#### Scenario: Fila de total de divisas neutra

- GIVEN ventas en divisas en la jornada
- WHEN se genera Resumen o JornadaSheet
- THEN la etiqueta de la fila de total lee "Total divisas en pesos"
- AND "pesos cubanos" no aparece en ninguna etiqueta

#### Scenario: Cálculos intactos

- GIVEN una jornada con ventas en divisas
- WHEN se neutralizan las etiquetas
- THEN los valores y cálculos no cambian

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
