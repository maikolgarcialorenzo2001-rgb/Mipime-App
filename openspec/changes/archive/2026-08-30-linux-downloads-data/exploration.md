# Exploration: linux-downloads-data

> NOTA (2026-08-30): esta exploración se hizo parados en `palmar-feature`, por eso cita
> `file:savePalmar`, `palmarDirFor` y `file:listPalmar`/`file:readPalmar`. **main NO tiene
> esas APIs.** Solo sirven las partes sobre backups/export (rodante, timestamped, IPVE,
> `db:export`) y la decisión de helper central. El alcance final sobre main está en
> proposal.md / design.md / tasks.md (ya corregidos).

## Current State

The Electron main process (`electron/main.ts`) hardcodes `app.getPath('documents')` as the base directory for all user-visible data:
- **Rodante backup**: `Documents/Tienda - App/DataBase/tienda-app.db` (lines 59-60)
- **Timestamped backups**: `Documents/Tienda - App/DataBase/backups/` (lines 61-62)
- **Palmar jornadas**: `Documents/Tienda - App/Palmar/` (lines 65-66)
- **Tienda IPVE Excel exports**: `Documents/Tienda - App/Tienda IPVE/` (line 190)
- **Manual DB export dialog default**: `Documents/Tienda - App/DataBase/` (lines 540-544)

The live SQLite database (`tienda-app.db`) lives in `app.getPath('userData')` — **this stays unchanged** (decision confirmed: SQLite on 9p share risks locking/corruption).

The `electron/db.ts` module receives paths as parameters (`opts.userDataPath`, `opts.documentsPath`) — it has no knowledge of `app.getPath`. The main process passes `app.getPath('documents')` as `documentsPath` to `runStartupSequence`.

No Linux/Crostini detection exists today (`grep` empty). Preload exposes `platform` and `isPackaged`.

## Affected Areas

| File | Lines | Why Affected |
|------|-------|--------------|
| `electron/main.ts` | 58-66 | Four path helpers (`dbPathFor`, `rodantePathFor`, `backupsDirFor`, `palmarDirFor`) use hardcoded `app.getPath('documents')` |
| `electron/main.ts` | 187-198 | `file:saveFile` handler hardcodes `app.getPath('documents')` for Tienda IPVE |
| `electron/main.ts` | 208-263 | `file:savePalmar` handler calls `palmarDirFor()` |
| `electron/main.ts` | 267-296 | `file:listPalmar` handler calls `palmarDirFor()` |
| `electron/main.ts` | 300-324 | `file:readPalmar` handler calls `palmarDirFor()` |
| `electron/main.ts` | 354-380 | `db:initialize` passes `app.getPath('documents')` to `runStartupSequence` |
| `electron/main.ts` | 491-534 | `db:backupNow` uses `rodantePathFor()` and `backupsDirFor()` |
| `electron/main.ts` | 537-561 | `db:export` defaultPath uses `app.getPath('documents')` |
| `electron/main.spec.ts` | 304-309, 347-348, 463-467, 596-598 | Tests assert hardcoded Documents paths; mock `app.getPath` returns `/fake/userData` for both userData and documents |
| `electron/main.spec.ts` | 826, 939, 1124, 1276, 1324 | File handler tests mock `app.getPath('documents')` → `/mock/Documents` and assert `Tienda - App` in paths |
| `electron/db.spec.ts` | 47-49 | `docsRoot()` helper simulates `Documents/Tienda - App/DataBase` for test fixtures |

## Approaches

### 1. Centralized helper in main.ts (Recommended)

Create `baseDataDirFor()` that returns platform-appropriate base directory:
- **Linux + Crostini** (`/mnt/chromeos/MyFiles/Downloads` exists) → `/mnt/chromeos/MyFiles/Downloads`
- **Linux desktop** (no Crostini mount) → `app.getPath('downloads')` (XDG `~/Downloads`)
- **Windows / macOS** → `app.getPath('documents')` (unchanged)

Update the four helpers and three handlers to use `baseDataDirFor()`.

**Pros:**
- Single source of truth for base directory
- Runtime detection (no build flags, no config DB reads)
- Minimal code change (~15 lines added, ~10 lines modified)
- Testable: helper is pure function given `app` and `fs`

**Cons:**
- Requires updating all call sites in main.ts
- Tests need platform-specific expectations

**Effort:** Low-Medium
**Files to modify:** `electron/main.ts` (helpers + 3 handlers), `electron/main.spec.ts` (mocks + expectations), `electron/db.spec.ts` (test helper)

### 2. Build flag via `environment.target`

Pass target platform at build time; compile-time branch selects base directory.

**Pros:** Zero runtime logic
**Cons:**
- Cannot distinguish Crostini vs regular Linux at runtime (both are `linux` target)
- Requires separate Linux builds for Crostini vs desktop
- Adds build pipeline complexity
- Violates "automatic detection" requirement

**Effort:** High (build changes + multiple artifacts)
**Verdict:** Discard

### 3. Read from v18 config table (schema_version / settings)

Query the SQLite config table at startup to determine base directory.

**Pros:** User-configurable in future
**Cons:**
- Main process doesn't read DB at startup (circular: need DB path to open DB)
- Adds async to synchronous path helpers
- Over-engineered for "automatic, no UI" requirement

**Effort:** High
**Verdict:** Discard

## Recommendation

**Approach 1 (centralized helper in main.ts)** is the only viable option. It satisfies:
- Automatic detection (no UI, no config)
- Crostini vs Linux desktop distinction at runtime
- Windows/macOS behavior unchanged
- Minimal, testable change
- Aligns with existing SRP: `db.ts` stays path-agnostic, main owns filesystem decisions

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| 9p share permissions on `/mnt/chromeos/MyFiles/Downloads` | High | Test write+mkdir on real Chromebook; fallback to `app.getPath('downloads')` if EACCES |
| Downloads folder missing on first run | Medium | `mkdirSync(recursive: true)` already used in all handlers |
| Spaces in `Tienda - App` on Linux | Low | `path.join` handles correctly; verify on target device |
| Export dialog collision (user picks same name) | Low | `dialog.showSaveDialog` handles; user chooses |
| Backup pruning (30) breaks on new path | Low | `pruneBackups(dir, 30)` operates on passed dir — unchanged logic |
| Recovery cascade finds wrong backups | Medium | `runStartupSequence` receives new `documentsPath` — rodante/timestamped resolved in new location; cascade logic identical |
| Existing tests fail on Linux CI | Medium | Update mocks to simulate platform-specific `app.getPath` returns; add Linux test suite |

## Ready for Proposal

**Yes.** The exploration is complete. The orchestrator should proceed to `sdd-propose` with:
- Change name: `linux-downloads-data`
- Scope: `electron/main.ts` (helpers + handlers), `electron/main.spec.ts`, `electron/db.spec.ts`
- Approach: Centralized `baseDataDirFor()` helper with Crostini detection
- Key constraint: DB live stays in `userData`; only backups/exports/palmar/IPVE move on Linux