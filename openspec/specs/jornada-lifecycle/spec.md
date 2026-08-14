# Jornada Lifecycle Specification

## Purpose

Define the complete lifecycle of a jornada from opening to closure, including the new owner tracking and merma fields.

## Requirements

### Requirement: Jornada Opening

The system MUST create a new jornada with the owner's user ID when an admin opens a new day.

#### Scenario: Open jornada with owner

- GIVEN an admin is logged in (user id=1)
- WHEN they open a new jornada with monto_inicial=5000
- THEN a jornada record is created with:
  - fecha = today
  - hora_apertura = current time
  - monto_inicial = 5000
  - total_ventas = 0
  - total_gastos = 0
  - total_merma = 0
  - saldo_esperado = 5000
  - estado = 'abierta'
  - user_apertura_id = 1

### Requirement: Jornada Financial Calculations

The system MUST calculate cash-based balances (saldo_esperado at insert time, totalEnCaja and saldoRealCalculado at read time) by accounting for both `efectivo` ventas (full total) and `divisas` ventas (only their `completacion_efectivo` portion, COALESCE to 0). Other payment forms (`transferencia`, `pendiente`, `cuenta_cosas`) MUST NOT affect cash register totals.

(Previously: Only `forma_pago === 'efectivo'` was counted; divisa ventas inflated saldo_esperado by their full total and were invisible to read-time cash calculations)

#### Scenario: Efectivo sale

- GIVEN a sale of $3000 with `forma_pago = 'efectivo'`
- WHEN the sale is registered
- THEN `saldo_esperado += 3000`
- AND read-time cash calculations include $3000

#### Scenario: Pure divisa sale (no cash completion)

- GIVEN a sale of $5000 (10 USD × 500) with NO `completacion_efectivo`
- WHEN the sale is registered
- THEN `saldo_esperado += 0` (no cash entered the register)
- AND read-time cash calculations show $0 from this sale

#### Scenario: Mixed divisa+cash sale

- GIVEN a sale of $5000 (7 USD × 700 = $4900) with `completacion_efectivo = $100`
- WHEN the sale is registered
- THEN `saldo_esperado += 100` (only the cash portion)
- AND read-time cash calculations include $100 from completacion

#### Scenario: Transferencia sale

- GIVEN a sale of $2000 with `forma_pago = 'transferencia'`
- WHEN the sale is registered
- THEN `saldo_esperado += 0`
- AND read-time cash calculations exclude this sale

#### Scenario: Pendiente sale

- GIVEN a sale of $1500 with `forma_pago = 'pendiente'`
- WHEN the sale is registered
- THEN `saldo_esperado += 0`
- AND read-time cash calculations exclude this sale

### Requirement: Jornada Closure records the authenticated closer

The system MUST close a jornada with complete financial data and Excel report, recording `user_cierre_id` = the CURRENT authenticated user who performs the closure (not the opener `user_apertura_id`). At closure, `saldo_real` MUST be calculated as `monto_inicial + totalEfectivoCash + totalMovimientos`, where `totalEfectivoCash` sums `efectivo.total` plus `divisas.completacion_efectivo` (COALESCE 0).

(Previously: `cerrarYGuardar()` on login passed `user_apertura_id` as the user id, which recorded `user_cierre_id = 0` on legacy jornadas without an opener. `saldo_real` math unchanged.)

#### Scenario: Close jornada with mixed payments

- GIVEN an open jornada with $5000 monto_inicial, $3000 efectivo sale, $5000 divisa sale with $100 completacion, $0 movimientos
- WHEN the authenticated admin confirms closure
- THEN `saldo_real = 5000 + (3000 + 100) + 0 = 8100`
- AND estado changes to 'cerrada'
- AND `user_cierre_id` = the authenticated closer
- AND Excel report is generated

#### Scenario: Closing another user's opened jornada (B closes A's jornada)

- GIVEN a jornada opened by user A and resumed by user B
- WHEN B confirms closure from the reopen modal ("Cerrar y guardar")
- THEN `user_cierre_id` = B
- AND `user_apertura_id` remains A (ownership preserved, no reassignment)

#### Scenario: Close legacy jornada without opener

- GIVEN an open jornada with `user_apertura_id = NULL` (legacy)
- WHEN an authenticated user closes it
- THEN `user_cierre_id` = the authenticated user's id (not 0)

### Requirement: Jornada State Tracking

The system MUST track the jornada state via the `jornadaAbierta` signal, populated by `obtenerAbierta()` which now returns the most recent open jornada regardless of date.

(Previously: `obtenerAbierta()` filtered `fecha = hoy`, so `jornadaAbierta` was null when only a previous-day jornada was open.)

#### Scenario: Signal reflects current state

- GIVEN a jornada is open (today or latest of previous days)
- WHEN jornadaAbierta is read
- THEN it returns the Jornada object with all fields including user_apertura_id and total_merma

#### Scenario: Signal null when no open jornada

- GIVEN no jornada with `estado='abierta'` exists (any fecha)
- WHEN jornadaAbierta is read
- THEN it returns null

#### Scenario: POS benefits from previous-day open jornada

- GIVEN an open jornada with `fecha` from a previous day
- WHEN the POS reads the `jornadaAbierta` signal after login
- THEN `sinJornada = false`
- AND "Cobrar Pendiente"/"Ver Pendientes" buttons are enabled without changing pos.page.ts

### Requirement: Saldo en caja label

The system MUST display "Saldo en caja" instead of "Saldo esperado" in the jornada summary card UI, reflecting that the value represents actual cash in the register.

#### Scenario: Label shows "Saldo en caja"

- GIVEN a jornada summary card is rendered
- WHEN the UI shows the cash balance
- THEN the label reads "Saldo en caja" and the value is `jornada().saldo_esperado`

### Requirement: Venta model includes completacion_efectivo

The `Venta` interface MUST include `completacion_efectivo?: number` so TypeScript code can access the field without type casts.

#### Scenario: Access completacion_efectivo from venta object

- GIVEN a venta object returned from the database where `completacion_efectivo` is present or NULL
- WHEN TypeScript code accesses `v.completacion_efectivo`
- THEN it compiles without errors and returns `number | undefined`

### Requirement: Service guard — verificar saldo antes de egreso

`JornadaService` MUST exponer `saldoSuficientePara(monto)` que compare `saldo_esperado - monto >= 0` dentro de una transacción explícita (BEGIN/COMMIT/ROLLBACK) y lanzar `Error` si el saldo es insuficiente.

`_registrarMovimientoAsync` MUST invocar `saldoSuficientePara` DENTRO de una transacción BEGIN/COMMIT/ROLLBACK que envuelve guard + INSERT + UPDATE, ANTES de insertar movimientos de tipo `gasto` o `compra_divisa`. La validación usa `saldo_esperado` leído desde la DB (no el signal `totalEnCaja()`).

#### Scenario: Gasto con saldo suficiente

- GIVEN `saldo_esperado = 10000` y usuario intenta registrar gasto de $3000
- WHEN `_registrarMovimientoAsync` ejecuta guard dentro de transacción
- THEN el guard pasa y el movimiento se inserta normalmente

#### Scenario: Gasto con saldo insuficiente

- GIVEN `saldo_esperado = 2000` y usuario intenta registrar gasto de $3000
- WHEN `_registrarMovimientoAsync` ejecuta guard
- THEN el guard lanza `Error("Saldo insuficiente en caja")`, ROLLBACK, y NO se inserta el movimiento

#### Scenario: Race condition — dos gastos simultáneos

- GIVEN `saldo_esperado = 5000` y dos usuarios intentan gastar $3000 cada uno
- WHEN ambos pasan el UI check simultáneamente
- THEN el primer guard lee `saldo_esperado = 5000` dentro de su transacción, pasa, inserta, COMMIT con `saldo_esperado = 2000`
- AND el segundo guard lee `saldo_esperado = 2000` dentro de su transacción, falla porque `2000 - 3000 < 0`, hace ROLLBACK
- AND el primer gasto se registra, el segundo se rechaza con error

#### Scenario: Merma sin validación de saldo

- GIVEN `saldo_esperado = 100` y usuario registra merma de $500 (costo de inventario)
- WHEN se llama `registrarMerma()`
- THEN NO se invoca `saldoSuficientePara` — la merma se registra sin importar el saldo

### Requirement: UI guard — deshabilitar botón si saldo insuficiente

`jornada.page` MUST verificar `totalEnCaja()` signal antes de habilitar el botón de registrar gasto/compra_divisa. Usa el helper `saldoSuficientePara(monto)` para el cómputo reactivo. Si `totalEnCaja() < monto_ingresado`, el botón SHALL estar deshabilitado con tooltip "Saldo insuficiente en caja".

#### Scenario: UI permite gasto con saldo suficiente

- GIVEN `totalEnCaja() signal = 10000`, usuario ingresa monto gasto = $3000
- WHEN el componente verifica `totalEnCaja() >= monto` via `saldoSuficientePara()`
- THEN botón "Registrar gasto" está habilitado, sin tooltip

#### Scenario: UI bloquea gasto con saldo insuficiente

- GIVEN `totalEnCaja() signal = 2000`, usuario ingresa monto gasto = $3000
- WHEN el componente verifica `totalEnCaja() < monto` via `saldoSuficientePara()`
- THEN botón "Registrar gasto" está deshabilitado y tooltip "Saldo insuficiente en caja" es visible

### Requirement: Cuenta Casas del día feedback block

The "ventas del día" card MUST render a "Cuenta Casas del día" block when the open jornada has ≥1 `cuenta_cosas` row. Each row MUST show: Producto (name resolved via `productosMap`), Cantidad, Descripción, Autorizado por, and Hora (`created_at | date:'short'`). Rows MUST be fetched via `listarPorJornada(jornadaId)` as part of `_cargarDatosDiarios`, ordered by `created_at` ASC. When there is no open jornada or the load fails, the list MUST be cleared. Cash register totals MUST NOT be affected.

#### Scenario: Jornada with rows shows the block (testable)

- GIVEN an open jornada with 2 rows created at 08:00 and 09:00
- WHEN `_cargarDatosDiarios` completes
- THEN the "Cuenta Casas del día" block renders 2 rows with Producto, Cantidad, Descripción, Autorizado por and Hora, in chronological order

#### Scenario: Jornada without rows hides the block (testable)

- GIVEN an open jornada with zero `cuenta_cosas` rows
- WHEN `_cargarDatosDiarios` completes
- THEN the "Cuenta Casas del día" block is NOT rendered

#### Scenario: Product name resolved via productosMap (testable)

- GIVEN a row with `producto_id = P`
- WHEN the block renders
- THEN the Producto column shows the product name from `productosMap` (same mechanism as the ventas/movimientos blocks)

#### Scenario: No open jornada or load failure clears the list (testable)

- GIVEN no open jornada, or `_cargarDatosDiarios` throws
- WHEN the daily data resets
- THEN `cuentasCosasDelDia` is empty and the block is hidden
