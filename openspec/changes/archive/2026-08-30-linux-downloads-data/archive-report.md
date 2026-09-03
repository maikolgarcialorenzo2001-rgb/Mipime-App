# Archive Report: linux-downloads-data

**Change**: linux-downloads-data
**Archived**: 2026-08-30
**Mode**: openspec
**Status**: Complete

## Specs Synced (Delta → Main Specs)

### db-backup
- **ADDED**: Platform-aware backup base directory requirement (Crostini/Linux desktop/Windows-macOS path resolution)
- **MODIFIED**: Automatic rodante backup — now uses `{baseDataDir}/Tienda - App/DataBase/tienda-app.db` instead of hardcoded `Documents\Tienda - App\DataBase\tienda-app.db`
- **MODIFIED**: Timestamped backup at jornada close — now uses `{baseDataDir}/Tienda - App/DataBase/backups/`
- **MODIFIED**: ADOPT valid backup on fresh install — now specifies platform-aware base directory for Linux
- **Preserved**: Retention and auto-prune (30), Automatic and non-fatal backups, Manual export (desktop)

### excel-reportes
- **ADDED**: Platform-aware export default path requirement (`db:export` dialog and `file:saveFile` defaultPath per platform)

## Archive Contents

- `proposal.md` ✅ — Change intent, scope, approach, rollback plan
- `design.md` ✅ — Technical approach, architecture decisions, data flow
- `exploration.md` ✅ — Initial exploration notes (palmar cleanup context)
- `tasks.md` ✅ — All 17 tasks completed; zero stale unchecked items
- `apply-progress.md` ✅ — Apply progress history and final status
- `specs/db-backup/spec.md` ✅ — Synced with delta requirements
- `specs/excel-reportes/spec.md` ✅ — Synced with delta requirements
- `archive-report.md` ✅ — This file

## Source of Truth Updated

- `openspec/specs/db-backup/spec.md` — Updated with platform-aware backup base directory
- `openspec/specs/excel-reportes/spec.md` — Updated with platform-aware export default path

## SDD Cycle Summary

The change was fully planned (proposal), designed (design), specified (delta specs), implemented (electron/main.ts with `baseDataDirFor` helper and path helpers), verified (tests: 88+39 pass with 1 pre-existing schema_version warning), and archived.

**All implementation tasks completed**: `baseDataDirFor`, `rodantePathFor`, `backupsDirFor` exported; `file:saveFile` (Tienda IPVE) + `db:export` + `db:initialize` using new base; EACCES fallback in `file:saveFile`; `db.ts` INTACTO; DB live in userData without changes.

**Test results**: `electron/main.spec.ts` 88 pass / 1 pre-existing fail (schema_version 17 vs 18 — non-blocking, existed before this change); `electron/db.spec.ts` 39 pass; `bun run electron:ts` OK.

**Zero palmar references**: Confirmed via grep — `savePalmar`, `palmarDirFor`, and `Palmar` folder do not exist; scope is main only. Archive preserves original exploration notes as historical context.

## Notes

- The original exploration (`exploration.md`) documented the palmar-feature mistaken apply, which was discarded. Main change scope is Linux-downloads-data only.
- Archive is an audit trail — change folder moved, not deleted. Original artifacts preserved at `openspec/changes/archive/2026-08-30-linux-downloads-data/`.
- One pre-existing verification warning: test `schema_version 17 vs 18` — present in main branch commit `0678f6f`, not introduced by this change.