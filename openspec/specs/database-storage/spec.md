# Database Storage Specification

## Purpose

Define how the application stores its data across platforms. Desktop (Electron) stores in a native SQLite file at `app.getPath('userData')/tienda-app.db` via a new IPC-backed `Database` implementation (better-sqlite3 in main); initialization fails loud (blocking error UI) instead of silently degrading to `:memory:`; web/Capacitor keeps SQLocal but requests `navigator.storage.persist()`; migrations v1–v16 run from a single shared runner. All 8 consumers (auth, jornada, producto, stock-movimiento, user, venta, cuenta-cosa, jornada.page) keep identical SQL — no consumer spec changes.

## Requirements

### Requirement: Fail-loud database initialization

The system MUST NOT fall back to `:memory:` or any silent degraded mode when the database fails to open or initialize. On open/initialize failure the system MUST surface a blocking error UI.

#### Scenario: Native DB open fails

- GIVEN the desktop database at `app.getPath('userData')/tienda-app.db` cannot be opened
- WHEN initialization runs
- THEN a blocking error UI is shown
- AND no `:memory:` fallback is used and no data is silently accepted as lost

### Requirement: Runtime driver selection

The system MUST select the storage driver at runtime by presence of `window.electronAPI`: Electron → native IPC-backed driver; web/Capacitor → SQLocal. Selection MUST NOT require a rebuild, flag, or code path change per platform.

#### Scenario: Electron runtime

- GIVEN `window.electronAPI` is present
- WHEN the database initializes
- THEN the native driver is selected and all SQL runs through IPC to Electron main

#### Scenario: Web/Capacitor runtime

- GIVEN `window.electronAPI` is absent
- WHEN the database initializes
- THEN the SQLocal driver is selected

### Requirement: Identical SQL for all consumers

The `Database` interface (8 consumers: auth, jornada, producto, stock-movimiento, user, venta, cuenta-cosa, jornada.page) MUST remain unchanged and all consumers MUST keep issuing identical SQL on both drivers.

#### Scenario: Consumer parity

- GIVEN any consumer service
- WHEN it issues its existing SQL on either driver
- THEN the SQL string and result semantics are identical on native and SQLocal

### Requirement: Shared migration runner

Migrations v1–v16 MUST run from a single shared runner using the same SQL strings on both drivers, producing identical `schema_version`.

#### Scenario: Migration parity across drivers

- GIVEN a fresh native DB and a fresh SQLocal DB
- WHEN the shared runner executes migrations v1–v16 on both
- THEN both report the same latest `schema_version`
- AND every migration SQL string is byte-identical between drivers

### Requirement: Native database location

On desktop the working database MUST be the file `app.getPath('userData')/tienda-app.db`.

#### Scenario: File created on first run

- GIVEN a fresh desktop install
- WHEN initialization succeeds
- THEN the file `app.getPath('userData')/tienda-app.db` exists and is a standard SQLite database

### Requirement: Single-statement SQL semantics

All SQL execution MUST use one statement per call; transaction control (BEGIN, COMMIT, ROLLBACK) MUST be issued as separate `sql()` calls, compatible with better-sqlite3 `prepare()` single-statement semantics.

#### Scenario: Transaction as separate calls

- GIVEN a service starting a transaction
- WHEN it calls `sql('BEGIN')` then subsequent statements then `sql('COMMIT')`
- THEN each call executes exactly one statement and the transaction completes correctly

### Requirement: Async IPC only for SQL

All `db:*` renderer→main calls MUST use `ipcRenderer.invoke` (async); `sendSync` MUST NOT be used for SQL. The preload whitelist and `types.d.ts` MUST be extended with the `db:*` channels.

#### Scenario: SQL executed over async IPC

- GIVEN the native driver active in the renderer
- WHEN a consumer executes SQL
- THEN the call goes through `ipcRenderer.invoke('db:sql', ...)`
- AND no `sendSync` is used and the channel is present in the preload whitelist and typings

### Requirement: One-shot OPFS→native import

When OPFS data exists and no native DB exists, the system MUST perform a one-shot import: `SQLocal.getDatabaseFile()` (VACUUM INTO) → IPC → native file. The import MUST be non-destructive (OPFS left intact) and MUST run at most once.

#### Scenario: First desktop run after OPFS era

- GIVEN OPFS contains data and `tienda-app.db` does not exist
- WHEN initialization runs
- THEN the OPFS data is imported once into `tienda-app.db`
- AND the OPFS store is left intact and the import is not repeated on later runs

### Requirement: Storage persistence on web

On the web path the system MUST request `navigator.storage.persist()`.

#### Scenario: Web persistence requested

- GIVEN the SQLocal driver active on web
- WHEN initialization completes
- THEN `navigator.storage.persist()` has been requested

### Requirement: Version bump (delivery note)

The application version MUST be bumped to `0.1.9-beta` in this change.

#### Scenario: Release version

- GIVEN a packaged build of this change
- WHEN the version is read
- THEN it reports `0.1.9-beta`

### Requirement: Packaging includes main-process DB module (build requirement)

`electron-builder.yml` `files` list MUST include the new main-process DB module (`dist-electron/db.js`); omitting it breaks the packaged main process.

#### Scenario: Packaged app loads native DB

- GIVEN a packaged (asar) build
- WHEN the main process loads the DB module
- THEN the module is present in the `files` list and loads successfully
