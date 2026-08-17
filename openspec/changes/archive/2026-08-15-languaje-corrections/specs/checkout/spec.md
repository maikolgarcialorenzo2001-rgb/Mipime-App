# Delta for Checkout

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
