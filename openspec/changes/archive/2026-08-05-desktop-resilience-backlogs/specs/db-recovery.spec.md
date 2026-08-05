# Delta for db-recovery

## MODIFIED Requirements

### Requirement: Blocking feedback when all recovery fails

If the working DB cannot be opened/recovered and every backup candidate fails validation, the system MUST show a blocking "contactar al desarrollador" screen with diagnostics: app version, SQLite error, backups tried, and failure reason for each, plus a `stage` value identifying the recovery-cascade phase at which the failure became fatal (`open` | `recover`). The reported `stage` MUST reflect the actual failing phase and MUST NOT be a hardcoded value that masks the real stage.
(Previously: the fatal diagnostics always reported a hardcoded `stage: 'open'` in both the `runStartupSequence` fatal path and the `db:initialize` catch, masking failures that actually occurred during `recover`.)

#### Scenario: Fatal during open reports 'open'

- GIVEN `openNativeDb` fails before the recovery cascade begins
- WHEN the cascade reaches fatal
- THEN diagnostics report `stage: 'open'`

#### Scenario: Fatal during in-place recovery reports 'recover'

- GIVEN the working DB opens but fails validation, `recoverIn-place` also fails, and every backup candidate is invalid
- WHEN the cascade reaches fatal
- THEN diagnostics report `stage: 'recover'` (not a hardcoded `'open'`)

#### Scenario: Unexpected initialize error reports actual stage

- GIVEN `db:initialize` catches an unexpected error thrown during a cascade phase
- WHEN the handler synthesizes fatal diagnostics
- THEN the reported `stage` reflects the phase underway at the throw, not a hardcoded `'open'`

## Non-goals and constraints

- The `stage` union MUST NOT be widened beyond the existing `'open' | 'recover' | 'backup' | 'import'` values unless tests prove a widening is necessary (kept in scope only if strictly required).
- Every other field of the diagnostics payload stays unchanged.