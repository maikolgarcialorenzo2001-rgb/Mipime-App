# Checkout Specification — C11 Delta

## Modificaciones

### Requirement: 5 opciones de pago

El sistema DEBE mostrar 5 opciones de forma de pago: Efectivo, Transferencia, Divisas, Pendiente, Cuenta Cosas.

#### Scenario: Selección de divisas muestra sub-formulario

- GIVEN el modal de checkout abierto
- WHEN el usuario selecciona "Divisas"
- THEN se muestran los campos: tipo de divisa (select: EUR/USD), monto en divisa (input numérico), tasa de cambio (input numérico)
- AND los 3 campos son obligatorios

#### Scenario: Selección de pendiente muestra sub-formulario

- GIVEN el modal de checkout abierto
- WHEN el usuario selecciona "Pendiente"
- THEN se muestran los campos: nombre del comprador (input), autorizado por (input), descripción (textarea opcional)
- AND nombre del comprador y autorizado por son obligatorios

#### Scenario: Selección de Cuenta Cosas muestra sub-formulario

- GIVEN el modal de checkout abierto
- WHEN el usuario selecciona "Cuenta Cosas"
- THEN se muestran los campos: autorizado por (input), descripción (textarea opcional)
- AND autorizado por es obligatorio

#### Scenario: Efectivo o transferencia sin cambios

- GIVEN el modal de checkout abierto
- WHEN el usuario selecciona "Efectivo" o "Transferencia"
- THEN NO se muestran campos adicionales
- AND el comportamiento es idéntico al actual

### Requirement: Payload de confirmación

El modal DEBE emitir un objeto con campos opcionales según la forma de pago seleccionada.

#### Scenario: Payload con divisas

- WHEN se confirma con forma_pago='divisas'
- THEN el payload contiene: `{ formaPago: 'divisas', divisaTipo: 'USD', montoDivisa: 3, tasaCambio: 650 }`

#### Scenario: Payload con pendiente

- WHEN se confirma con forma_pago='pendiente'
- THEN el payload contiene: `{ formaPago: 'pendiente', compradorNombre: 'Carlos', autorizadoPor: 'María', descripcion: 'Pago quincenal' }`

#### Scenario: Payload con Cuenta Cosas

- WHEN se confirma con forma_pago='cuenta_cosas'
- THEN el payload contiene: `{ formaPago: 'cuenta_cosas', autorizadoPor: 'María', descripcion: 'Retiro familiar' }`

#### Scenario: Payload sin extras

- WHEN se confirma con forma_pago='efectivo' o 'transferencia'
- THEN el payload contiene solo `{ formaPago: 'efectivo' }` (sin campos extra)