# Tasks: web-export-refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR (2 work-unit commits) |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | B5 deferred revoke (both blob sites) | same PR, commit 1 | independent, no build gate |
| 2 | B6 single-source export name | same PR, commit 2 | build-gated (probe) |

---

## Task 1 — B5: Defer URL.revokeObjectURL past the click (do FIRST)

**Files**: `src/app/services/backup.service.ts`, `src/app/services/electron-file.service.ts`, `src/app/services/backup.service.spec.ts`, `src/app/services/electron-file.service.spec.ts`

**RED (fake timers, write first)**:
- `backup.service.spec.ts` (L126-148): add `vi.useFakeTimers()`; assert `revokeObjectUrlMock` NOT called synchronously right after `click()`; then `vi.advanceTimersByTime(0)` → `expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1)`; restore `vi.useRealTimers()`.
- `electron-file.service.spec.ts` (L65-81): same shape — `vi.useFakeTimers()`; after `service.saveIndividual(...)` assert `revokeURL` NOT called; `vi.advanceTimersByTime(0)` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith('blob:url')`.

**Implement (GREEN)**: replace sync calls `backup.service.ts:60` and `electron-file.service.ts:95` with `setTimeout(() => URL.revokeObjectURL(url), 0);`.

**Verify**: `bunx vitest run --config vitest.config.ts` (web GREEN).

**Rollback**: revert the two wrapped lines to sync revoke.

**Commit**: `fix(web): defer URL.revokeObjectURL after download click`

---

## Task 2 — B6: single-source export filename via electron/export-name (build-gated)

**Files create**: `electron/export-name.ts`, `electron/export-name.spec.ts`, plus fallback `src/app/services/export-name.const.ts` (only if probe RED).
**Files modify**: `electron/main.ts`, `src/app/services/backup.service.ts`, `src/app/services/backup.service.spec.ts`.

**RED**: new `electron/export-name.spec.ts` (electron runner) — `exportName(new Date(2026,7,2,14,5))` → `tienda_export_20260802_1405.db`; `exportName(new Date(2026,0,5,9,3))` → `tienda_export_20260105_0903.db` (zero-pad single digits); exact format assertions.

**Green/create**: pure `electron/export-name.ts` (`exportName(d: Date)`, zero-pad, byte-identical to spec'd format, no node/framework imports). Wire `electron/main.ts` L56-61: delete local `exportName`, `import { exportName } from './export-name'` (stays in electron rootDir).

**BUILD PROBE (record A/B in apply report; DEFAULT = B** to never leave a broken intermediate state, upgrade to A only if probe passes**)**:
- Switch `backup.service.ts` L56 `a.download = exportName(new Date())` to the candidate import.
- Candidate A: real import `../../../electron/export-name`; delete `_webExportName` (L67-72). Run BUILD probe `ng build --configuration=production`. GREEN → keep A.
- Candidate B (fallback, DEFAULT until A proven): create `src/app/services/export-name.const.ts` exporting the SAME const/format, header comment `// SINGLE-SOURCE owner: electron/export-name.ts — keep byte-identical` + residual-drift note; import it into `backup.service.ts`; delete `_webExportName`; update web spec to assert the imported const produces the same format.

**Verify**: `bun run test:electron` AND `bunx vitest run --config vitest.config.ts` AND fresh `ng build` — all GREEN (electron 141/4, web 697/43 maintained; `no-explicit-any` holds).

**Rollback**: restore `_webExportName`/inline const; delete helper + fallback const.

**Commit**: `refactor(web): single-source export filename via electron/export-name`

---

## Task 3 — VERIFY (final, no code)

**Run FULL**: `bun run test:electron` + `bunx vitest run --config vitest.config.ts` + fresh `ng build`. All GREEN. Confirm totals (web 697/43, electron 141/4).

**Files total changed**: 7 (4 modified + 2 created + 1 created-if-B). **PR diff**: ~14–260 lines. **Verdict**: single PR, well under 400.