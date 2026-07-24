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
