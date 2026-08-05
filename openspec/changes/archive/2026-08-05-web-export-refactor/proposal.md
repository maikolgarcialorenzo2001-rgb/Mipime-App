# Proposal: web-export-refactor

## Intent

Resolve two web-export backlogs as ONE cohesive change (single PR, two work-unit commits):
- **BACKLOG-5**: `URL.revokeObjectURL(url)` runs synchronously right after `a.click()` — fragile in old Safari.
- **BACKLOG-6**: the `tienda_export_YYYYMMDD_HHmm.db` filename is byte-identical at two sites (desktop + web) — single-source it.

## Scope

### In Scope
- B5: defer `revokeObjectURL` past the click via `setTimeout(..., 0)` at BOTH blob sites.
- B6: extract a single pure `exportName(d)` helper; consume it from both desktop and web.
- TDD: RED specs first (backup.service.spec, electron-file.service.spec, new helper spec).

### Out of Scope
- `electron/db.ts:timestampedBackupName` (`tienda_YYYY-MM-DD_HHmm.db` auto-backup) — untouched, not conflated.
- Electron `tsconfig.json` `rootDir: "."` — unchanged (widening breaks electron-builder emit).
- No filename-format change (`tienda_export_...` preserved exactly).

## Capabilities

- **New**: None — pure refactor + robustness fix, no new user-facing behavior.
- **Modified**:
  - `db-backup` (manual export): revoke deferred after click in `backup.service.ts`.
  - `excel-reportes` (blob fallback download): revoke deferred in `electron-file.service.ts`.
  - Single-source export name (new `electron/export-name.ts`), behavior identical.

## Approach

### B5 — deferred revoke
In `backup.service.ts` `exportarRespaldo()` (web branch, L60) and `electron-file.service.ts` `_blobFallback()` (L95), wrap `URL.revokeObjectURL(url)` in `setTimeout(() => URL.revokeObjectURL(url), 0)`. RED (fake timers): assert revoke NOT called synchronously after `click()`; download proceeds; after `jest.advanceTimersByTime(0)` revoke fires.

### B6 — single exportName helper
New pure helper `electron/export-name.ts` (no framework, no node imports):
```ts
export function exportName(d: Date): string {
  // returns `tienda_export_YYYYMMDD_HHmm.db` (zero-padded)
}
```
- `electron/main.ts` imports `./export-name` (stays in electron rootDir).
- Web `backup.service.ts` imports `../../../electron/export-name`; replaces private `_webExportName(d)` + its regex const.
- Helper spec lives under `electron/**/*.spec.ts` → runs via electron runner (web runner only picks `src/**`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/backup.service.ts` | Modified | Deferred revoke (L60); use shared `exportName` (remove `_webExportName` L67-72) |
| `src/app/services/electron-file.service.ts` | Modified | Deferred revoke in `_blobFallback` (L95) |
| `electron/export-name.ts` | New | Pure shared filename helper |
| `electron/main.ts` | Modified | `exportName` → `./export-name` (L55-61) |
| `src/app/services/backup.service.spec.ts` | Modified | RED deferred-revoke test (L119-152) |
| `src/app/services/electron-file.service.spec.ts` | Modified | RED deferred-revoke test (L65-81) |
| `electron/export-name.spec.ts` | New | Unit tests (electron runner) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Web→electron cross-src import breaks Angular/Vite/`@analogjs`/angular-eslint build | Med | Validate `bun test` web + `ng build`; keep helper node-free; fallback = duplicate const w/ shared comment (decision point for apply) |
| New helper not covered by eslint rule set | Med | Add `electron/export-name.ts` to applicable eslint config / lint gate |
| Electron rootDir forced structure | Low | Helper stays inside `electron/`; no tsconfig change |

## Rollback Plan

Revert single PR commit pair: un-defer the two revoke lines (restore sync `URL.revokeObjectURL`), restore `_webExportName`/`exportName` inline consts, delete `electron/export-name.ts`. No schema or format changes — clean revert.

## Dependencies

- None external. Requires `bun test` (web + electron) green.

## Success Criteria

- [ ] B5: both blob sites defer revoke; fake-timer spec proves no synchronous revoke + click proceeds.
- [ ] B6: single `exportName` used by desktop + web; byte-identical output to today.
- [ ] Web + electron suites green (web 697/43, electron 141/4 maintained).
- [ ] Web build succeeds with cross-src import (or decision point resolved).
- [ ] Two work-unit commits; single PR under 400 lines.