# Delta for excel-reportes

## ADDED Requirements

### Requirement: Platform-aware export default path

The `db:export` dialog defaultPath and `file:saveFile` (IPVE) defaultPath SHALL use the platform-aware base directory: Linux + Crostini → `/mnt/chromeos/MyFiles/Downloads/Tienda - App/DataBase/` (or `Tienda IPVE/`); Linux desktop → `~/Downloads/Tienda - App/...`; Windows/macOS → `Documents/Tienda - App/...`.

#### Scenario: IPVE export default on Crostini

- GIVEN platform is Linux with Crostini detected
- WHEN the user triggers IPVE Excel export via `file:saveFile`
- THEN the save dialog default path is under `/mnt/chromeos/MyFiles/Downloads/Tienda - App/Tienda IPVE/`

#### Scenario: Manual DB export default on Crostini

- GIVEN platform is Linux with Crostini detected
- WHEN the user triggers manual DB export via `db:export`
- THEN the save dialog default path is under `/mnt/chromeos/MyFiles/Downloads/Tienda - App/DataBase/`

#### Scenario: Export default on Linux desktop

- GIVEN platform is Linux without Crostini
- WHEN the user triggers any export
- THEN the save dialog default path is under `~/Downloads/Tienda - App/`

#### Scenario: Export default on Windows/macOS

- GIVEN platform is Windows or macOS
- WHEN the user triggers any export
- THEN the save dialog default path is `Documents/Tienda - App/` (unchanged)
