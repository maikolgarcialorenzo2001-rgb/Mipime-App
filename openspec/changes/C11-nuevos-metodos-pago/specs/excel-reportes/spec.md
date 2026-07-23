# Excel Reportes Specification — C11 Delta

## Modificaciones

### Requirement: Tabla Cuenta Cosas en Resumen

La hoja Resumen DEBE incluir una tabla "Cuenta Cosas" con los registros del día, mostrando valores negativos.

#### Scenario: Tabla CC con valores negativos

- GIVEN una jornada con 2 registros CC (producto A x2 = -$2000, producto B x1 = -$1500)
- WHEN se genera el Excel de cierre
- THEN la hoja Resumen contiene una sección "Cuenta Cosas" con columnas Producto, Cantidad, Descripción, Autorizado por, Total
- AND el total parcial de CC se muestra como valor negativo (ej: -$3500)
- AND los valores NO afectan la fila de "Saldo esperado"

### Requirement: Fila de divisas en Resumen

La hoja Resumen DEBE mostrar un desglose de ventas en divisas.

#### Scenario: Resumen con divisas

- GIVEN ventas del día con forma_pago='divisas' (total $1950 ARS equivalente a 3 USD a tasa 650)
- WHEN se genera el Excel
- THEN la hoja Resumen contiene una fila "Total divisas" con el total en ARS
- AND este total YA está incluido en "Total ventas" (no suma aparte)

### Requirement: Pendientes entre paréntesis en Resumen

La hoja Resumen DEBE mostrar el total de ventas pendientes entre paréntesis, como valor informativo.

#### Scenario: Pendientes en Resumen

- GIVEN ventas del día con forma_pago='pendiente' (total $3000)
- WHEN se genera el Excel
- THEN la hoja Resumen contiene una fila "Pendientes del día" con el valor entre paréntesis (ej: "($3.000)")
- AND este valor NO se suma a ningún total de la jornada

### Requirement: Columnas condicionales en Ventas

La hoja Ventas DEBE mostrar información adicional según la forma de pago.

#### Scenario: Venta con divisas en Ventas sheet

- GIVEN una venta con forma_pago='divisas', divisa_tipo='USD', monto_divisa=3, tasa_cambio=650, total=1950
- WHEN se genera el Excel
- THEN la fila de esta venta incluye columnas "Divisa", "Monto en divisa", "Tasa de cambio", "Equivalente ARS"
- AND se lee: USD, 3.00, 650, $1.950

#### Scenario: Venta pendiente en Ventas sheet

- GIVEN una venta con forma_pago='pendiente', comprador_nombre='Carlos'
- WHEN se genera el Excel
- THEN la fila de esta venta incluye "Comprador" en columna adicional o nota