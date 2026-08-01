# Delta for excel-reportes

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
