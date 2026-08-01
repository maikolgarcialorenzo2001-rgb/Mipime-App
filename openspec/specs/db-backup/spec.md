# Database Backup Specification

## Purpose

Define automatic backup behavior so a lost/evicted database is no longer accepted data loss. Automatic backups via `db.backup()` — rodante file at `Documents\Tienda - App\DataBase\tienda-app.db` on app open, jornada close, and app close; timestamped file per jornada close at `Documents\Tienda - App\DataBase\backups\tienda_<YYYY-MM-DD_HHmm>.db` with retention of 30 and auto-prune; ADOPT on fresh install; one-click manual export (desktop). All automatic — no user/admin interaction with the DB; UI feedback only on restore/adoption or blocking failure.

## Requirements

### Requirement: Automatic rodante backup

The system MUST back up the working database to `Documents\Tienda - App\DataBase\tienda-app.db` (via `db.backup()`) automatically at app open (after successful init), at jornada close, and at app close.

#### Scenario: Backup at app open

- GIVEN the app starts with a working database
- WHEN initialization completes
- THEN the rodante backup is written to `Documents\Tienda - App\DataBase\tienda-app.db`

#### Scenario: Backup at app close

- GIVEN the app is quitting with a working database
- WHEN the close flow runs
- THEN the rodante backup is updated

### Requirement: Timestamped backup at jornada close

On each jornada close the system MUST write a timestamped backup to `Documents\Tienda - App\DataBase\backups\tienda_<YYYY-MM-DD_HHmm>.db`.

#### Scenario: Jornada close creates both backups

- GIVEN a jornada is being closed
- WHEN the close flow completes
- THEN the rodante backup is updated AND a file `tienda_<YYYY-MM-DD_HHmm>.db` is created in the `backups` folder

### Requirement: Retention and auto-prune

The system MUST keep the last 30 timestamped backups and MUST auto-prune older files.

#### Scenario: Prune beyond retention

- GIVEN 32 timestamped backups exist
- WHEN the next jornada close creates a new one
- THEN the 2 oldest files are removed and exactly 30 remain

### Requirement: ADOPT valid backup on fresh install

When no working database exists but a valid backup exists, the system MUST adopt (restore) the newest valid backup, validating it with `integrity_check` and `schema_version`, and MUST show visual feedback.

#### Scenario: Fresh install with existing backup

- GIVEN a fresh install (no working DB) and a valid rodante backup exists
- WHEN startup runs the cascade
- THEN the backup is validated (`integrity_check` ok, latest `schema_version`) and adopted
- AND visual feedback shows the restore

### Requirement: Manual export (desktop)

On desktop the system MUST offer a one-click "Exportar respaldo" action producing a standard SQLite file.

#### Scenario: Manual export

- GIVEN a working database on desktop
- WHEN the user triggers "Exportar respaldo"
- THEN a standard SQLite file is produced and saved

### Requirement: Automatic and non-fatal backups

All backups MUST be automatic with no user/admin interaction. A backup failure MUST NOT interrupt normal app operation and MUST be retried at the next trigger.

#### Scenario: Backup failure is non-fatal

- GIVEN a backup attempt fails (e.g., destination folder unwritable)
- WHEN the app continues running
- THEN normal operation is unaffected
- AND the next trigger retries the backup
