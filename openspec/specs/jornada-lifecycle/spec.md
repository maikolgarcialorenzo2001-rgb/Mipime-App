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

### Requirement: Jornada Closure

The system MUST close a jornada with complete financial data and Excel report. At closure, `saldo_real` MUST be calculated as `monto_inicial + totalEfectivoCash + totalMovimientos`, where `totalEfectivoCash` sums `efectivo.total` plus `divisas.completacion_efectivo` (COALESCE 0).

(Previously: saldo_real only summed `efectivo.total`, missing cash completacion from divisa ventas)

#### Scenario: Close jornada with mixed payments

- GIVEN an open jornada with $5000 monto_inicial, $3000 efectivo sale, $5000 divisa sale with $100 completacion, $0 movimientos
- WHEN the admin confirms closure
- THEN `saldo_real = 5000 + (3000 + 100) + 0 = 8100`
- AND estado changes to 'cerrada'
- AND Excel report is generated

#### Scenario: Auto-cierre with mixed payments

- GIVEN another user opens a jornada, a divisa sale with $200 completacion is recorded, and the current user opens the app
- WHEN the system auto-closes the other user's jornada
- THEN the auto-cierre SQL sums `efectivo.total + COALESCE(divisas.completacion_efectivo, 0)`
- AND `saldo_real` includes the completacion amount

### Requirement: Jornada State Tracking

The system MUST track the jornada state via the `jornadaAbierta` signal.

#### Scenario: Signal reflects current state

- GIVEN a jornada is open
- WHEN jornadaAbierta is read
- THEN it returns the Jornada object with all fields including user_apertura_id and total_merma

#### Scenario: Signal null when no open jornada

- GIVEN no jornada is open for today
- WHEN jornadaAbierta is read
- THEN it returns null

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
