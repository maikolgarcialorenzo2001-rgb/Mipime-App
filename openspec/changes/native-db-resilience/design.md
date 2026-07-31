# Design: native-db-resilience

## Technical Approach

Desktop (Electron) stops depending on evictable OPFS storage: runtime driver selection at `provideDatabase` (presence of `window.electronAPI`) routes to a new IPC-backed native driver (`better-sqlite3` in main, DB at `userData/tienda-app.db`); web/Capacitor keeps SQLocal + `navigator.storage.persist()`. Migrations v1–v16 move to a shared renderer-side runner consumed by both drivers. Main process owns: native DB open, recovery cascade, one-shot OPFS→native import (flag-guarded), rodante/timestamped backups with retention 30 + ADOPT. Blocking failure renders an Angular full-screen error component (non-fatal initialize + `DbStatusService` signal, same pattern as the existing TTL overlay); every restore shows Angular-level feedback. Covers specs: database-storage R1–R11, db-backup R1–R6, db-recovery R1–R5.

## RESOLVED-RISK-1: One-shot OPFS→native import guard (spec database-storage R8)

**Mechanism**: marker flag file `native-db-imported.flag` (JSON: `{importedAt, from:'opfs', appVersion}`) in `app.getPath('userData')`, written ONLY by the main process, atomically AFTER a successful import + validation. Primary guard is native DB file existence; flag is the secondary guard.

**Why not alternatives**: (a) *DB-existence check alone* cannot distinguish "never imported" from "imported, then DB later lost" — without a flag, a lost native DB would resurrect a STALE OPFS snapshot and silently bypass the recovery cascade (which should find backups). (b) *Row in native DB* is chicken-and-egg: the import IS what creates the DB, so no row can exist pre-import. The flag encodes "this install has migrated; any future data loss goes through the recovery cascade, never a stale re-import."

**Where**: main process only (owns fs + native DB); renderer never touches it.

**Exact sequence** (renderer-driven — renderer owns OPFS access, main owns fs):
1. `db:initialize` → main `runStartupSequence()`:
   - native DB exists → **NEVER import, skip entirely** (primary guard).
   - flag exists (DB missing) → no import; recovery cascade runs instead.
   - neither → return `{status:'import-needed'}`.
2. Renderer: transient `SQLocal.getDatabaseFile()` (dynamic import, existing pattern) → `ArrayBuffer`.
   - Data → `db:import {file}` → main writes `tienda-app.db` (tmp+rename), validates (`integrity_check` ok + `schema_version` 1..16), writes flag → re-`db:initialize` (migrations run).
   - **CANTOPEN or empty (c/d)** → `db:import {file:null}` → main logs "no OPFS data", NO flag, continues ADOPT-or-fresh.
3. Import failure (IPC/write/validation): flag NOT written, OPFS intact → retry next launch (self-healing). "At most once" = at most one *successful* import ever; retries are safe because both guards are checked before any import and a successful import always writes the flag.

**Failure semantics**: validation failure → log, no flag, continue fresh (OPFS data suspect); disk write failure → fatal diagnostics (fail-loud R1), retry next launch.

## RESOLVED-RISK-2: Blocking error UI placement (spec db-recovery R3/R5)

**Choice**: **(c) non-fatal initialize + Angular root error component.** NOT static HTML.

**Why**: `db.initialize()` catches driver failures internally, publishes diagnostics to a new `DbStatusService` (signal), and resolves. `App` template renders `<app-db-error/>` instead of `<router-outlet/>` when the signal is set — full-screen, no navigation possible. This is the proven in-codebase pattern (TTL overlay: `app.ts`/`app.html` `@if`), is unit-testable under TestBed (STRICT TDD), and reuses Tailwind/DI. Static HTML (a) needs a parallel UI system, inline scripts, and IPC access from a non-Angular page; the pre-bootstrap renderer script (b) must race the initializers and expose `bootstrapApplication`'s promise — more moving parts for the same outcome. The spec requirement is "blocking UI shown" — preventing the failure (c) satisfies it more reliably than recovering after it (a/b).

**Belt-and-suspenders**: `src/main.ts` wraps `bootstrapApplication(...).catch()` with a 5-line DOM fallback (injects a minimal message into `<app-root>`) covering non-DB bootstrap failures (corrupt bundle).

**Diagnostic payload** shown on the error screen: `{appVersion, platform, sqliteError {code,message}, stage:'open'|'recover'|'backup'|'import', backupsTried:[{path, reason}]}` + "Copiar diagnóstico" button. Spanish UI copy.

**Restore-success**: DIFFERENT surface — Angular-level `restore-feedback` toast/modal (what restored, from when, lost window), fed by the same `DbStatusService`. Blocking failure is full-screen; restore feedback is transient. Not reused.

## Architecture Decisions

| # | Decision | Option | Tradeoff | Chosen |
|---|----------|--------|----------|--------|
| AD-1 | Driver selection | `window.electronAPI` presence (dev Electron included) vs `isPackaged` | Presence exercises native path in dev too | Presence |
| AD-2 | Migration runner location | Renderer-side shared module vs main-side | One build, one copy, `environment`/`hash-password` stay renderer-side; cost = ~100 IPC roundtrips at init (local, negligible) | Renderer-side |
| AD-3 | Migrations run over IPC | Per-statement `db:sql` vs bulk in main | Runner is driver-agnostic, identical SQL; better-sqlite3 `prepare()` single-statement semantics already compatible (R6) | Per-statement IPC |
| AD-4 | In-place `.recover` | `VACUUM INTO` temp + validate + atomic swap vs better-sqlite3 (no CLI `.recover` API) | VACUUM INTO is the programmatic equivalent, works for recoverable corruption; swap preserves corrupt file as `tienda-app.db.corrupt-<ts>` | VACUUM INTO |
| AD-5 | `schema_version` acceptance | `IN (1..16)` (forward-migratable) vs `== 16` | Rejecting older backups discards recoverable data; runner upgrades after restore. Files without schema_version table rejected | `IN (1..16)` |
| AD-6 | Backups on web | no-op (desktop-only) vs blob download | R5 is desktop scope; web download is ~10 lines via existing `getDatabaseFile` | Desktop IPC; web = no-op for auto, download for manual export |
| AD-7 | Jornada-close backup | awaited-but-non-fatal in `_cerrarAsync` vs fire-and-forget | Awaited guarantees timestamped snapshot includes the closure; failure swallowed (R6) | Awaited, try/catch |
| AD-8 | App-close backup | main window `close` handler (sync, best-effort) vs renderer `beforeunload` | Main owns the connection; `beforeunload` is unreliable | Main |
| AD-9 | Fold `db:adopt`/`db:diagnostics` into `db:initialize` | 5 channels total vs 7 | Adopt = `{status:'adopted'}`; diagnostics ride the fatal result. Smaller IPC surface (R7) | Fold |

## Data Flow

```
bootstrapApplication
 └─ APP_INITIALIZER → NativeSqliteService.initialize()
     ├─ invoke db:initialize ──────────────→ main runStartupSequence()
     │    DB exists ────────────────→ {ok | restored | fatal}      (never import)
     │    no DB + flag ─────────────→ {fresh | adopted | fatal}    (cascade, no import)
     │    no DB + no flag ──────────→ {import-needed}
     ├─ import-needed → SQLocal.getDatabaseFile()
     │    data  → ArrayBuffer → db:import ─→ main write+validate+flag
     │    empty/CANTOPEN → db:import {null} ─→ main adopt-or-fresh (no flag)
     ├─ re-invoke db:initialize (after import)
     ├─ runMigrations(executor)   (each stmt → db:sql)
     └─ BackupService.backup('open')        (non-fatal rodante)

App root: @if (dbStatus.fatal())  <app-db-error/>   (blocking, diagnostics)
          @else                   <router-outlet/>   (+ restore-feedback toast when set)

Queries (8 consumers) → this._db.sql() → invoke db:sql → main prepare().all()
Jornada close → BackupService.backup('jornada-close') → rodante + timestamped + prune(30)
App close    → main 'close' handler → rodante
Manual export→ BackupService.exportarRespaldo() → db:export (dialog) | web: blob download
```

## IPC Contract (async invoke only, R7)

Preload `VALID_INVOKE_CHANNELS` += `'db:initialize','db:sql','db:import','db:backupNow','db:export'`. No `send`/`on` additions. `electron/types.d.ts` gains:

```ts
type DbInitStatus = 'ok' | 'restored' | 'adopted' | 'fresh' | 'import-needed' | 'fatal';
interface DbRestoreInfo { from: 'recover' | 'rodante' | 'timestamped' | 'adopt'; path?: string; when?: string; lostWindowMs: number; }
interface DbBackupTried { path: string; reason: string; }
interface DbDiagnostics { appVersion: string; platform: string; sqliteError?: string; stage: 'open' | 'recover' | 'backup' | 'import'; backupsTried: DbBackupTried[]; }
interface DbInitResult { status: DbInitStatus; restoreInfo?: DbRestoreInfo; diagnostics?: DbDiagnostics; }
interface DbBackupResult { ok: boolean; rodantePath?: string; timestampedPath?: string; error?: string; }
interface DbImportResult { ok: boolean; error?: string; }
interface DbExportResult { ok: boolean; path?: string; canceled?: boolean; error?: string; }
```

- `db:initialize` `() → DbInitResult` — open/cascade/import-decision.
- `db:sql` `({query, params}) → unknown[]` — one statement per call; `BEGIN`/`COMMIT`/`ROLLBACK` separate calls (R6).
- `db:import` `({file: ArrayBuffer|null}) → DbImportResult` — null = no OPFS data.
- `db:backupNow` `({trigger:'open'|'jornada-close'}) → DbBackupResult` — jornada-close = rodante + timestamped + prune.
- `db:export` `() → DbExportResult` — `dialog.showSaveDialog` → `backupDb` to chosen path.

## Shared Migration Runner

New `src/app/services/db-migrations.ts` (renderer-side, one build):

```ts
export interface MigrationExecutor {
  sql<T>(query: string, params?: unknown[]): Promise<T[]>;
}
/** Runs v1–v16 (verbatim SQL from SqliteService) + conditional seed. */
export async function runMigrations(exec: MigrationExecutor, opts: { seedEnabled: boolean }): Promise<void>;
```

Adaptation: SQLocal executor `{sql: (q,p) => client.sql(q, ...(p ?? []))}`; native executor `{sql: (q,p) => invoke('db:sql', {query:q, params:p})}`. `RETURNING` and separate BEGIN/COMMIT work on both. **SqliteService change**: delete `_migrationV1.._migrationV16` + `_seedIfEmpty` (~500 lines) and `environment`/`hash-password` imports; `initialize()` becomes: create `schema_version` → `runMigrations(executor, {seedEnabled: environment.seedEnabled})`. Its spec retargets to the runner via the service (mock SQLocal unchanged).

## Native Driver (Electron)

**NEW `electron/db.ts`** (compiled to `dist-electron/db.js`; add to builder `files` — R11). better-sqlite3 wrapper:
- `openNativeDb(dbPath)` — WAL mode, `foreign_keys=ON`, `busy_timeout=5000`; open failure throws → cascade.
- `validateDb(db)` — `PRAGMA integrity_check` + `SELECT MAX(version) FROM schema_version` → `{ok, integrity, schemaVersion}`.
- `backupDb(db, destPath)` — better-sqlite3 `db.backup()` incremental API; `mkdir` recursive.
- `pruneBackups(dir, keep=30)` — sort `tienda_*.db` by timestamp, delete oldest beyond 30.
- `recoverInPlace(dbPath)` — `VACUUM INTO <tmp>` on the corrupt file, validate, atomic swap; preserves corrupt file as `tienda-app.db.corrupt-<ts>`.
- `runStartupSequence({userDataPath, documentsPath, appVersion, platform})` — cascade: open working DB → **validate working DB after open (`integrity_check` + `schema_version`)** → `recoverInPlace` → rodante `Documents\Tienda - App\DataBase\tienda-app.db` → timestamped `...\backups\tienda_<YYYY-MM-DD_HHmm>.db` newest→oldest (each validated `integrity_check` + `schema_version` 1..16; failures recorded in `backupsTried`) → `{fatal, diagnostics}`. Returns `{ok|restored|adopted|fresh|fatal}` + `restoreInfo` (never-silent contract, R4).
  - **Refinement (review-confirmed, slice 1)**: validate the working DB after open BEFORE returning `{ok}` — better-sqlite3 does NOT throw at open on page-level/freelist corruption, so integrity-check-after-open is required to reach `recoverInPlace` (fail-loud R1). An integrity-ok-but-`schema_version=0` DB is a legitimate fresh-start state.
- `importDbFile(data, dbPath, flagPath)` — write tmp+rename, validate, write flag.
- `adoptOrFresh(...)` — no DB/no flag/no OPFS data: valid backup → adopt (same validation) + `{status:'adopted'}`; else fresh DB, no flag.
- `db.backup()` helper for manual export.

**NEW `src/app/services/native-sqlite.service.ts`** — `Database` impl: `sql<T>()` → `invoke('db:sql')`; `initialize()` implements the import decision roundtrip, then migrations, then rodante; on `{fatal}` → publish diagnostics to `DbStatusService`, resolve. `src/app/services/db-status.service.ts` (NEW): `fatal = signal<DbDiagnostics|null>`, `restoreInfo = signal<DbRestoreInfo|null>`.

## Fail-Loud + persist() (Capa 1)

- Both drivers: `initialize()` never falls back to `:memory:` (SqliteService drops SQLocal's silent fallback — open failure now throws, caught, published, resolves with blocking UI). No silent degraded mode anywhere (R1/R5).
- Web: after successful init, best-effort `navigator.storage.persist?.()` (fire-and-forget, log) (R9).
- `src/main.ts`: bootstrap `.catch()` DOM fallback (insurance for non-DB failures).
- `src/app/app.ts`/`app.html`: add `@if (dbStatus.fatal())` branch before `<router-outlet/>` (mirrors `ttlExpired`).
- **NEW** `src/app/components/db-error/db-error.component.ts` — full-screen "Contactá al desarrollador" + diagnostics + copy button.
- **NEW** `src/app/components/restore-feedback/restore-feedback.component.ts` — toast/modal: WHAT/from WHEN/lost window (R4).
- **NEW** `src/app/services/backup.service.ts` — `backup(trigger)` platform-aware (no-op on web), `exportarRespaldo()` (desktop IPC / web blob download).
- `jornada.service.ts`: `_cerrarAsync` awaits `backup('jornada-close')` inside try/catch (R6).

## Packaging (R10/R11)

- `electron-builder.yml` `files` += `dist-electron/db.js` (omitting breaks packaged main — R11). `asarUnpack: **/*.node` already covers better-sqlite3's native binary.
- `package.json`: version `0.1.9-beta`; deps `better-sqlite3` + `@types/better-sqlite3` + `@electron/rebuild`; scripts `electron:rebuild` (`npx @electron/rebuild -f -w better-sqlite3`) wired into `electron:build*`. **Dual lockfile caution**: pin identical version in `package-lock.json` AND `bun.lock`. electron-updater NSIS preserves `userData` (working DB + flag survive updates).

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `src/app/services/db-migrations.ts` | Create | Shared v1–v16 + seed runner + `MigrationExecutor` |
| `src/app/services/native-sqlite.service.ts` | Create | IPC-backed `Database` impl (desktop) |
| `src/app/services/db-status.service.ts` | Create | `fatal`/`restoreInfo` signals |
| `src/app/services/backup.service.ts` | Create | Backup triggers + manual export (platform-aware) |
| `src/app/components/db-error/db-error.component.ts` | Create | Blocking error screen + diagnostics |
| `src/app/components/restore-feedback/restore-feedback.component.ts` | Create | Restore toast/modal (what/from/lost) |
| `electron/db.ts` | Create | better-sqlite3 wrapper: open/validate/recover/backup/prune/adopt/import/cascade |
| `src/app/services/sqlite.service.ts` | Modify | Use shared runner (~500 lines removed); fail-loud open; `persist()` |
| `src/app/app.config.ts` | Modify | Driver class selection: `window.electronAPI ? NativeSqliteService : SqliteService` |
| `src/app/app.ts`, `app.html` | Modify | `dbStatus.fatal()` branch (TTL pattern) |
| `src/app/services/jornada.service.ts` | Modify | Awaited-non-fatal backup at `cerrar()` |
| `src/main.ts` | Modify | bootstrap `.catch()` DOM fallback |
| `electron/main.ts` | Modify | `db:*` handlers, app-close rodante, import handler |
| `electron/preload.ts` | Modify | Whitelist 5 `db:*` invoke channels |
| `electron/types.d.ts` | Modify | `DbInitResult` etc. payload types |
| `electron-builder.yml` | Modify | Add `dist-electron/db.js` |
| `package.json` | Modify | 0.1.9-beta; better-sqlite3 + rebuild deps/scripts |

## Testing Strategy (strict TDD, RED/GREEN)

| Layer | Spec | Approach |
|-------|------|----------|
| Unit (node vitest) | `electron/db.spec.ts` NEW | Real better-sqlite3 + `os.tmpdir()`: open/WAL, validate, cascade order (corrupt→recover→backup), prune retention, adopt, import writes flag only on success |
| Unit (ng test) | `db-migrations.spec.ts` NEW | `runMigrations` with fake executor capturing SQL; asserts all 16 versions + seed |
| Unit (ng test) | `native-sqlite.service.spec.ts` NEW | TestBed; mock `window.electronAPI.invoke = vi.fn()` canned `DbInitResult`; covers import-needed roundtrip, fatal → signal, sql passthrough |
| Unit (ng test) | `backup.service.spec.ts` NEW | Triggers map to `db:backupNow`; web no-op |
| Unit (ng test) | `db-status.service.spec.ts`, `db-error.component.spec.ts` NEW | Fatal signal renders blocking UI with diagnostics; restoreInfo renders toast |
| Regression | `sqlite.service.spec.ts` MODIFIED | Retargets to shared runner via service (existing mock SQLocal pattern) |
| Regression | 8 consumer specs + others | Unchanged (mock `DATABASE` directly) |

## Migration / Rollout

First launch of 0.1.9-beta on existing Electron installs: OPFS data → one-shot import to native DB → flag; subsequent launches skip. New installs: fresh DB + seed / ADOPT. Rollback: revert provider selection in `app.config.ts` (single change) + remove `dist-electron/db.js` from files; OPFS data untouched by import (non-destructive). No format change — both drivers are standard SQLite.

## Open Questions

- [ ] Confirm `Documents\Tienda - App\DataBase` (spec) vs existing `Documents\Tienda IPVE` folder for backups — follow spec unless user objects.
- [ ] Web manual export included (AD-6) — extends spec R5 scope; flagged for confirm at tasks.
