# Delta Spec: validar-saldo-caja-guard

## Domain: jornada-lifecycle

### ADDED Requirements

#### Requirement: Service guard — verificar saldo antes de egreso

`JornadaService` MUST exponer `saldoSuficientePara(monto)` que compare `saldo_esperado - monto >= 0` dentro de una transacción explícita (BEGIN/COMMIT/ROLLBACK) y MUST lanzar `Error` si el saldo es insuficiente.

`_registrarMovimientoAsync` MUST invocar `saldoSuficientePara` DENTRO de una transacción BEGIN/COMMIT/ROLLBACK que envuelve guard + INSERT + UPDATE, ANTES de insertar movimientos de tipo `gasto` o `compra_divisa`. La validación SHALL usar `saldo_esperado` leído desde la DB (no el signal `totalEnCaja()`).

##### Scenario: Gasto con saldo suficiente

- GIVEN `saldo_esperado = 10000` y usuario intenta registrar gasto de $3000
- WHEN `_registrarMovimientoAsync` ejecuta guard dentro de transacción
- THEN el guard pasa y el movimiento se inserta normalmente

##### Scenario: Gasto con saldo insuficiente

- GIVEN `saldo_esperado = 2000` y usuario intenta registrar gasto de $3000
- WHEN `_registrarMovimientoAsync` ejecuta guard
- THEN el guard lanza `Error("Saldo insuficiente en caja")`, ROLLBACK, y NO se inserta el movimiento

##### Scenario: Race condition — dos gastos simultáneos

- GIVEN `saldo_esperado = 5000` y dos usuarios intentan gastar $3000 cada uno
- WHEN ambos pasan el UI check simultáneamente
- THEN el primer guard lee `saldo_esperado = 5000` dentro de su transacción, pasa, inserta, COMMIT con `saldo_esperado = 2000`
- AND el segundo guard lee `saldo_esperado = 2000` dentro de su transacción, falla porque `2000 - 3000 < 0`, hace ROLLBACK
- AND el primer gasto se registra, el segundo se rechaza con error

##### Scenario: Merma sin validación de saldo

- GIVEN `saldo_esperado = 100` y usuario registra merma de $500 (costo de inventario)
- WHEN se llama `registrarMerma()`
- THEN NO se invoca `saldoSuficientePara` — la merma se registra sin importar el saldo

#### Requirement: UI guard — deshabilitar botón si saldo insuficiente

`jornada.page` MUST verificar `totalEnCaja()` signal antes de habilitar el botón de registrar gasto/compra_divisa. Usa el helper `saldoSuficientePara(monto)` para el cómputo reactivo. Si `totalEnCaja() < monto_ingresado`, el botón SHALL estar deshabilitado SHOW un tooltip "Saldo insuficiente en caja".

##### Scenario: UI permite gasto con saldo suficiente

- GIVEN `totalEnCaja() signal = 10000`, usuario ingresa monto gasto = $3000
- WHEN el componente verifica `totalEnCaja() >= monto`
- THEN botón "Registrar gasto" está habilitado, sin tooltip

##### Scenario: UI bloquea gasto con saldo insuficiente

- GIVEN `totalEnCaja() signal = 2000`, usuario ingresa monto gasto = $3000
- WHEN el componente verifica `totalEnCaja() < monto`
- THEN botón "Registrar gasto" está deshabilitado y tooltip "Saldo insuficiente en caja" es visible

### MODIFIED Requirements

#### Requirement: Saldo en caja label

(Sin cambios — el label y display de saldo no se modifican. Se agrega validación previa, el saldo se muestra igual.)

---

## Domain: checkout

### ADDED Requirements

#### Requirement: Service guard — verificar saldo antes de vuelto divisa

`venta.service._ejecutar()` MUST verificar `saldo_esperado` ANTES de aplicar vuelto en ventas divisa. El SELECT de `saldo_esperado` se ejecuta después de BEGIN TRANSACTION. Si `saldo_esperado - Math.max(0, vuelto) < 0`, MUST lanzar `Error` y hacer ROLLBACK de la transacción.

##### Scenario: Vuelto divisa con saldo suficiente

- GIVEN `saldo_esperado = 10000`, venta divisa total=$1800, billete=3 USD, tasa=650 ($1950), vuelto=$150
- WHEN `_ejecutar()` ejecuta guard después de BEGIN TRANSACTION
- THEN guard pasa porque `10000 - 150 >= 0`, venta se completa con COMMIT

##### Scenario: Vuelto divisa con saldo insuficiente

- GIVEN `saldo_esperado = 100`, venta divisa total=$1800, billete=3 USD, tasa=650 ($1950), vuelto=$150
- WHEN `_ejecutar()` ejecuta guard después de BEGIN TRANSACTION
- THEN guard lanza `Error("Saldo insuficiente para vuelto")`, transacción hace ROLLBACK, venta NO se registra

#### Requirement: UI guard — bloquear confirmar si vuelto > saldo

`checkout-modal` MUST recibir `saldoEnCaja` como input property desde POSPage (NO inyecta JornadaService directamente — decisión arquitectónica para mantener atomic design). Usa un computed `saldoInsuficienteVuelto` que verifica `saldoEnCaja() < vuelto`. El botón "Confirmar" usa un computed `formularioValidoConSaldo` combina validez del formulario + saldo suficiente. Si `saldoEnCaja() < vuelto`, botón SHALL estar deshabilitado con tooltip "Saldo insuficiente en caja" Y un mensaje visible en rojo (`.text-red-700`) explicando que el vuelto supera el saldo disponible.

##### Scenario: Checkout permite venta divisa con vuelto suficiente

- GIVEN `saldoEnCaja input = 10000`, vuelto calculado = $150
- WHEN checkout-modal computed verifica `saldoEnCaja >= vuelto`
- THEN botón "Confirmar" habilitado, sin mensaje de error

##### Scenario: Checkout bloquea venta divisa con vuelto insuficiente

- GIVEN `saldoEnCaja input = 100`, vuelto calculado = $150
- WHEN checkout-modal computed verifica `saldoEnCaja < vuelto`
- THEN botón "Confirmar" deshabilitado via `formularioValidoConSaldo`, tooltip "Saldo insuficiente para vuelto", mensaje visible en rojo

##### Scenario: Checkout permite venta efectivo/transferencia sin verificación de saldo

- GIVEN `saldoEnCaja = 100`, forma de pago = efectivo (sin vuelto desde caja)
- WHEN checkout-modal no aplica guard para formas no-divisa
- THEN botón "Confirmar" habilitado según validación normal de formulario

---

## Non-functional Requirements

- **NFR-1 (Service guard)**: MUST usar `saldo_esperado` leído desde DB (BEGIN TRANSACTION en _ejecutar, BEGIN/COMMIT/ROLLBACK en _registrarMovimientoAsync), NO el signal `totalEnCaja()`.
- **NFR-2 (UI guard)**: MUST usar `JornadaService.totalEnCaja()` signal (via `saldoSuficientePara()`) para feedback inmediato en jornada.page, y `saldoEnCaja` input binding en checkout-modal.
- **NFR-3 (Error propagation)**: Service guard MUST propagar error como `throw`. La UI captura y muestra toast/notificación.
- **NFR-4 (New records only)**: Validación MUST aplicarse solo a nuevos registros. No modifica comportamiento de registros existentes.
- **NFR-5 (Transaction isolation)**: `_registrarMovimientoAsync` MUST envolver guard + INSERT + UPDATE en BEGIN/COMMIT/ROLLBACK explícito para eliminar race condition window.
- **NFR-6 (CheckoutModal pure component)**: CheckoutModal NO inyecta JornadaService. Recibe `saldoEnCaja` como input. POSPage orquesta.

---

## Summary

| Domain | Type | Added Reqs | Modified Reqs | Scenarios |
|--------|------|-----------|---------------|-----------|
| jornada-lifecycle | Delta | 2 (Service guard + UI guard) | 0 | 6 |
| checkout | Delta | 2 (Service guard + UI guard) | 0 | 5 |
| **Total** | | **4** | **0** | **11** |

Coverage: Happy paths ✅, Edge cases ✅ (race condition con transacción, merma excluded, vuelto=0), Error states ✅ (3 error scenarios + mensaje visible).

### Implementation Delta (vs original spec)
| Aspect | Original Spec | Implemented | 
|--------|--------------|-------------|
| Method name | `verificarSaldoSuficiente` | `saldoSuficientePara` |
| Transaction in _registrarMovimientoAsync | "misma transacción" (implícita) | BEGIN/COMMIT/ROLLBACK explícito |
| CheckoutModal DI | Inyectar JornadaService | Input `saldoEnCaja` binding |
| UI feedback (checkout) | Solo disabled button | Disabled + `.text-red-700` mensaje visible |
| Race condition protection | SQLite isolation general | Transacción explícita + isolation |
| NFRs | 4 | 6 (added NFR-5 transaction isolation, NFR-6 pure component)
