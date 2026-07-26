# Jornada Reopen Specification

## Purpose

Define the behavior for reopening a jornada when a user logs in and an open jornada already exists for the day. Protects business integrity by ensuring only the jornada owner can continue it.

## Requirements

### Requirement: User Ownership Check on Login

The system MUST compare the logged-in user's ID with `user_apertura_id` of any open jornada for the current day.

#### Scenario: Different user logs in with open jornada

- GIVEN a jornada is open for today with `user_apertura_id = 1`
- WHEN a user with `id = 2` logs in
- THEN the system MUST auto-close the existing jornada (estado = 'cerrada', user_cierre_id = 2)
- AND a new jornada MUST be created for user 2
- AND the user sees the new empty jornada (no reopen prompt)

#### Scenario: Same user logs in with open jornada

- GIVEN a jornada is open for today with `user_apertura_id = 1`
- WHEN a user with `id = 1` logs in
- THEN the system MUST show a reopen prompt (modal)
- AND the jornada MUST NOT be closed automatically

#### Scenario: No open jornada exists

- GIVEN no jornada is open for today
- WHEN any user logs in
- THEN the user sees the "Iniciar día" empty state
- AND no reopen prompt is shown

### Requirement: Reopen Modal

The system MUST display a modal when the same user logs in with an existing open jornada.

#### Scenario: User confirms reopen

- GIVEN the reopen modal is displayed
- WHEN the user clicks "Reabrir jornada"
- THEN the jornada remains open with all existing data preserved
- AND the user can continue operating normally

#### Scenario: User declines reopen

- GIVEN the reopen modal is displayed
- WHEN the user clicks "Cerrar y guardar"
- THEN the jornada MUST be closed (generates Excel, same as manual close)
- AND the user sees the "Iniciar día" empty state

### Requirement: Auto-Close on Different User

The system MUST automatically close a jornada when a different user logs in.

#### Scenario: Auto-close preserves data

- GIVEN a jornada is open for today with user_apertura_id = 1
- WHEN user 2 logs in
- THEN the existing jornada MUST be closed with user_cierre_id = 2
- AND the Excel report MUST be generated and saved
- AND a new jornada is NOT automatically opened (user opens manually)

### Requirement: Jornada Tracks Owner

The system MUST record which user opened each jornada.

#### Scenario: Abrir stores user_apertura_id

- GIVEN an admin opens a new jornada
- WHEN `abrir(montoInicial, userId)` is called
- THEN the jornada record MUST include `user_apertura_id = userId`

#### Scenario: Abrir without userId (backward compatibility)

- GIVEN `abrir(montoInicial)` is called without userId (legacy code)
- THEN `user_apertura_id` MUST be NULL
- AND the jornada behaves as before (no reopen prompt)
