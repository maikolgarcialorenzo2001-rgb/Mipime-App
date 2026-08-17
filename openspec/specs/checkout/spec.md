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

Los textos del sub-form divisas y del vuelto, en checkout-modal y cobro-pendiente-modal, DEBEN usar español neutro: "Complete con efectivo o aumente el monto en divisa." cuando el monto en divisa no cubre el total, y "Reduzca el billete o elija otra forma de pago." cuando el vuelto supera el saldo en caja. Ninguno DEBE contener voseo rioplatense ("Completá", "aumentá", "Reducí", "elegí").

(Previously: montoDivisa y tasaCambio eran inputs editables sin vuelto; textos del sub-form divisas en voseo rioplatense)

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

#### Scenario: «Complete» cuando el monto en divisa no cubre el total

- GIVEN checkout-modal o cobro-pendiente-modal con forma de pago "Divisas" y monto en divisa insuficiente
- WHEN se renderiza el aviso de monto faltante
- THEN el texto muestra "Complete con efectivo o aumente el monto en divisa."
- AND no contiene "Completá" ni "aumentá"

#### Scenario: «Reduzca» cuando el vuelto supera el saldo en caja

- GIVEN checkout-modal o cobro-pendiente-modal con vuelto mayor al saldo disponible en caja
- WHEN se renderiza el aviso de saldo insuficiente
- THEN el texto muestra "Reduzca el billete o elija otra forma de pago."
- AND no contiene "Reducí" ni "elegí"

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

### Requirement: Cuenta Cosas path registers per-product rows

`confirmarVenta` with `formaPago = 'cuenta_cosas'` MUST call `registrarLote` with one item per cart product, each carrying its own `cantidad` (no collapse to `items[0]`), and MUST apply `payload.descripcion` and `payload.autorizadoPor` to the whole batch. When the cart is empty, `confirmarVenta` MUST return early without calling any service.

(Added: no existing checkout requirement covered this path; replaces the buggy collapse-to-first-product behavior in `pos.page.ts`.)

#### Scenario: Multi-product cart calls registrarLote per product (testable)

- GIVEN a cart with A×2 and B×3 and `formaPago = 'cuenta_cosas'`
- WHEN `confirmarVenta` runs
- THEN `registrarLote` is called with `[{A,2},{B,3}]`
- AND the single-item `registrar` is NOT called

#### Scenario: Empty cart guard (testable)

- GIVEN an empty cart and `formaPago = 'cuenta_cosas'`
- WHEN `confirmarVenta` runs
- THEN the method returns early and no service call is made

#### Scenario: Sale metadata applies to the whole batch (testable)

- GIVEN `payload.descripcion = "Retiro familiar"` and `payload.autorizadoPor = "María"`
- WHEN `confirmarVenta` runs
- THEN `registrarLote` receives those `descripcion` and `autorizadoPor` values for the batch
