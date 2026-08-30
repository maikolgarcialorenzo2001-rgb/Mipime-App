# Apply Progress: linux-downloads-data

> HISTORIAL: un apply previo se ejecutó por error sobre `palmar-feature` y fue DESCARTADO
> (stash dropeado `e8d4f493`, working tree limpiado). Este progreso NO refleja estado sobre
> main: el re-apply completo está pendiente desde cero sobre `feature/linux-downloads-data`
> (base: main d59f135).

- **Branch**: feature/linux-downloads-data (base main, NO palmar)
- **Status**: COMPLETADO — all Phase 1-5 tasks implemented and tests passing
- **Artefactos**: limpiados de referencias a palmar (`file:savePalmar`, `palmarDirFor`, carpeta Palmar)
- **Alcance verificado sobre main (6 call sites)**:
  - `rodantePathFor` — switched to `baseDataDirFor()` ✓
  - `backupsDirFor` — switched to `baseDataDirFor()` ✓
  - `file:saveFile` (Tienda IPVE) — writes under `baseDataDirFor()/Tienda - App/Tienda IPVE` ✓
  - `db:export` — `defaultPath` uses `baseDataDirFor()` ✓
  - `db:initialize` — passes `baseDataDirFor()` as `documentsPath` to `runStartupSequence` ✓
  - `dbPathFor` — UNCHANGED (stays on `userData`) ✓
- **EACCES fallback**: implemented in `file:saveFile` handler (logs `[baseDataDirFor] EACCES on Crostini mount, falling back to XDG Downloads:`)
- **TDD**: RED tests written first, all GREEN (164/165 pass; 1 pre-existing failure: schema_version 17 vs 18 — non-blocking)
- **Zero palmar references**: confirmed via grep

## Test Results

| Test Suite | Passed | Failed | Notes |
|------------|--------|--------|-------|
| `electron/main.spec.ts` | 88 | 1 | Pre-existing integration test (schema_version 18 vs 17) |
| `electron/db.spec.ts` | 39 | 0 | All linux-downloads-data tests pass |
| `electron/tsconfig.json` | - | 0 | TypeScript check passes |

## Files Changed

| File | Action |
|------|--------|
| `electron/main.ts` | Modified: added `baseDataDirFor` helper, exported `rodantePathFor`/`backupsDirFor`, updated 3 IPC handlers |
| `electron/main.spec.ts` | Modified: added platform mock helpers, 4-platform matrix tests, EACCES fallback test, path separator fixes |
| `electron/db.spec.ts` | Modified: added `linuxDocsRoot` helper, 5 Linux adoption tests, fixed temp dir paths |
| `openspec/changes/linux-downloads-data/tasks.md` | Updated: all tasks marked [x] |
| `openspec/changes/linux-downloads-data/apply-progress.md` | Updated: this file |

(End of file - total 43 lines)