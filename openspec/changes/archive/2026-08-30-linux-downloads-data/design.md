# Design: linux-downloads-data

> ALCANCE CORREGIDO (2026-08-30): el diseño original se redactó parados en palmar-feature.
> Este change vive SOLO sobre **main** (0.1.18), que NO tiene `file:savePalmar` ni
> `palmarDirFor`. Los call sites reales en main son: `rodantePathFor`, `backupsDirFor`,
> `file:saveFile` (Tienda IPVE), `db:export`, `db:initialize` → `runStartupSequence`.

## Technical Approach

Centralize the platform-aware base directory decision in a single `baseDataDirFor(app, fs)` helper in `electron/main.ts`. The existing path helpers (`dbPathFor`, `rodantePathFor`, `backupsDirFor`) and the two IPC handlers (`file:saveFile`, `db:export`) switch to this helper. The `db:initialize` handler passes the new base to `runStartupSequence` as `documentsPath`. Windows/macOS remain unchanged (`Documents/Tienda - App`). Live DB stays in `userData`.

## Architecture Decisions

### AD-1: Centralized `baseDataDirFor(app, fs)` helper in main.ts

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline detection in each helper | DRY violation, multiple update surfaces | **Rejected** |
| Config table read at startup | Circular (need DB path to open DB), async in sync helpers | **Rejected** |
| Build-time flag via `target` | Cannot distinguish Crostini vs Linux desktop at runtime | **Rejected** |
| **Single pure helper `baseDataDirFor(app, fs)`** | Single source of truth, testable, minimal change | **Chosen** |

**Signature**: `function baseDataDirFor(app: Electron.App, fs: typeof import('fs')): string`

**Location**: Module scope in `electron/main.ts`, above the path helpers.

**Replaces**: The `app.getPath('documents')` calls in `rodantePathFor`, `backupsDirFor`. `dbPathFor` stays on `userData` (unchanged).

### AD-2: Crostini detection + EACCES degradation

| Aspect | Decision |
|--------|----------|
| Crostini check | `fs.existsSync('/mnt/chromeos/MyFiles/Downloads')` |
| Linux desktop fallback | `app.getPath('downloads')` (XDG `~/Downloads`) |
| Windows/macOS | `app.getPath('documents')` (unchanged) |
| EACCES on 9p share | `try { mkdirSync(recursive) } catch { console.error + fallback to XDG Downloads }` at **call sites** (handlers + backupRodanteSync), not inside helper. Helper stays pure and fast. |
| Log format | `console.error('[baseDataDirFor] EACCES on Crostini mount, falling back to XDG Downloads:', err)` |

**Why at call sites**: The helper is called ~6×; `mkdirSync` is only needed where we actually write. The helper returns the *intended* base; callers handle write-time failures per existing R6 (non-fatal backups) pattern.

### AD-3: `runStartupSequence` receives new base via `documentsPath`

`db:initialize` already passes `app.getPath('documents')` as `documentsPath` to `runStartupSequence`. **Only `main.ts` changes**: the value passed becomes `baseDataDirFor(app, fs)`. `electron/db.ts` is untouched — it already uses the passed `documentsPath` for rodante/backups construction. This preserves the clean separation: main owns filesystem decisions, db stays path-agnostic.

### AD-4: `db:export` and `file:saveFile` defaultPath per platform

| Handler | Current defaultPath | New defaultPath |
|---------|---------------------|-----------------|
| `file:saveFile` (IPVE) | `Documents/Tienda - App/Tienda IPVE/` | `baseDataDirFor()/Tienda - App/Tienda IPVE/` |
| `db:export` dialog | `Documents/Tienda - App/DataBase/exportName` | `baseDataDirFor()/Tienda - App/DataBase/exportName` |

`dialog.showSaveDialog` keeps the native dialog — only `defaultPath` changes. User can still navigate anywhere.

### AD-5: Testing strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (main.spec.ts) | `baseDataDirFor` returns correct path per platform | Mock `process.platform`, `fs.existsSync`, `app.getPath`; verify return values for Crostini / Linux desktop / Windows / macOS |
| Unit (main.spec.ts) | Path helpers & handlers use new base on Linux | Override `mockAppGetPath` per-platform; assert paths contain `Downloads/Tienda - App` on Linux, `Documents/Tienda - App` on Windows/macOS |
| Unit (db.spec.ts) | `runStartupSequence` adopts from new Linux base | New test helper `linuxDocsRoot(dir)` mirroring `docsRoot`; scenarios for Crostini and Linux desktop |
| Integration | Backup pruning (30) on new Linux path | Existing `pruneBackups` tests cover logic; add one Linux-path variant in `db.spec.ts` |
| E2E | Not in scope — no UI change, manual verification on target device | N/A |

**Shared test helper**: `mockPlatform(getPathReturns: { documents: string; downloads: string; userData: string })` in `main.spec.ts` to reduce duplication across platform test suites.

## Data Flow

```
IPC call (db:backupNow / db:export / file:saveFile)
       │
       ▼
baseDataDirFor(app, fs) ───→ Crostini? ──yes──→ /mnt/chromeos/MyFiles/Downloads
       │                          │
       │                          no
       │                          ▼
       │                 Linux desktop? ──yes──→ app.getPath('downloads')
       │                          │
       │                          no
       │                          ▼
       └──────────────────────────→ app.getPath('documents') (Win/mac)
       │
       ▼
path.join(base, 'Tienda - App', subdir...)
       │
       ▼
mkdirSync(recursive) + writeFileSync / backupDb / dialog.defaultPath
       │
       ▼
EACCES? ──yes──→ console.error + fallback to XDG Downloads + retry
       │
       no
       ▼
Success / {ok:false,error} (R6 non-fatal)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `electron/main.ts` | Modify | Add `baseDataDirFor()` helper; update 2 path helpers (`rodantePathFor`, `backupsDirFor`; `dbPathFor` stays on userData); update 2 handlers (`file:saveFile`, `db:export`); update `db:initialize` to pass new base; add EACCES try/catch at write sites |
| `electron/main.spec.ts` | Modify | Add `mockPlatform()` helper; add Linux/Crostini/desktop test suites for `baseDataDirFor`, path helpers, and handlers; mock `process.platform` and `fs.existsSync` per test |
| `electron/db.spec.ts` | Modify | Add `linuxDocsRoot(dir)` helper for Linux test fixtures; add test cases for `runStartupSequence` adopting from new Linux base (Crostini + desktop); existing Windows tests unchanged |

## Interfaces / Contracts

No new IPC contracts. Existing handlers return same shapes. Only internal path resolution changes.

```ts
// New internal helper (not exposed via IPC)
function baseDataDirFor(app: Electron.App, fs: typeof import('fs')): string {
  if (process.platform === 'linux') {
    const crostini = '/mnt/chromeos/MyFiles/Downloads';
    if (fs.existsSync(crostini)) return crostini;
    return app.getPath('downloads');
  }
  return app.getPath('documents');
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `baseDataDirFor` pure logic | Mock `process.platform`, `fs.existsSync`, `app.getPath`; 4 platform matrix |
| Unit | Path helpers compose correctly | Call `rodantePathFor()` etc. and assert full path string per platform |
| Unit | Handlers write to new Linux base | Spy `mkdirSync`/`writeFileSync`/`dialog.showSaveDialog`; assert called with Downloads path on Linux |
| Unit | `runStartupSequence` adoption from Linux base | Use new `linuxDocsRoot()` fixture in `db.spec.ts`; verify rodante/timestamped lookup in Downloads |
| Unit | Backup pruning on new path | Existing tests sufficient; add one `pruneBackups` call with Linux-style path |
| Unit | EACCES fallback | Mock `fs.existsSync(true)` then `mkdirSync` throws EACCES; verify fallback path used and error logged |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in this change. All filesystem operations use existing `fs.mkdirSync`/`writeFileSync`/`backupDb` patterns.

## Migration / Rollout

No migration required. Old backups in `Documents/Tienda - App` remain readable; new backups go to `Downloads/Tienda - App` on Linux. Fresh installs on Linux create the new structure. No feature flag needed — runtime detection is automatic.

## Open Questions

- [ ] **Blocker**: Verify real Crostini EACCES behavior on device — the fallback logic assumes `mkdirSync` throws EACCES; if it fails silently or with different code, adjustment needed.
- [ ] **Non-blocker**: Should `baseDataDirFor` memoize its result? Current call count (~6) is negligible; add memoization only if profiling shows impact.

---

**Size**: ~700 words (under 800 budget)