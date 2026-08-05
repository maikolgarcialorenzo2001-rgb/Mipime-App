# Delta for db-backup

## ADDED Requirements

### Requirement: Manual export filename shares a single source

The web manual export filename MUST be produced by the same pure `exportName(d)` helper that the desktop export uses, so both call sites derive `tienda_export_YYYYMMDD_HHmm.db` (zero-padded) from one source of truth rather than duplicated inline logic.

#### Scenario: Web export name is byte-identical to desktop

- GIVEN a moment where `new Date()` yields year=2026, month=08, day=02, hour=14, minute=05
- WHEN the web manual export computes its download filename
- THEN the filename is `tienda_export_20260802_1405.db`
- AND it is byte-identical to what the desktop `db:export` handler computes from the same helper

#### Scenario: Zero-padded single-digit fields

- GIVEN a moment with month=01, day=05, hour=09, minute=03
- WHEN the shared helper computes the filename
- THEN the filename is `tienda_export_20260105_0903.db`

### Requirement: export-name helper is unit tested under the electron runner

The shared `exportName(d)` helper MUST have unit tests that run under the electron test runner (only `electron/**/*.spec.ts` is picked there), proving the observable filename output from concrete Date inputs.

#### Scenario: Helper spec runs under electron runner

- GIVEN the helper source lives in `electron/export-name.ts` (node-free)
- WHEN the electron runner executes `electron/export-name.spec.ts`
- THEN each concrete Date input produces the expected zero-padded `tienda_export_YYYYMMDD_HHmm.db` string
- AND no test requires the web (`src/**`) runner

## Non-Goal / Constraints

- The filename format `tienda_export_YYYYMMDD_HHmm.db` MUST NOT change.
- `electron/db.ts:timestampedBackupName` (the `tienda_YYYY-MM-DD_HHmm.db` auto-backup) MUST remain untouched and is unrelated.
- `electron/tsconfig.json` `rootDir: "."` MUST remain unchanged; the helper stays inside `electron/`.