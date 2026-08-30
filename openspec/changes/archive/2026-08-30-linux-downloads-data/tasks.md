# Tasks: linux-downloads-data

> ALCANCE REVISADO (2026-08-30): este change vive SOLO sobre **main**. Un apply previo
> se ejecutó por error sobre palmar-feature y fue DESCARTADO. main NO tiene
> `file:savePalmar` ni `palmarDirFor`: el alcance son los call sites que existen en main.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Centralize Linux data dir helper + update path functions | PR 1 | `bun run test:electron -- -t "baseDataDirFor"` | `bun run test:electron` | Rollback: remove helper, restore original `app.getPath('documents')` calls |
| 2 | Update IPC handlers to use new base data dir | PR 2 | `bun run test:electron -- -t "IPC handlers"` | `bun run test:electron` | Rollback: restore original `app.getPath('documents')` in handlers |
| 3 | Add platform-specific test mocks and Linux test suites | PR 3 | `bun run test:electron main.spec.ts` | `bun run test:electron` | Rollback: remove new test cases, restore mock defaults |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Add `baseDataDirFor(app, fs)` helper function in `electron/main.ts` with Crostini detection `/mnt/chromeos/MyFiles/Downloads` → that path; Linux desktop → `app.getPath('downloads')`; win/mac → `app.getPath('documents')`.
- [x] 1.2 Update `rodantePathFor()` to use `baseDataDirFor(app, fs)` instead of `app.getPath('documents')`.
- [x] 1.3 Update `backupsDirFor()` to use `baseDataDirFor(app, fs)` instead of `app.getPath('documents')`.

## Phase 2: Core Implementation - IPC Handlers (solo los que existen en main)

- [x] 2.1 Update `file:saveFile` IPC handler (export Tienda IPVE) to write under `path.join(baseDataDirFor(app, fs), 'Tienda - App', 'Tienda IPVE')` instead of `app.getPath('documents')`.
- [x] 2.2 Update `db:export` IPC handler to use `baseDataDirFor(app, fs)` as `defaultPath` base instead of `app.getPath('documents')`.
- [x] 2.3 Update `db:initialize` handler to pass `baseDataDirFor(app, fs)` as `documentsPath` instead of `app.getPath('documents')` (runStartupSequence ya recibe esa ruta por parámetro).

## Phase 3: Integration / Testing Setup

- [x] 3.1 Add `mockPlatform(getPathReturns: { documents: string; downloads: string; userData: string })` helper in `electron/main.spec.ts` for platform-specific `app.getPath` mocks.
- [x] 3.2 Add Linux/Crostini test suites in `electron/main.spec.ts` for `baseDataDirFor` and path helpers (verify 4-platform matrix).
- [x] 3.3 Add `linuxDocsRoot(dir)` test helper in `electron/db.spec.ts` mirroring `docsRoot()` for Linux path fixtures.
- [x] 3.4 Add test cases for `runStartupSequence` adopting from new Linux base (Crostini + desktop) using `linuxDocsRoot()`.

## Phase 4: Testing - Test-First (TDD) RED Tasks

- [x] 4.1 **RED test**: `baseDataDirFor` returns `/mnt/chromeos/MyFiles/Downloads` when `process.platform='linux'` y `fs.existsSync('/mnt/chromeos/MyFiles/Downloads')` true; runner `bun run test:electron` — falla hasta que exista el helper.
- [x] 4.2 **RED test**: `baseDataDirFor` returns `app.getPath('downloads')` en Linux desktop cuando `/mnt/chromeos` no existe.
- [x] 4.3 **RED test**: `baseDataDirFor` returns `app.getPath('documents')` en win32/darwin.
- [x] 4.4 **RED test**: path helpers (`rodantePathFor`, `backupsDirFor`) componen con la nueva base Linux.
- [x] 4.5 **RED test**: handlers (`file:saveFile`, `db:export`) escriben/usan la nueva base Linux (spy mkdirSync/writeFileSync/dialog.showSaveDialog con Downloads path).
- [x] 4.6 **RED test**: `runStartupSequence` adopta desde la nueva base Linux usando `linuxDocsRoot()` en `db.spec.ts`.

## Phase 5: Cleanup

- [x] 5.1 Verify all `app.getPath('documents')` references in main.ts are either replaced by `baseDataDirFor()` or justified (`dbPathFor` stays on `userData` — live DB, unchanged).
- [x] 5.2 Update comments reflecting the new centralized path resolution pattern; remove inline Crostini detection duplication.

(End of file - total 62 lines)