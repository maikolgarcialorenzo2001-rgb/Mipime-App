# Jornada Reopen Specification

## Purpose

Define the behavior for reopening a jornada when a user logs in and an open jornada already exists — today's or the most recent one from any previous day. Any authenticated user (worker or admin) can resume it; the jornada owner is preserved and the closure records the CURRENT authenticated user.

## Requirements

### Requirement: Open jornada of any date

The system MUST detect the MOST RECENT open jornada regardless of its `fecha` (`estado='abierta'`), ordering by `fecha DESC, id DESC LIMIT 1`. Detection MUST NOT filter `fecha = hoy`.

#### Scenario: Open jornada from previous day

- GIVEN a jornada open with `fecha = yesterday` and none open today
- WHEN `obtenerAbierta()` is called
- THEN it returns the previous-day jornada
- AND `refreshJornadaAbierta()` populates `jornadaAbierta` so the POS shows `sinJornada = false`

#### Scenario: Multiple orphan open jornadas

- GIVEN two open jornadas with different dates (07-08 and 31-07)
- WHEN `obtenerAbierta()` is called
- THEN it returns the one with the most recent `fecha`

#### Scenario: No open jornada exists

- GIVEN no jornada with `estado='abierta'` exists (any date)
- WHEN any user logs in
- THEN the user sees the "Iniciar día" empty state
- AND no reopen prompt is shown

### Requirement: User Ownership Check on Login

The system MUST show the reopen modal to ANY authenticated user (worker or admin) whenever an open jornada exists (today's or the most recent of previous days). The system MUST NOT auto-close a jornada because a different user logs in. Ownership is only recorded: `user_apertura_id` keeps the original opener, the closer is written to `user_cierre_id`.

(Previously: The system compared the logged-in user's ID with `user_apertura_id` of any open jornada for the current day only, and auto-closed the jornada when a different user logged in.)

#### Scenario: Different user logs in with open jornada

- GIVEN a jornada is open with `user_apertura_id = 1`
- WHEN a user with `id = 2` logs in
- THEN the reopen modal MUST be shown (no auto-close, no "cerrada automáticamente" toast)
- AND the jornada remains `estado = 'abierta'` with `user_apertura_id = 1`

#### Scenario: Worker logs in with open jornada

- GIVEN a jornada is open with `user_apertura_id = 1`
- WHEN a worker (rol `trabajador`) logs in
- THEN the reopen prompt (modal) MUST be shown for the worker too

#### Scenario: Same user logs in with open jornada

- GIVEN a jornada is open with `user_apertura_id = 1`
- WHEN a user with `id = 1` logs in
- THEN the system MUST show a reopen prompt (modal)
- AND the jornada MUST NOT be closed automatically

### Requirement: Reopen Modal with the jornada's real date

The system MUST display a modal when an open jornada exists, showing the jornada's real `fecha` (e.g. "Reanudar jornada del 07-08") and the copy "Hay una jornada sin cerrar". The copy MUST NOT say "de hoy".

(Previously: the modal title was "Jornada del día" and the copy said "Hay una jornada abierta de hoy".)

#### Scenario: User confirms reopen

- GIVEN the reopen modal is displayed
- WHEN the user clicks "Reabrir jornada"
- THEN the jornada remains open with all existing data preserved, `user_apertura_id` unchanged
- AND the user can continue operating normally

#### Scenario: User declines reopen (closes as the authenticated user)

- GIVEN the reopen modal is displayed
- WHEN the user clicks "Cerrar y guardar"
- THEN the jornada MUST be closed with `user_cierre_id = authenticated user id` (NOT `user_apertura_id`)
- AND the Excel report is generated (same as manual close)
- AND the user sees the "Iniciar día" empty state

### Requirement: Jornada Tracks Owner

The system MUST record which user opened each jornada.

#### Scenario: Abrir stores user_apertura_id

- GIVEN an admin opens a new jornada
- WHEN `abrir(montoInicial, userId)` is called
- THEN the jornada record MUST include `user_apertura_id = userId`

#### Scenario: Abrir without userId (backward compatibility)

- GIVEN `abrir(montoInicial)` is called without userId (legacy code)
- THEN `user_apertura_id` MUST be NULL
- AND the jornada behaves as before