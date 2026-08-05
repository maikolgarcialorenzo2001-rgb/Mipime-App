# Verification Report — web-export-refactor

Mode: STRICT TDD (openspec file). Change: `web-export-refactor` (Mipime-App / mipime-cuentas).
Verdict: **PASS (COMPLETE & ACCEPT)** — no BLOCKERs. 0 CRITICAL, 0 WARNING, 2 SUGGESTION (informational only).

Independent second-pass review (re-verify after implementation). Implementation judged solely from
artifacts + code now on disk + real test execution. This report **supersedes the first-pass FAIL**
(`verify-report.md`, written before any commit existed on the branch). The verification-target
mismatch that drove the first FAIL is resolved: branch `refactor/web-export-refactor` now carries the
two work-unit commits implementing exactly this folder's B5/B6 artifacts.

## Evidence vs Requirements

| # | Requirement | Result |
|---|---|---|
| 1 | excel-reportes A1: web backup export revoke deferred past click (backup.service.ts) | ✅ PASS |
| 2 | excel-reportes A2: Excel blob-fallback revoke deferred past click (electron-file.service.ts) | ✅ PASS |
| 3 | excel-reportes constraints: both sites identical `setTimeout(..., 0)` deferral | ✅ PASS |
| 4 | db-backup B1: web export filename byte-identical to desktop via ONE shared `exportName(d)` | ✅ PASS |
| 5 | db-backup B2: zero-padded single-digit fields via shared helper | ✅ PASS |
| 6 | db-backup C: `exportName(d)` helper unit tested under the electron runner | ✅ PASS |
| 7 | db-backup constraints: format unchanged, `db.ts:timestampedBackupName` untouched, `rootDir:"."` unchanged | ✅ PASS |
| 8 | Task 1 (B5): RED fake-timer tests first, then defer revoke at both sites | ✅ COMPLETE (commit `49b5889`) |
| 9 | Task 2 (B6): RED helper spec → `electron/export-name.ts` → wire main.ts + backup.service.ts → build probe (A wins) | ✅ COMPLETE (commit `5f78cc8`) |
| 10 | Task 3: full suites green with this change applied | ✅ COMPLETE (verified this session) |
| 11 | Strict TDD: RED/GREEN evidence in apply-report, tests written for every behavior | ✅ PASS |

**Spec-compliance summary: 6/6 requirements, 5/5 spec scenarios compliant.**
**Task completion: 3/3 complete.**

## Test Evidence (executed fresh this session)

- `npm run test -- --watch=false` → **43 files, 701 tests passed** (0 failed) — matches apply total
- `npm run test:electron` → **5 files, 143 tests passed** (0 failed) — matches apply total; the 5th
  file is the new `electron/export-name.spec.ts`, proving the helper spec runs under the electron runner
- `ng build --configuration=production` → **GREEN** (bundle generation complete; sole output is the
  pre-existing initial-bundle budget WARNING 697.68 kB vs 500 kB warning budget, under the 1 MB error
  budget — unrelated to this change; cross-dir import compiles and bundles)
- `npx eslint` on changed files → only 2 errors, both pre-existing (see Issues); new/modified files
  other than those two lines are clean (exit 0)

Commands executed exactly as above. Totals ≥ first-pass baseline (web 699/43, electron 141/4) and =
apply-phase totals (web 701/43, electron 143/5) — no regressions, +2 web tests, +2 electron tests,
+1 electron test file.

## Per-requirement detail

1. **A1 — PASS.** `backup.service.ts:65` wraps the revoke: `setTimeout(() => URL.revokeObjectURL(url), 0);`
   with a BACKLOG-5 comment (L63-64). No synchronous revoke remains in the web export branch (L52-70).
   Covering test `backup.service.spec.ts:143-159`: `vi.useFakeTimers()` (L143); after the awaited
   `exportarRespaldo()` (which calls `a.click()` via `clickSpy`, L150) asserts
   `expect(revokeObjectUrlMock).not.toHaveBeenCalled()` (L152); `vi.advanceTimersByTime(0)` (L155) →
   `expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1)` (L156); `vi.useRealTimers()` (L158).
   The old sync assertion `expect(revokeObjectUrlMock).toHaveBeenCalled()` was flipped to the
   deferred expectation (diff L146-152).
2. **A2 — PASS.** `electron-file.service.ts:97` (`_blobFallback`): `setTimeout(() => URL.revokeObjectURL(url), 0);`
   with BACKLOG-5 comment (L95-96). Covering test `electron-file.service.spec.ts:75-89`: fake timers
   (L75); after `saveIndividual(...)` asserts `expect(revokeURL).not.toHaveBeenCalled()` (L83);
   `vi.advanceTimersByTime(0)` (L85) → `toHaveBeenCalledTimes(1)` (L86) + `toHaveBeenCalledWith('blob:url')`
   (L87); `vi.useRealTimers()` (L89).
3. **Constraints — PASS.** Both sites use the identical shape `setTimeout(() => URL.revokeObjectURL(url), 0)`
   (backup.service.ts:65, electron-file.service.ts:97) — the only two `URL.revokeObjectURL` matches in
   `src/` (grep-verified). Deferral is `setTimeout(..., 0)` at both, per constraint.
4. **B1 — PASS.** Single source: `electron/export-name.ts` (new pure module, zero imports) is imported by
   `electron/main.ts:24` (`./export-name`, used at main.ts:414 `exportName(new Date())`) AND by
   `backup.service.ts:3` (`../../../electron/export-name`, used at L59 `a.download = exportName(new Date())`).
   Both call sites call the SAME function → byte-identical by construction. Private `_webExportName`
   deleted (diff removes L69-74; grep for `_webExportName` in `src/` → 0 matches). No
   `export-name.const.ts` fallback exists (Candidate A won the probe; apply-report L37-41). Covering
   tests: `backup.service.spec.ts:175-180` (imports the same module, asserts
   `tienda_export_20260802_1405.db`) + `electron/export-name.spec.ts:5-9`.
5. **B2 — PASS.** `electron/export-name.ts:3` `p = (n) => String(n).padStart(2, '0')` zero-pads
   month/day/hour/minute. Covering tests assert the single-digit case:
   `electron/export-name.spec.ts:11-15` and `backup.service.spec.ts:182-186` → both
   `tienda_export_20260105_0903.db` for `new Date(2026, 0, 5, 9, 3)`.
6. **C — PASS.** `electron/export-name.spec.ts` exists under `electron/` (node-free helper, no imports
   beyond vitest). Electron runner executed **5 files** this session (was 4 in first pass), proving the
   spec is picked up; both concrete-Date outputs asserted (L6-8, L12-14). Web runner never sees it
   (`src/**` scope only).
7. **Constraints — PASS.** (a) Format `tienda_export_YYYYMMDD_HHmm.db` byte-identical to both prior
   sites (template string unchanged across the diff — old `main.ts` local fn and old `_webExportName`
   had the exact same interpolation). (b) `electron/db.ts` not in the change diff
   (`git diff d4e15f2..5f78cc8 --name-only` → no `db.ts`). (c) `electron/tsconfig.json` unchanged; the
   helper stays inside `electron/`.
8. **Task 1 — COMPLETE.** Commit `49b5889` `fix(web): defer URL.revokeObjectURL after download click`
   (4 files, +23/−3). RED fake-timer tests written first (apply-report L18-21 documents the failing
   state "expected not called, but was called once"), then the `setTimeout` wraps at both sites.
   GREEN confirmed by this session's full web suite (701/43).
9. **Task 2 — COMPLETE.** Commit `5f78cc8`
   `refactor(web): single-source export filename via electron/export-name` (5 files, +41/−16).
   RED helper spec (apply-report L33: "module not found"), pure helper created, `main.ts` local fn
   deleted (+1 import/−8 lines, verified via diff), build probe executed with **Candidate A GREEN**
   (apply-report L37-41), `_webExportName` deleted, web spec switched to the shared import.
10. **Task 3 — COMPLETE.** Full suites run this session: web 701/43 ✅, electron 143/5 ✅, fresh
    `ng build --configuration=production` ✅ GREEN. Totals meet/exceed apply numbers; no regression
    (baseline first-pass was 699/43 + 141/4).
11. **Strict TDD — PASS.** apply-report.md contains a full TDD Cycle Evidence table (L51-58) with RED
    (written + failing state), GREEN (passed), TRIANGULATE (2 cases per behavior), SAFETY NET
    (✅ 699/43 and 141/4 for modified spec files; N/A-new for `electron/export-name.spec.ts`).
    All four test sites verified to exist and to assert the required behavior (see 1, 2, 4, 5).

## TDD Compliance (Strict TDD mode)

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `apply-report.md` L51-58 "TDD Cycle Evidence" table present with RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR columns |
| All tasks have tests | ✅ | 2/2 implementation tasks have test files (B5: both service specs; B6: `electron/export-name.spec.ts` + web single-source describe) |
| RED confirmed (tests exist) | ✅ | 4/4 test sites verified on disk: `backup.service.spec.ts:143-159`, `electron-file.service.spec.ts:75-89`, `electron/export-name.spec.ts`, `backup.service.spec.ts:175-186` |
| GREEN confirmed (tests pass) | ✅ | 701/43 web + 143/5 electron pass on execution this session; all four sites inside the green suites |
| Triangulation adequate | ✅ | 4/4 behaviors triangulated: B5 web (not-called → called-once), B5 electron (+`calledWith('blob:url')`), B6 helper (padded + zero-pad), B6 web (byte-identical + zero-pad) |
| Safety Net for modified files | ✅ | 2/2 modified spec files (backup.service.spec.ts, electron-file.service.spec.ts) had prior suites (699/43, 141/4 baseline); 2 new files correctly "N/A (new)" |

**TDD Compliance: 6/6 checks passed.**

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 844 (701 web + 143 electron) | 48 (43 web + 5 electron) | vitest (Angular builder + electron config) |
| Integration | 0 | 0 | — |
| E2E | 0 | 0 | — |
| **Total** | **844** | **48** | |

All change-adjacent tests are unit tests (no render/no page/no HTTP) — consistent with the project's
existing layers and with the change being a pure refactor + robustness fix. No tools-not-in-capabilities
concern (vitest is the project runner for both suites).

## Changed File Coverage

**Coverage analysis skipped** — no coverage tool configured/run in this session (informational only per
strict-TDD rules; not a failure). Change diff = 7 files, +64/−19 lines (well under the 400-line budget).

## Assertion Quality (audit of tests created/modified by this change)

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `backup.service.spec.ts` | 152/156 | `not.toHaveBeenCalled()` then `toHaveBeenCalledTimes(1)` after `advanceTimersByTime(0)` | None — asserts the deferred-revoke behavior both sides of the timer flip; real behavioral assertions | — |
| `electron-file.service.spec.ts` | 83/86/87 | `not.toHaveBeenCalled()` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith('blob:url')` | None — value assertion on the exact URL; real behavior | — |
| `electron/export-name.spec.ts` | 6-8, 12-14 | `toBe('tienda_export_20260802_1405.db')` / `toBe('tienda_export_20260105_0903.db')` | None — exact-value assertions on concrete Date inputs | — |
| `backup.service.spec.ts` | 177-179, 183-185 | `toBe('tienda_export_...')` via the shared import | None — proves web derives the name from the same single source | — |

No tautologies, no ghost loops, no type-only-only assertions, no smoke tests, no empty-collection
checks. Mock/assertion ratio per file well under 2×. Fake-timer setup is correctly ordered
(`useFakeTimers` before the action, `useRealTimers` after the advance), and `await` on mocked promises
is unaffected by fake timers, so the RED-side assertion genuinely exercises the code path.

**Assertion quality**: ✅ 0 CRITICAL, 0 WARNING — all assertions verify real behavior.

## Quality Metrics

**Linter**: ⚠️ 2 pre-existing errors in touched files (see Issues) — both verified present at base
commit `d4e15f2` and untouched by this change's diff; all other changed files (including the new
`electron/export-name.ts` and its spec) lint clean (exit 0). `npm run lint` full run still shows the
~110 pre-existing `src/**` errors, none attributable to this change.
**Type Checker**: ✅ `ng build --configuration=production` type-checks and bundles cleanly — this is the
authoritative gate per design D3 (vitest runs with `disableTypeChecking: true`). `electron/main.ts`
compiles under the electron tsconfig (`npm run electron:ts` per apply-report).
**Build probe (ng build production)**: ✅ GREEN, re-run this session.

## Issues Found

**CRITICAL**: none.

**WARNING**: none — the two lint errors below are pre-existing and outside this change's edit set.

**SUGGESTION** (informational, no action required for this change):
1. `electron-file.service.ts:1` triple-slash reference (`@typescript-eslint/triple-slash-reference`) —
   pre-existing at base; predates this change (verified: line 1 of `d4e15f2` is identical).
2. `electron-file.service.spec.ts:147` unused `createElement` in the `downloadBlob` test —
   pre-existing at base (`d4e15f2:138`, shifted +9 lines by this change's fake-timer block); the
   `downloadBlob` test was not modified by this change. Could be cleaned up opportunistically in a
   future change.
3. First-pass FAIL resolved: the branch now implements this folder's own B5/B6 artifacts (commits
   `49b5889`, `5f78cc8`); the T8/T12/M1 attribution confusion noted in the first report was a
   pre-implementation state, now moot.

## Next recommended action

**Open the single PR** (2 commits: `49b5889`, `5f78cc8`; combined diff +64/−19 lines, well under the
400-line budget; work-unit structure per plan). Then archive. No further implementation work needed.
Only `verify-report.md` was written by this verification pass; no implementation code was modified.
