# Delta for Excel Reportes

## ADDED Requirements

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
