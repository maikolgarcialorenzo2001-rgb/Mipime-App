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

The system MUST calculate saldo_esperado considering all financial factors.

#### Scenario: Saldo esperado with all factors

- GIVEN a jornada with monto_inicial=10000
- WHEN total_ventas=8000, total_gastos=500, total_merma=300
- THEN saldo_esperado MUST be 10000 + 8000 - 500 - 300 = 17200

#### Scenario: Saldo esperado without merma (backward compatibility)

- GIVEN a jornada with total_merma = NULL or 0
- WHEN calculating saldo_esperado
- THEN saldo_esperado = monto_inicial + total_ventas - total_gastos (no change)

### Requirement: Jornada Closure

The system MUST close a jornada with complete financial data and Excel report.

#### Scenario: Close jornada generates Excel

- GIVEN an open jornada with sales, movements, and mermas
- WHEN the admin confirms closure
- THEN estado changes to 'cerrada'
- AND hora_cierre, saldo_real, user_cierre_id are set
- AND Excel report is generated including merma data
- AND jornadaAbierta signal is set to null

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
