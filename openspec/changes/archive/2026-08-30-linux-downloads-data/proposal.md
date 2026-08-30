# Proposal: linux-downloads-data

## Intent

On Chromebook with Crostini, user-visible backups and exports written to `Documents/Tienda - App/...` are trapped inside the Linux container and invisible in ChromeOS Files app. Users cannot locate, copy, or attach their own data. This change redirects **only Linux (Crostini and desktop) backup/export paths** to `Downloads/Tienda - App/...` which is bind-mounted at `/mnt/chromeos/MyFiles/Downloads` and surfaces in ChromeOS Files. Windows/macOS behavior is unchanged. The live SQLite DB stays in `userData` (unchanged).

## Scope

### In Scope
- Centralized `baseDataDirFor(app, fs)` helper in `electron/main.ts` with Crostini detection
- Replace ~6 hardcoded `app.getPath('documents')` call sites with `baseDataDirFor()`
- Affected data: rodante backup, timestamped backups (30-retention), Tienda IPVE Excel exports, manual `db:export` dialog default path
- Test updates: `electron/main.spec.ts` (platform-specific mocks), `electron/db.spec.ts` (test helper)

### Out of Scope
- Live DB location (`userData/tienda-app.db`) — stays put
- Any UI, settings, or config for path selection
- `electron-updater` / auto-update flow
- Recovery cascade logic (receives new path, logic unchanged)
- Windows/macOS paths (remain `Documents/Tienda - App`)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `db-backup`: Backup destination path changes on Linux only (rodante + timestamped + pruning operate on new base)
- `excel-reportes`: Export default path changes on Linux only (IPVE sheet, manual export dialog)
- `database-storage`: No spec change — live DB path unchanged; only `documentsPath` passed to startup sequence changes on Linux

## Approach

**Centralized helper in `electron/main.ts` (Approach 1 from exploration):**

```ts
function baseDataDirFor(app: Electron.App, fs: typeof import('fs')): string {
  if (process.platform === 'linux') {
    const crostini = '/mnt/chromeos/MyFiles/Downloads';
    if (fs.existsSync(crostini)) return crostini;
    return app.getPath('downloads'); // XDG ~/Downloads fallback
  }
  return app.getPath('documents'); // Windows/macOS unchanged
}
```

All three path helpers (`dbPathFor`, `rodantePathFor`, `backupsDirFor`) and two IPC handlers (`file:saveFile`, `db:export`) switch to `baseDataDirFor()`. `db:initialize` passes the result as `documentsPath` to `runStartupSequence`.

**Why not alternatives:**
- Build flag: Cannot distinguish Crostini vs Linux desktop at runtime (both `target: linux`)
- Config DB read: Circular (need DB path to open DB), adds async to sync helpers, over-engineered

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `electron/main.ts` | Modified | `baseDataDirFor()` helper + 2 path helpers + 2 handlers + `db:initialize` call |
| `electron/main.spec.ts` | Modified | Platform-specific `app.getPath` mocks; Linux test expectations for Downloads |
| `electron/db.spec.ts` | Modified | `docsRoot()` test helper simulates new Linux path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 9p share EACCES on `/mnt/chromeos/MyFiles/Downloads` | High | `try { mkdirSync(recursive) } catch { fallback to app.getPath('downloads') }` |
| Downloads folder missing on first run | Medium | `mkdirSync({recursive: true})` already used in all handlers |
| Export dialog name collision (same filename) | Low | `dialog.showSaveDialog` handles; user chooses |
| Backup pruning (30) breaks on new path | Low | `pruneBackups(dir, 30)` operates on passed dir — unchanged |
| Recovery cascade finds wrong backups | Medium | `runStartupSequence` receives new `documentsPath` — rodante/timestamped resolved in new location; cascade logic identical |
| Existing tests fail on Linux CI | Medium | Update mocks to simulate platform-specific `app.getPath` returns; add Linux test suite |

## Rollback Plan

1. Remove `baseDataDirFor()` helper
2. Restore path helpers to `app.getPath('documents')`
3. Restore handlers and `db:initialize` to pass `app.getPath('documents')`
4. Revert test mocks and expectations in `main.spec.ts` and `db.spec.ts`
5. No migration needed — old backups in Documents remain readable; new ones go to Downloads

## Dependencies

- None external. Uses existing `fs`, `path`, `app` from Electron.

## Success Criteria

- [ ] On Crostini: rodante backup, timestamped backups, IPVE exports, manual export default → `Downloads/Tienda - App/...` (visible in ChromeOS Files)
- [ ] On Linux desktop (no Crostini): same data → `~/Downloads/Tienda - App/...`
- [ ] On Windows/macOS: all paths unchanged → `Documents/Tienda - App/...`
- [ ] Live DB remains at `userData/tienda-app.db` on all platforms
- [ ] All existing tests pass + new Linux-specific test cases
- [ ] Backup pruning (30) works on new Linux path
- [ ] Recovery cascade adopts from new Linux path on fresh install