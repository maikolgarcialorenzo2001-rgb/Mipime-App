# Apply Report: web-export-refactor

**Branch**: `refactor/web-export-refactor` (base `main` tip `d4e15f2`)
**Mode**: Strict TDD (web runner `@angular/build:unit-test` via `npm run test -- --watch=false`; electron runner `vitest run --config vitest.electron.config.ts`; targeted TDD loop via `bunx vitest run` per file)
**Commits**: 2 (both work units, single PR scope)

| Commit | Hash | Message |
|--------|------|---------|
| Work unit 1 (B5) | `49b5889` | `fix(web): defer URL.revokeObjectURL after download click` |
| Work unit 2 (B6) | `5f78cc8` | `refactor(web): single-source export filename via electron/export-name` |

Working tree after both commits: only untracked `openspec/changes/web-export-refactor/` (change artifacts, intentionally not part of the two commits).

---

## Work unit 1 — B5: deferred revoke (DONE)

**RED**: added fake-timer tests at both blob sites, run against the still-synchronous implementation:
- `src/app/services/backup.service.spec.ts` — web download test now does `vi.useFakeTimers()`; asserts `revokeObjectUrlMock` NOT called synchronously after `click()`; `vi.advanceTimersByTime(0)` → called exactly once; `vi.useRealTimers()` at end. Old synchronous assertion (`toHaveBeenCalled()`) converted per tasks plan.
- `src/app/services/electron-file.service.spec.ts` — same shape in the `saveIndividual` Blob-fallback test: revoke NOT called after save; `advanceTimersByTime(0)` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith('blob:url')`.
- RED confirmed: both targeted files failed with "expected not called, but was called once" (revoke was still synchronous).

**GREEN**: `URL.revokeObjectURL(url)` wrapped in `setTimeout(() => URL.revokeObjectURL(url), 0)` at both production sites (`backup.service.ts` web branch, `electron-file.service.ts` `_blobFallback`), with a BACKLOG-5 comment.

**Verify**: full web suite 699/43, electron 141/4 — all green (unchanged totals).

**Files**: `src/app/services/backup.service.ts`, `src/app/services/backup.service.spec.ts`, `src/app/services/electron-file.service.ts`, `src/app/services/electron-file.service.spec.ts` (4 modified).

---

## Work unit 2 — B6: single-source export filename (DONE)

**RED**: new `electron/export-name.spec.ts` (electron runner) asserting `exportName(new Date(2026,7,2,14,5))` → `tienda_export_20260802_1405.db` and `exportName(new Date(2026,0,5,9,3))` → `tienda_export_20260105_0903.db`. RED confirmed: module not found (`./export-name` did not exist).

**GREEN**: created pure `electron/export-name.ts` (zero-padded, node-free, byte-identical to both prior sites). Wired `electron/main.ts`: deleted local `exportName` (L55-61), added `import { exportName } from './export-name'`. `npm run electron:ts` compiles clean.

### BUILD PROBE — A/B decision: **A WINS (GREEN)**

- **Candidate A** (real cross-dir import): `src/app/services/backup.service.ts` → `import { exportName } from '../../../electron/export-name'`; call-site switched to `exportName(new Date())`; private `_webExportName` deleted.
- **Probe result**: `ng build --configuration=production` **GREEN** (bundle generation complete; only a pre-existing budget WARNING — initial 697.68 kB vs 500 kB warning budget, under the 1 MB error budget; unrelated to this change).
- **Decision**: keep Candidate A. No `src/app/services/export-name.const.ts` fallback created (fallback was default-per-design only if probe RED).

**Web spec**: `backup.service.spec.ts` now imports the same shared helper and adds a `describe` asserting byte-identical output + zero-padding (proves web derives the name from the single source).

**Verify (final state)**: web **701/43**, electron **143/5**, fresh `ng build --configuration=production` GREEN.

**Files**: created `electron/export-name.ts`, `electron/export-name.spec.ts`; modified `electron/main.ts`, `src/app/services/backup.service.ts`, `src/app/services/backup.service.spec.ts` (5 files).

---

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| B5 web revoke | `src/app/services/backup.service.spec.ts` | Unit | ✅ 699/43 | ✅ Written (fail: sync call recorded) | ✅ Passed | ✅ 2 cases (before/after advance) | ✅ Clean (comment) |
| B5 electron revoke | `src/app/services/electron-file.service.spec.ts` | Unit | ✅ 141/4 | ✅ Written (fail: sync call recorded) | ✅ Passed | ✅ 2 cases + `calledWith('blob:url')` | ✅ Clean (comment) |
| B6 helper | `electron/export-name.spec.ts` | Unit (electron runner) | N/A (new) | ✅ Written (module not found) | ✅ Passed | ✅ 2 spec scenarios (padded + zero-pad) | ➖ None needed (pure fn) |
| B6 web single-source | `src/app/services/backup.service.spec.ts` | Unit | ✅ 699/43 | ✅ Written (after helper exists) | ✅ Passed | ✅ 2 spec scenarios | ✅ Clean (removed `_webExportName`) |

### Test Summary
- **Total tests written**: +4 (2 B5 conversions count as rewritten in place; +2 electron helper, +2 web single-source describe)
- **Total tests passing**: web 701 (was 699), electron 143 (was 141)
- **Layers used**: Unit only
- **Approval tests**: B5 — existing sync-revoke tests converted to deferred-revoke expectations (behavior change per spec); B6 — helper byte-identical output proven by both electron + web specs
- **Pure functions created**: 1 (`exportName` in `electron/export-name.ts`)

---

## Deviations from tasks.md / notes

1. **Test totals**: tasks.md expected web `697/43`; actual baseline is **699/43** (validated in-session). After the change: web **701/43** (+2), electron **143/5** (+1 file, +2 tests) vs expected 141/4. Adapted to reality.
2. **Runner**: tasks.md references `bunx vitest run --config vitest.config.ts` for web verify; full-suite runs used the orchestrator-validated `npm run test -- --watch=false` (@angular/build:unit-test). Targeted TDD loop used `bunx vitest run <file>` per strict-tdd guidance.
3. **Line numbers**: tasks.md cited `backup.service.ts:56/60/67-72`; actual were `:58/:62/:69-74`. `electron/main.ts` L55-61 matched exactly.
4. **Probe default**: design defaulted to Candidate B ("DEFAULT = B to never leave a broken intermediate state"); probe executed FIRST, returned GREEN → upgraded to Candidate A per plan. No broken intermediate state existed (probe ran before final commit).
5. **Pre-existing lint errors in touched files** (NOT introduced by this change, left untouched per rules): `electron-file.service.ts:1` triple-slash reference (`@typescript-eslint/triple-slash-reference`); `electron-file.service.spec.ts:147` unused `createElement` in the `downloadBlob` test. Both predate this change (verified in diff). New `electron/*.ts` files are outside `ng lint` scope (`lintFilePatterns: src/**`) — matches existing convention (design D6).
6. **Build warning**: production build emits a pre-existing initial-bundle budget WARNING (697.68 kB > 500 kB warning budget; under 1 MB error budget). Not caused by this change; build exits 0.
7. Minor process note: during main.ts wiring a local edit slipped (function got duplicated before removal); final committed diff is exactly +1 import / −1 local function (verified via `git show 5f78cc8 -- electron/main.ts`).

## Rollback

Per proposal: revert the two commits (`git revert 5f78cc8 49b5889` or reset) — restores sync revoke + inline `_webExportName`, deletes `electron/export-name.*`. No schema/format changes.
