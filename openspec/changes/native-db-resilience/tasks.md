# Tasks: native-db-resilience

Design is authoritative. Decisions referenced by name: AD-1..AD-9, RESOLVED-RISK-1 (import flag), RESOLVED-RISK-2 (non-fatal init + Angular root error). Note: `db:adopt`/`db:diagnostics` are NOT separate channels — folded into `db:initialize` (AD-9). Final invoke set: `db:initialize`, `db:sql`, `db:import`, `db:backupNow`, `db:export` (5 channels).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,800 (additions+deletions; ~1,000 are verbatim migration moves) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Decision needed before apply: (1) chain strategy — stacked-to-main vs feature-branch-chain vs size-exception (design exceeds 400 lines, forecast High); (2) web manual export scope — design AD-6 default = blob download on web; extends spec db-backup R5 (desktop-only); confirm before T12.

### Suggested Work Units (chainable)

| Unit | Tasks | Goal | Likely PR | Notes |
|------|-------|------|-----------|-------|
| 1 | T1, T2 | Foundation: shared runner + native DB wrapper | PR 1 | Tests + docs included; no behavior change |
| 2 | T3, T4, T5 | IPC contract + native driver + selection | PR 2 | Base = PR 1 branch (feature-branch-chain) or main (stacked) |
| 3 | T6, T7 | Fail-loud UI + one-shot import | PR 3 | Base = PR 2 branch |
| 4 | T8, T9, T10, T11, T12 | Backup/recovery/adopt/persist/export | PR 4 | Base = PR 3 branch |
| 5 | T13 | Packaging: builder + manifest + version | PR 5 | Small; may ride with PR 4 |

## Phase 1: Foundation

### T1 — Extract shared migration runner (db-migrations)
- [x] T1 DONE (slice 1, 2026-07-31): NEW `src/app/services/db-migrations.ts`, `src/app/services/db-migrations.spec.ts`; MOD `src/app/services/sqlite.service.ts` (migrations removed, runner delegate), `sqlite.service.spec.ts` (unchanged, passes).
- **Files**: NEW `src/app/services/db-migrations.ts`, `src/app/services/db-migrations.spec.ts`; MOD `src/app/services/sqlite.service.ts`, `src/app/services/sqlite.service.spec.ts`
- **Steps**: (1) Create `interface MigrationExecutor { sql<T>(query, params?): Promise<T[]> }` + `runMigrations(exec, {seedEnabled})` moving `_migrationV1.._migrationV16` + `_seedIfEmpty` VERBATIM from SqliteService (AD-2, AD-3). (2) SqliteService: delete `_migrationV1..16` + `_seedIfEmpty` + `environment`/`hash-password` imports (~500 lines); `initialize()` = create `schema_version` → `runMigrations({sql:(q,p)=>client.sql(q, ...(p??[]))}, {seedEnabled: environment.seedEnabled})`. (3) Retarget spec: keep mock SQLocal; behavior assertions unchanged.
- **Tests (RED first)**: `db-migrations.spec.ts` — fake executor captures SQL; asserts 16 `INSERT INTO schema_version` + seed batches only when `seedEnabled:true`. Retargeted `sqlite.service.spec.ts` — fresh mock DB initializes v1–v16 + seed identically.
- **DoD**: `ng test` green, `ng lint` clean; identical SQL for consumers (R4).
- **Deps**: none.

### T2 — Native DB wrapper (electron/db.ts)
- [x] T2 DONE (slice 1, 2026-07-31): NEW `electron/db.ts`, `electron/db.spec.ts`; deps pulled forward from T13 (better-sqlite3@13.0.2 pinned in both lockfiles, @types, @electron/rebuild, electron:rebuild script — version NOT bumped). NOTE for T13: add `dist-electron/db.js` to electron-builder.yml `files` (R11).
- **Files**: NEW `electron/db.ts`, `electron/db.spec.ts`
- **Steps** (prereq: install `better-sqlite3`/`@types`/`@electron/rebuild` — manifest lands in T13): (1) `openNativeDb` — WAL, `foreign_keys=ON`, `busy_timeout=5000`; throw on open failure. (2) `validateDb` — `integrity_check` + `MAX(version) FROM schema_version` → `{ok, integrity, schemaVersion}`. (3) `backupDb` via `db.backup()` incremental + mkdir recursive. (4) `pruneBackups(dir, keep=30)` — sort `tienda_*.db` by timestamp. (5) `recoverInPlace` — `VACUUM INTO` tmp → validate → atomic swap, preserve `tienda-app.db.corrupt-<ts>` (AD-4). (6) `runStartupSequence({userDataPath, documentsPath, appVersion, platform})` — cascade: open → recoverInPlace → rodante `Documents\Tienda - App\DataBase\tienda-app.db` → timestamped newest→oldest, each validated (R2), failures into `backupsTried`; returns `{ok|restored|adopted|fresh|fatal}` + `restoreInfo` + `diagnostics`. (7) `importDbFile(data, dbPath, flagPath)` — tmp+rename, validate, write flag (RESOLVED-RISK-1); `adoptOrFresh`; export helper.
- **Tests (RED, node vitest `npm run test:electron`)**: open creates WAL; recoverInPlace repairs corrupt file preserving `.corrupt-<ts>`; cascade order corrupt→recover→rodante→timestamped (R1); prune keeps exactly 30 (R3); import writes flag ONLY on success.
- **DoD**: `npm run test:electron` green; `tsc -p electron/tsconfig.json` clean.
- **Deps**: none (T13 for manifest).

## Phase 2: IPC + Native Driver

### T3 — IPC contract, preload whitelist, types
- [x] T3 DONE (slice 2, 2026-07-31): MOD `electron/types.d.ts` (global DbInitStatus/RestoreFrom/DbRestoreInfo/DbBackupTried/DbDiagnostics/DbInitResult/DbBackupResult/DbImportResult/DbExportResult), `electron/main.ts` (5 handlers: db:initialize→runStartupSequence, db:sql→prepare() single-statement + stmt.reader branch, db:import→importDbFile/null→adoptOrFresh, db:backupNow→open=rodante / jornada-close=rodante+timestamped+prune(30), db:export→dialog+backupDb), `electron/preload.ts` (VALID_INVOKE_CHANNELS += 5, NO send/on), specs (+20 tests). NOTE: design says `prepare().all()` but better-sqlite3 v13 THROWS on non-reader statements — implemented reader-branch (run() + []) as deviation (same R6 single-statement semantics).
- [x] T3 REVIEW FIXES (2026-07-31, commits fde9adf + c143653): (M1) db:initialize/db:import handlers NUNCA lanzan — try/catch → {status:'fatal',diagnostics} / {ok:false,error} (adoptOrFresh puede lanzar al crear DB fresca por disco); (S1) db:sql rechaza ATTACH/DETACH y escrituras PRAGMA salvo `PRAGMA foreign_keys` (migrationV15 la necesita); (S3) db:backupNow valida trigger ∈ {open, jornada-close} → {ok:false} si no; (S5) preload: tests db:* son invoke-only (no send/on).
- **Files**: MOD `electron/main.ts`, `electron/preload.ts`, `electron/types.d.ts`, `electron/main.spec.ts`, `electron/preload.spec.ts`
- **Steps**: (1) `types.d.ts`: add `DbInitStatus`, `DbRestoreInfo`, `DbBackupTried`, `DbDiagnostics`, `DbInitResult`, `DbBackupResult`, `DbImportResult`, `DbExportResult` (design IPC section). (2) `main.ts`: `ipcMain.handle` `db:initialize` (runs `runStartupSequence`, adopt/diagnostics folded in — AD-9), `db:sql` (single-statement `prepare().all()`, R6), `db:import`, `db:backupNow` `({trigger:'open'|'jornada-close'})`, `db:export`. (3) `preload.ts`: `VALID_INVOKE_CHANNELS` += the 5 channels; NO send/on additions (R7).
- **Tests (RED)**: preload.spec — the 5 channels invoke, unknown rejected; main.spec — handlers wired to mocked `electron/db.ts` functions, db:sql rejects multi-statement input.
- **DoD**: `npm run test:electron` green; no `sendSync` for SQL (R7).
- **Deps**: T2.

### T4 — IPC-backed Database impl (native-sqlite.service)
- [x] T4 DONE (slice 2, 2026-07-31): NEW `src/app/services/native-sqlite.service.ts` + spec (6 tests). sql→invoke('db:sql'); initialize→db:initialize, fatal→DbStatusService signal + RESOLVE (never throw, RESOLVED-RISK-2), import-needed→OPFS getDatabaseFile()→ArrayBuffer→db:import→re-initialize, then runMigrations over db:sql executor (AD-3). Import roundtrip built here per task text; T7 may only add edge tests/refinements.
- [x] T4 REVIEW FIXES (2026-07-31, commit 77e51f3, +5 tests): (M1) initialize() NUNCA lanza — primer db:initialize envuelto en try/catch → fatal sintetizado stage 'open'; roundtrip: db:import y re-init envueltos → fatal stage 'import'; early return tras fatal post-roundtrip (antes caía a runMigrations → rechazo). (M2) resultado de db:import YA NO se descarta: {ok:false} → fatal stage 'import' sin migrar; import-needed repetido tras roundtrip → fatal (evita que db:sql cree DB fresca y deje los datos OPFS varados — RESOLVED-RISK-1).
- **Files**: NEW `src/app/services/native-sqlite.service.ts`, `src/app/services/native-sqlite.service.spec.ts`
- **Steps**: (1) Implement `Database` interface unchanged (R3): `sql<T>()` → `invoke('db:sql', {query, params})`. (2) `initialize()`: invoke `db:initialize`; on `{status:'import-needed'}` run import roundtrip (T7) then re-invoke; then `runMigrations` over `db:sql` executor (AD-3); on `{fatal}` publish to DbStatusService and RESOLVE (never throw — RESOLVED-RISK-2).
- **Tests (RED, TestBed)**: mock `window.electronAPI.invoke = vi.fn()` with canned `DbInitResult`; asserts sql param passthrough, initialize roundtrip, fatal → signal set, resolves without throw.
- **DoD**: `ng test` green.
- **Deps**: T3, T1.

### T5 — Driver selection + DbStatusService
- [x] T5 DONE (slice 2, 2026-07-31): NEW `src/app/services/db-status.service.ts` + spec (3 tests) — fatal/restoreInfo signals + setters (providedIn root). MOD `src/app/app.config.ts` — `provideDatabase(window.electronAPI ? NativeSqliteService : SqliteService)` (AD-1 presence, not isPackaged). Web suite stays green (635).
- **Files**: MOD `src/app/app.config.ts`; NEW `src/app/services/db-status.service.ts` + spec
- **Steps**: (1) `DbStatusService`: `fatal = signal<DbDiagnostics|null>`, `restoreInfo = signal<DbRestoreInfo|null>` + setters. (2) `app.config.ts`: `provideDatabase(window.electronAPI ? NativeSqliteService : SqliteService)` (AD-1 — presence, not `isPackaged`).
- **Tests (RED)**: db-status.spec — signals default null, setters update.
- **DoD**: `ng test` green.
- **Deps**: T4.

## Phase 3: Fail-Loud + Resilience

### T6 — Fail-loud blocking UI
- [x] T6 DONE (slice 3, 2026-07-31): NEW `src/app/components/db-error/` (component + html + css + spec, 9 tests) — overlay full-screen z-50 (espejo ttl-expired), título "Error crítico en la base de datos", "Contactá al desarrollador", diagnóstico JSON en bloque mono + botón "Copiar diagnóstico" (navigator.clipboard). MOD `src/app/app.ts`/`app.html` (inyecta DbStatusService; `@if (dbStatus.fatal()) <app-db-error/> @else if (ttlExpired()) ...` — fatal PRIORIZA sobre TTL), `src/main.ts` (`.catch()` → mensaje mínimo DOM en `<app-root>`). app.spec +2 (fatal → db-error en vez de router-outlet; prioridad sobre ttl). Sin path `:memory:` silencioso en ningún lado (R1/R5).
- **Files**: NEW `src/app/components/db-error/db-error.component.ts` + `.html` + `.css` + spec; MOD `src/app/app.ts`, `src/app/app.html`, `src/main.ts`
- **Steps**: (1) Component: full-screen "Contactá al desarrollador" + diagnostics `{appVersion, platform, sqliteError, stage, backupsTried}` + "Copiar diagnóstico" button (Spanish copy, TTL-pattern styling — look at the existing TTL-expired pattern in the app for styling conventions). (2) `app.ts`/`app.html`: inject DbStatusService; `@if (dbStatus.fatal()) <app-db-error/> @else <router-outlet/>` (mirrors `ttlExpired`). (3) `main.ts`: `bootstrapApplication(...).catch()` → minimal DOM message into `<app-root>`.
- **Tests (RED)**: db-error.spec — fatal signal renders blocking content + diagnostics + copy; app.spec — fatal renders db-error instead of router-outlet (R1/R5).
- **DoD**: web tests green via vitest; no silent `:memory:` path anywhere.
- **Deps**: T5 (DbStatusService exists from slice 2).

### T7 — One-shot OPFS→native import (flag-guarded)
- [x] T7 DONE (slice 3, 2026-07-31): roundtrip YA construido en T4 — T7 lo completa: (a) renderer: archivo OPFS VACÍO (0 bytes) → `db:import {file:null}` (mismo contrato que CANTOPEN, +1 test); test R8 no destructivo (solo getDatabaseFile, canales = db:initialize/db:import/db:sql); (b) main: validación de payload `db:import` (S2/T7) — instanceof ArrayBuffer + `MAX_IMPORT_BYTES` (512MB, exportado desde electron/db.ts) → `{ok:false, error}` sin tocar DB (+2 tests main.spec). Semántica flag intacta (RESOLVED-RISK-1): flag solo tras import+validate OK (tests ya en db.spec T2); fallo → sin flag → reintento próximo arranque; OPFS intacto (R8, lectura VACUUM INTO, no destructiva).
- **Files**: MOD `src/app/services/native-sqlite.service.ts`, `electron/main.ts`, `electron/db.ts` (export MAX_IMPORT_BYTES); tests en `electron/main.spec.ts`, `native-sqlite.service.spec.ts` (electron/db.spec flag tests ya existentes desde T2)
- **Steps**: (1) Import-needed branch in `initialize()`: dynamic-import SQLocal `getDatabaseFile()` → ArrayBuffer; data → `invoke('db:import', {file})`; empty/CANTOPEN → `invoke('db:import', {file:null})`; re-run `db:initialize`. (2) main `db:import`: data → `importDbFile` (tmp+rename+validate+flag); null → log "no OPFS data", NO flag, continue `adoptOrFresh`; validation failure → no flag, retry next launch; disk failure → fatal diagnostics (RESOLVED-RISK-1 failure semantics).
- **Tests (RED)**: electron/db.spec — flag written only after successful import+validation, absent on failure; native-sqlite.spec — import-needed roundtrip then re-initialize.
- **DoD**: both suites green; OPFS left intact (non-destructive, R8).
- **Deps**: T4, T3.

### T8 — Backup subsystem
- **Files**: NEW `src/app/services/backup.service.ts` + spec; MOD `src/app/services/jornada.service.ts`, `electron/main.ts`
- **Steps**: (1) `backup(trigger:'open'|'jornada-close')` → `invoke('db:backupNow', {trigger})`; web = no-op (AD-6); failures never interrupt (R6). (2) main `db:backupNow`: open → rodante only; jornada-close → rodante + timestamped `backups\tienda_<YYYY-MM-DD_HHmm>.db` + prune(30) (R1–R3). (3) main window `close` handler: sync best-effort rodante (AD-8). (4) `jornada.service.ts` `_cerrarAsync`: await `backup('jornada-close')` in try/catch, swallow (AD-7).
- **Tests (RED)**: backup.service.spec — triggers map to `db:backupNow`, web no-op; jornada.service.spec — cerrar awaits backup, backup failure doesn't break close.
- **DoD**: `ng test` + `npm run test:electron` green.
- **Deps**: T3, T4.

### T9 — ADOPT + restore feedback
- **Files**: NEW `src/app/components/restore-feedback/restore-feedback.component.ts` + `.html` + `.css` + spec; MOD `src/app/app.ts`, `src/app/app.html`; tests in `electron/db.spec.ts`
- **Steps**: (1) `adoptOrFresh`: no DB + no flag + no OPFS data → newest valid backup (validate integrity_check + schema_version 1..16, AD-5) → copy to userData, `{status:'adopted'}` + restoreInfo; else fresh DB no flag. (2) `restore-feedback.component`: transient toast/modal — WHAT restored / FROM WHEN / lost window (R4), fed by `dbStatus.restoreInfo`; distinct from blocking screen. (3) `app.html`: render `<app-restore-feedback/>` when restoreInfo set.
- **Tests (RED)**: component spec — restoreInfo renders what/from/lost; electron/db.spec — valid backup adopted, invalid skipped with reason.
- **DoD**: suites green.
- **Deps**: T8, T5.

### T10 — Recovery cascade integration + diagnostics
- **Files**: tests in `electron/db.spec.ts`, `native-sqlite.service.spec.ts`; MOD `electron/db.ts`, `native-sqlite.service.ts` as needed
- **Steps**: (1) Assert cascade per R1: working → continue; open fails → `recoverInPlace`; fails → rodante then timestamped newest→oldest, each validated (R2). (2) All fail → `{status:'fatal'}` + diagnostics `{appVersion, platform, sqliteError, stage, backupsTried}` (R3). (3) Wire `restoreInfo` → DbStatusService → restore-feedback (R4).
- **Tests (RED)**: cascade ordering asserted; fatal carries per-backup reasons; never `:memory:` (R5).
- **DoD**: suites green; end-to-end fail-loud verified.
- **Deps**: T2, T6, T9.

### T11 — navigator.storage.persist() on web
- **Files**: MOD `src/app/services/sqlite.service.ts` + spec
- **Steps**: after successful `initialize()`, fire-and-forget `navigator.storage.persist?.()` with log (R9).
- **Tests (RED)**: spec — persist called after init when available; no throw when absent.
- **DoD**: `ng test` green.
- **Deps**: T1.

### T12 — Manual export
- **Files**: MOD `src/app/services/backup.service.ts` + spec, `electron/main.ts`
- **Steps**: (1) `exportarRespaldo()`: desktop → `invoke('db:export')` → main `dialog.showSaveDialog` + `backupDb` to chosen path (R5). (2) Web scope per design AD-6 default = blob download via existing `getDatabaseFile()` — FLAGGED: confirm before apply (extends spec R5).
- **Tests (RED)**: spec — export invokes `db:export`; canceled → `{ok:false, canceled:true}`.
- **DoD**: suites green.
- **Deps**: T8.
- **Decision**: confirm web manual export inclusion.

## Phase 4: Packaging

### T13 — Packaging: builder files + manifest + version
- **Files**: MOD `electron-builder.yml`, `package.json`, `package-lock.json`, `bun.lock`
- **Steps**: (1) `electron-builder.yml` `files` += `dist-electron/db.js` (R11); `asarUnpack: "**/*.node"` already covers native binary. (2) `package.json`: version `0.1.9-beta` (R10); deps `better-sqlite3`; dev `@types/better-sqlite3`, `@electron/rebuild`; script `electron:rebuild` (`npx @electron/rebuild -f -w better-sqlite3`) wired into `electron:build*`. (3) Pin identical better-sqlite3 version in BOTH `package-lock.json` AND `bun.lock` (dual-lockfile caution).
- **Tests**: `electron:build:win` succeeds; packaged app launches with native DB (manual smoke); `dist-electron/db.js` present in asar.
- **DoD**: build green; version `0.1.9-beta`.
- **Deps**: T2 (dep install), last.
