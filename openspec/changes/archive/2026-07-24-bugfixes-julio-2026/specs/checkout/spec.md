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
