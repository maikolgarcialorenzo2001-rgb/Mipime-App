# Ventas Specification — C11 Delta

## Modificaciones

### Requirement: Forma de pago divisas

El sistema DEBE soportar `forma_pago = 'divisas'` con campos obligatorios `divisa_tipo` (EUR|USD), `monto_divisa` (> 0) y `tasa_cambio` (> 0). El `total` de la venta se calcula como `monto_divisa * tasa_cambio` en ARS.

#### Scenario: Venta en divisas exitosa

- GIVEN una jornada abierta, carrito con productos
- WHEN se confirma venta con forma_pago='divisas', divisa_tipo='USD', monto_divisa=3, tasa_cambio=650
- THEN se INSERT en ventas con forma_pago='divisas', total=1950, divisa_tipo='USD', monto_divisa=3, tasa_cambio=650
- AND se actualiza `total_ventas += 1950` y `saldo_esperado += 1950` de la jornada
- AND se descuenta stock

#### Scenario: Tasa de cambio o monto inválido

- GIVEN el modal de checkout con divisas seleccionado
- WHEN se ingresa tasa_cambio = 0, monto_divisa = 0 o valores negativos
- THEN el sistema DEBE mostrar error "La tasa de cambio debe ser mayor a 0" o "El monto en divisa debe ser mayor a 0"
- AND NO permitir confirmar la venta

### Requirement: Forma de pago pendiente

El sistema DEBE soportar `forma_pago = 'pendiente'` con campos obligatorios `comprador_nombre` y `autorizado_por`, y campo opcional `descripcion`.

#### Scenario: Venta pendiente exitosa

- GIVEN una jornada abierta, carrito con productos
- WHEN se confirma venta con forma_pago='pendiente', comprador_nombre='Carlos', autorizado_por='María'
- THEN se INSERT en ventas con los datos correspondientes, total = suma del carrito
- AND se descuenta stock
- AND NO se actualiza `total_ventas` ni `saldo_esperado` de la jornada

### Requirement: CHECK constraint actualizado

La columna `forma_pago` DEBE permitir: `'efectivo'`, `'transferencia'`, `'divisas'`, `'pendiente'`.
(Previously: solo 'efectivo' y 'transferencia')