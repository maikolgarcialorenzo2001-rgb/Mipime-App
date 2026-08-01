# Proposal: native-db-resilience

## Intent

Production data-loss on test PC: `QLC_CANTOPEN` (SQLite code 14) with SQLocal/OPFS. OPFS is per-origin evictable storage; the app never calls `navigator.storage.persist()`, and SQLocal silently falls back to `:memory:` on failure (console.warn only). Lost data is accepted; goal is preventing recurrence — desktop must stop depending on evictable browser storage.

## Scope

### In Scope
- **Capa 1 — Safety**: fail-loud DB init (blocking error UI, no silent `:memory:`); `navigator.storage.persist()` on web path; one-click "Exportar respaldo" → standard SQLite file.
- **Capa 2 — Root cause (desktop)**: `better-sqlite3` in Electron main via new IPC-backed `Database` impl; DB file at `app.getPath('userData')/tienda-app.db`; runtime driver selection (`window.electronAPI` presence); auto-backup via `db.backup()` → `Documents\Tienda - App\DataBase\tienda-app.db` (app open, jornada close, app close); one-shot OPFS→native import (`SQLocal.getDatabaseFile()` VACUUM INTO → IPC → native file); ADOPT valid backup on fresh install (validate `integrity_check`, visual feedback).
- **Capa 3 — Hygiene**: timestamped backups per jornada close (`backups\tienda_<timestamp>.db`), keep last 30, auto-prune.
- **Recovery cascade (auto, startup)**: working DB → continue; else in-place `.recover`; else newest valid backup (rodante → timestamped newest→oldest), validated `integrity_check` + `schema_version`; else blocking "contactar al desarrollador" + diagnostics (version, SQLite error, backups tried, why failed). NEVER silent restore — feedback shows WHAT/from WHEN/lost window.
- Version bump `0.1.9-beta` (electron-updater NSIS preserves userData).

### Out of Scope
- Recovering lost test-PC data (accepted as lost)
- Web/Capacitor native SQLite (no Node in WebView) — stays SQLocal
- Multi-device sync, encrypted backups, manual restore UI

## Capabilities

### New Capabilities
- `database-storage`: fail-loud init, driver selection, IPC native DB (desktop), `persist()` (web)
- `db-backup`: auto-backups (rodante + timestamped), retention 30, manual export
- `db-recovery`: startup cascade, validation, ADOPT, blocking UI + diagnostics

### Modified Capabilities
- None — all 8 consumers keep identical SQL; no spec-level requirement changes

## Approach

- `Database` interface (`src/app/services/database.ts`) is the seam; 8 consumers (auth, jornada, producto, stock-movimiento, user, venta, cuenta-cosa, jornada.page) unchanged.
- Services already use separate `sql()` calls for BEGIN/COMMIT/ROLLBACK (no multi-statement strings) → better-sqlite3 `prepare()` single-statement semantics compatible.
- Migrations v1–v16 extracted from SqliteService → shared migration runner (same SQL strings, driver-specific execution).
- IPC: `ipcMain.handle('db:sql'|'db:initialize'|'db:import'|'db:backup')`; `ipcRenderer.invoke` (async, never sendSync for SQL); preload whitelist + types.d.ts extension; contextIsolation:true, nodeIntegration:false already set.
- electron-builder `files` list is explicit → add `dist-electron/db.js` or main process breaks; `asarUnpack: "**/*.node"` already present.
- better-sqlite3: ABI rebuild for Electron 43 (`@electron/rebuild` auto + dev script); dual lockfiles (bun + npm) must pin same version.
- Testing: sqlite.service.spec.ts (~932 lines) retargets to shared runner; new native-sqlite.service.spec.ts (mock window.electronAPI.invoke) + electron/db.spec.ts; other specs mock DATABASE directly (unaffected).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/sqlite.service.ts` | Modified | Fail-loud init; migrations → shared runner |
| `src/app/services/native-sqlite.service.ts` | New | IPC-backed Database impl (desktop) |
| `electron/db.ts` | New | better-sqlite3 DB, backup, recovery cascade |
| `electron/main.ts`, `preload.ts`, `types.d.ts` | Modified | `db:*` IPC handlers + channel whitelist |
| `electron-builder.yml`, `package.json` | Modified | Add db.js to files; better-sqlite3; version 0.1.9-beta |
| DB error/restore UI component | New | Blocking error + restore feedback screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| better-sqlite3 ABI mismatch (Electron 43) | Med | `@electron/rebuild` + dev script; asarUnpack set |
| Migration runner divergence between drivers | Med | Shared runner, same SQL; spec retargets to it |
| Wider IPC surface | Low | Preload whitelist; async invoke only |
| OPFS import fails mid-way | Low | Non-destructive one-shot; OPFS left intact |
| Dual lockfiles drift on native dep | Low | Pin same version in both |

## Rollback Plan

- Revert provider registration in `app.config.ts` → SqliteService-only (single change); remove `dist-electron/db.js` from files list; revert main/preload/types/package.json. No format change — both drivers are standard SQLite; existing OPFS installs unaffected.

## Dependencies

- `better-sqlite3` + `@electron/rebuild` (new)
- SQLocal v0.18 `getDatabaseFile()` (existing dep)

## Success Criteria

- [ ] Simulated OPFS failure on desktop → native DB opens; no data loss, no silent `:memory:`
- [ ] Corrupted working DB → cascade auto-restores newest valid backup with visible feedback
- [ ] Fresh install + valid backup → ADOPT restores with visual feedback
- [ ] All 8 consumer specs green with SQL unchanged; sqlite.service.spec passes on shared runner
- [ ] Every accepted restore passes `integrity_check` = ok + latest `schema_version`
- [ ] Backup folder keeps last 30 timestamped files (prune verified)

## Open Questions

- Blocking error UI placement (pre-bootstrap static HTML vs Angular root) → design phase
- Restore-feedback UX copy (Spanish) → spec phase
- Manual export on web path too, or desktop-only? (scope: desktop) → confirm in spec
