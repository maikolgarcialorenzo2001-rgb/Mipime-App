# Delta for db-backup

## ADDED Requirements

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

### Requirement: EACCES graceful degradation on Linux 9p share

When writing to the Crostini 9p share fails with EACCES, the system SHALL log the error and fall back to `app.getPath('downloads')` without interrupting normal operation.

#### Scenario: Write to /mnt/chromeos fails

- GIVEN platform is Linux with Crostini detected
- WHEN a write to `/mnt/chromeos/MyFiles/Downloads/Tienda - App` fails with EACCES
- THEN the error is logged AND the system falls back to `~/Downloads/Tienda - App`
- AND normal operation continues

#### Scenario: Fallback also fails

- GIVEN the fallback path is also unwritable
- WHEN a backup is attempted
- THEN the failure is non-fatal (existing "Automatic and non-fatal backups" applies)

## MODIFIED Requirements

### Requirement: Automatic rodante backup

The system MUST back up the working database to `{baseDataDir}/Tienda - App/DataBase/tienda-app.db` (via `db.backup()`) automatically at app open (after successful init), at jornada close, and at app close. `{baseDataDir}` is resolved per "Platform-aware backup base directory".

(Previously: hardcoded to `Documents\Tienda - App\DataBase\tienda-app.db`)

#### Scenario: Backup at app open

- GIVEN the app starts with a working database
- WHEN initialization completes
- THEN the rodante backup is written to `{baseDataDir}/Tienda - App/DataBase/tienda-app.db`

#### Scenario: Backup at app close

- GIVEN the app is quitting with a working database
- WHEN the close flow runs
- THEN the rodante backup is updated

### Requirement: Timestamped backup at jornada close

On each jornada close the system MUST write a timestamped backup to `{baseDataDir}/Tienda - App/DataBase/backups/tienda_<YYYY-MM-DD_HHmm>.db`.

(Previously: hardcoded to `Documents\Tienda - App\DataBase\backups\`)

#### Scenario: Jornada close creates both backups

- GIVEN a jornada is being closed
- WHEN the close flow completes
- THEN the rodante backup is updated AND a timestamped file is created in `{baseDataDir}/Tienda - App/DataBase/backups/`

### Requirement: ADOPT valid backup on fresh install

When no working database exists but a valid backup exists, the system MUST adopt (restore) the newest valid backup, validating it with `integrity_check` and `schema_version`, and MUST show visual feedback. On Linux the backup lookup uses the platform-aware base directory.

(Previously: no explicit mention of platform-aware path for ADOPT)

#### Scenario: Fresh install with existing backup on Linux

- GIVEN a fresh install on Linux with no working DB
- AND a valid backup exists at `{baseDataDir}/Tienda - App/DataBase/tienda-app.db`
- WHEN startup runs the cascade
- THEN the backup is validated and adopted from the Linux path

## UNCHANGED Requirements

The following requirements are NOT modified by this change:

- **Retention and auto-prune**: 30-retention pruning operates on the passed directory — unchanged logic.
- **Automatic and non-fatal backups**: Backup failure MUST NOT interrupt app operation — unchanged.
- **Manual export (desktop)**: One-click export behavior unchanged (defaultPath change is in excel-reportes).
