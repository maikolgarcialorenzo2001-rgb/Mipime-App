# Delta for Jornada Lifecycle

## MODIFIED Requirements

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

- **GIVEN a jornada is open (today or latest of previous days)**
- **WHEN jornadaAbierta is read**
- **THEN it returns the Jornada object with all fields including user_apertura_id and total_merma**

#### Scenario: Signal null when no open jornada

- GIVEN no jornada with `estado='abierta'` exists (any fecha)
- WHEN jornadaAbierta is read
- THEN it returns null

#### Scenario: POS benefits from previous-day open jornada

- GIVEN an open jornada with `fecha` from a previous day
- WHEN the POS reads the `jornadaAbierta` signal after login
- THEN `sinJornada = false`
- AND "Cobrar Pendiente"/"Ver Pendientes" buttons are enabled without changing pos.page.ts

## REMOVED Requirements

### Requirement: Auto-cierre SQL in Jornada Closure

(Reason: `autoCerrarSiOtroUsuario()` is removed — no automatic closure triggered by another user's login. The `saldo_real` math for manual closure is kept above.)