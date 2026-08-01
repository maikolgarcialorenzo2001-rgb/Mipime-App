# Database Recovery Specification

## Purpose

Define the startup recovery cascade so a database open failure never silently falls back to `:memory:` with accepted data loss. A startup recovery cascade (open working DB → in-place `.recover` → newest valid backup, rodante first then timestamped newest→oldest, validating each candidate with `integrity_check` + `schema_version`) restores data automatically; total failure produces blocking feedback "contactar al desarrollador" with diagnostics; every restore shows visual feedback (what restored, from when, what is lost). Fail-loud on any DB open/initialize failure — never silent `:memory:`.

## Requirements

### Requirement: Startup recovery cascade

On startup the system MUST follow, in order: (1) open the working DB and continue; (2) if open fails, attempt in-place `.recover`; (3) if that fails, restore the newest valid backup — rodante (`Documents\Tienda - App\DataBase\tienda-app.db`) first, then timestamped backups newest→oldest.

#### Scenario: Working database opens

- GIVEN a working database
- WHEN startup runs
- THEN normal startup continues and no restore occurs

#### Scenario: Corrupt DB falls through cascade

- GIVEN the working DB fails to open
- WHEN the cascade runs
- THEN in-place `.recover` is attempted first
- AND if it fails, the newest valid backup (rodante first, then newest timestamped) is restored

### Requirement: Candidate validation

Every backup candidate MUST be validated with `integrity_check` = ok AND the latest `schema_version` before acceptance; invalid candidates MUST be skipped with the failure reason recorded.

#### Scenario: Invalid newest backup is skipped

- GIVEN the newest backup fails `integrity_check`
- WHEN the cascade evaluates it
- THEN it is rejected and the next-newest valid backup is tried
- AND the failure reason is recorded

### Requirement: Blocking feedback when all recovery fails

If the working DB cannot be opened/recovered and every backup candidate fails validation, the system MUST show a blocking "contactar al desarrollador" screen with diagnostics: app version, SQLite error, backups tried, and failure reason for each.

#### Scenario: All candidates fail

- GIVEN the working DB is unrecoverable and all backups fail validation
- WHEN the cascade is exhausted
- THEN a blocking screen shows "contactar al desarrollador"
- AND it includes app version, the SQLite error, the list of backups tried, and each failure reason

### Requirement: Never silent restore

Every restore/adoption MUST show visual feedback stating WHAT was restored, FROM WHEN (backup timestamp), and WHAT is lost (post-backup window).

#### Scenario: Restore feedback content

- GIVEN a restore from a backup dated `<timestamp>` is performed
- WHEN the restore completes
- THEN visual feedback states the restored data, the backup timestamp, and that changes after that timestamp are lost

#### Scenario: No silent restore path

- GIVEN any restore or adoption occurs
- THEN visual feedback is always shown
- AND no restore happens without user-visible notification

### Requirement: Fail-loud on open/initialize failure

The system MUST NOT fall back to `:memory:` or continue silently when the database cannot be opened or initialized; a blocking error UI MUST be shown.

#### Scenario: Open failure is blocking

- GIVEN the database cannot be opened or initialized
- WHEN startup runs
- THEN a blocking error UI is shown
- AND the app does not continue with a silent degraded (in-memory) database
