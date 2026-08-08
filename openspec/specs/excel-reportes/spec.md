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
