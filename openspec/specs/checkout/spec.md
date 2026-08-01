# Checkout Specification — Bug Fixes Delta

## MODIFIED Requirements

### Requirement: 5 opciones de pago — Sub-formulario divisas

(Supersedes C11 checkout scenario "Selección de divisas muestra sub-formulario")

El sistema DEBE mostrar 5 opciones: Efectivo, Transferencia, Divisas, Pendiente, Cuenta Cosas. Al seleccionar "Divisas":

- `tasaCambio`: input editable (> 0)
- `montoDivisa`: readonly, computado como `Math.ceil(total / tasaCambio)`
- "Vuelto: $X": `(montoDivisa × tasaCambio) − total`
- Si tasaCambio=0 o vacío: montoDivisa="—", NO confirmar

Pendiente y Cuenta Cosas mantienen comportamiento C11 sin cambios. Efectivo/Transferencia sin formularios extra.

(Previously: montoDivisa y tasaCambio eran inputs editables sin vuelto)

#### Scenario: Monto sin vuelto

- GIVEN total=$1950
- WHEN ingresa tasaCambio=650
- THEN montoDivisa=3, vuelto=$0

#### Scenario: Monto con vuelto

- GIVEN total=$1800
- WHEN ingresa tasaCambio=650
- THEN montoDivisa=3, vuelto=$150

#### Scenario: Payload

- GIVEN total=$1950, tasaCambio=650
- WHEN confirma
- THEN payload.montoDivisa=3, payload.tasaCambio=650

#### Scenario: Tasa inválida

- GIVEN total=$1950
- WHEN tasaCambio=0 o vacío
- THEN montoDivisa="—", confirmar bloqueado

## ADDED Requirements

### Requirement: Service guard — verificar saldo antes de vuelto divisa

`venta.service._ejecutar()` MUST verificar `saldo_esperado` ANTES de aplicar vuelto en ventas divisa. El SELECT de `saldo_esperado` se ejecuta después de BEGIN TRANSACTION. Si `saldo_esperado - Math.max(0, vuelto) < 0`, MUST lanzar `Error` y hacer ROLLBACK de la transacción.

#### Scenario: Vuelto divisa con saldo suficiente

- GIVEN `saldo_esperado = 10000`, venta divisa total=$1800, billete=3 USD, tasa=650 ($1950), vuelto=$150
- WHEN `_ejecutar()` ejecuta guard después de BEGIN TRANSACTION
- THEN guard pasa porque `10000 - 150 >= 0`, venta se completa con COMMIT

#### Scenario: Vuelto divisa con saldo insuficiente

- GIVEN `saldo_esperado = 100`, venta divisa total=$1800, billete=3 USD, tasa=650 ($1950), vuelto=$150
- WHEN `_ejecutar()` ejecuta guard después de BEGIN TRANSACTION
- THEN guard lanza `Error("Saldo insuficiente para vuelto")`, transacción hace ROLLBACK, venta NO se registra

### Requirement: UI guard — bloquear confirmar si vuelto > saldo

`checkout-modal` MUST recibir `saldoEnCaja` como input property desde POSPage (NO inyecta JornadaService directamente — decisión arquitectónica para mantener atomic design). Usa un computed `saldoInsuficienteVuelto` que verifica `saldoEnCaja() < vuelto`. El botón "Confirmar" usa un computed `formularioValidoConSaldo` que combina validez del formulario + saldo suficiente. Si `saldoEnCaja() < vuelto`, botón SHALL estar deshabilitado con tooltip "Saldo insuficiente en caja" Y un mensaje visible en rojo (`.text-red-700`) explicando que el vuelto supera el saldo disponible.

#### Scenario: Checkout permite venta divisa con vuelto suficiente

- GIVEN `saldoEnCaja input = 10000`, vuelto calculado = $150
- WHEN checkout-modal computed verifica `saldoEnCaja >= vuelto`
- THEN botón "Confirmar" habilitado, sin mensaje de error

#### Scenario: Checkout bloquea venta divisa con vuelto insuficiente

- GIVEN `saldoEnCaja input = 100`, vuelto calculado = $150
- WHEN checkout-modal computed verifica `saldoEnCaja < vuelto`
- THEN botón "Confirmar" deshabilitado via `formularioValidoConSaldo`, tooltip "Saldo insuficiente para vuelto", mensaje visible en rojo

#### Scenario: Checkout permite venta efectivo/transferencia sin verificación de saldo

- GIVEN `saldoEnCaja = 100`, forma de pago = efectivo (sin vuelto desde caja)
- WHEN checkout-modal no aplica guard para formas no-divisa
- THEN botón "Confirmar" habilitado según validación normal de formulario
