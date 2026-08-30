# Database Backup Specification

## Purpose

Define automatic backup behavior so a lost/evicted database is no longer accepted data loss. Automatic backups via `db.backup()` — rodante file at `Documents\Tienda - App\DataBase\tienda-app.db` on app open, jornada close, and app close; timestamped file per jornada close at `Documents\Tienda - App\DataBase\backups\tienda_<YYYY-MM-DD_HHmm>.db` with retention of 30 and auto-prune; ADOPT on fresh install; one-click manual export (desktop). All automatic — no user/admin interaction with the DB; UI feedback only on restore/adoption or blocking failure.

## Requirements

### Requirement: Platform-aware backup base directory

The system SHALL resolve the backup base directory at runtime based on platform:
- Linux + Crostini (`/mnt/chromeos/MyFiles/Downloads` exists) → `/mnt/chromeos/MyFiles/Downloads`
- Linux desktop (no Crostini) → `app.getPath('downloads')`
- Windows/macOS → `app.getPath('documents')`

Sub-directories `{base}/Tienda - App/DataBase/` (backups) and `{base}/Tienda - App/Tienda IPVE/` (exports) follow. The live database path (`userData/tienda-app.db`) is NOT affected. (main has no Palmar folder.)

#### Scenario: Crostini uses ChromeOS Downloads

- GIVEN platform is Linux and `/mnt/chromeos/MyFiles/Downloads` exists
- WHEN backup paths are resolved
- THEN rodante, timestamped, and IPVE export paths are under `/mnt/chromeos/MyFiles/Downloads/Tienda - App`

#### Scenario: Linux desktop falls back to XDG Downloads

- GIVEN platform is Linux and `/mnt/chromeos` does not exist
- WHEN backup paths are resolved
- THEN paths are under `~/Downloads/Tienda - App`

#### Scenario: Windows/macOS unchanged

- GIVEN platform is Windows or macOS
- WHEN backup paths are resolved
- THEN paths are under `Documents/Tienda - App`

### Requirement: Automatic rodante backup

The system MUST back up the working database to `{baseDataDir}/Tienda - App/DataBase/tienda-app.db` (via `db.backup()`) automatically at app open (after successful init), at jornada close, and at app close. `{baseDataDir}` is resolved per "Platform-aware backup base directory" requirement above.

#### Scenario: Backup at app open

- GIVEN the app starts with a working database
- WHEN initialization completes
- THEN the rodante backup is written to `{baseDataDir}/Tienda - App/DataBase/tienda-app.db`

#### Scenario: Backup at app close

- GIVEN the app is quitting with a working database
- WHEN the close flow runs
- THEN the rodante backup is updated in `{baseDataDir}/Tienda - App/DataBase/`

### Requirement: Timestamped backup at jornada close

On each jornada close the system MUST write a timestamped backup to `{baseDataDir}/Tienda - App/DataBase/backups/tienda_<YYYY-MM-DD_HHmm>.db`.

#### Scenario: Jornada close creates both backups

- GIVEN a jornada is being closed
- WHEN the close flow completes
- THEN the rodante backup is updated AND a timestamped file is created in `{baseDataDir}/Tienda - App/DataBase/backups/`

### Requirement: Retention and auto-prune

The system MUST keep the last 30 timestamped backups and MUST auto-prune older files.

#### Scenario: Prune beyond retention

- GIVEN 32 timestamped backups exist
- WHEN the next jornada close creates a new one
- THEN the 2 oldest files are removed and exactly 30 remain

### Requirement: ADOPT valid backup on fresh install

When no working database exists but a valid backup exists, the system MUST adopt (restore) the newest valid backup, validating it with `integrity_check` and `schema_version`, and MUST show visual feedback. On Linux the backup lookup uses the platform-aware base directory. (Previously: no explicit mention of platform-aware path for ADOPT)

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
