# Tasks: Desktop Resilience Backlogs

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~230–300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-commit-chain → 1 PR |

## Context

Three independent backlogs over `electron/db.ts`, `electron/main.ts`, `package.json`. Strict TDD (RED→GREEN). Parser widening DECIDED (approved). Electron tests invoken via `bun run test:electron` (`vitest run --config vitest.electron.config.ts`). Web suite: `bun run test`.

## Phase 1: BACKLOG-4 — postinstall (config-only, independent)

- [x] 1.1 `package.json`: add `"postinstall": "electron-builder install-app-deps",` after `electron:rebuild` (line 11). Keep `electron:rebuild` + build scripts unchanged.
  - RED: none (config-only). Add no unit test.
  - GREEN: `bun install --frozen-lockfile` succeeds; electron-builder CLI resolves; `postinstall` fires `install-app-deps`.
  - Rollback: remove the single script line (git revert of this commit).
  - Commit: `chore(build): add postinstall electron-builder install-app-deps` — DONE `b8005e5`

## Order 2: BACKLOG-3 — stage threading

- [x] 2.1 `electron/db.ts`: module `let currentStage: DbDiagnostics['stage'] = 'open'` + `export getStartupStage()`. Set `currentStage='recover'` in `runStartupSequence` once cascade advances past open (before `recoverInPlace`). Replace hardcoded `stage:'open'` at `db.ts:409` with `stage: getStartupStage()`.
- [x] 2.2 `electron/main.ts`: replace hardcoded `stage:'open'` at `main.ts:251` (db:initialize catch) with `stage: getStartupStage()`; import it.
- [x] 2.3 RED: flip `db.spec.ts:457` `expect(result.diagnostics?.stage).toBe('open')` → `'recover'` (fatal-all-fail after open fails).
- [x] 2.4 RED: flip `main.spec.ts~362` M1 canned `stage` to read-through — mock `getStartupStage` → `'recover'`; asserts reported stage equals mocked value (proves non-hardcoded).
- [x] 2.5 GREEN: implement 2.1–2.2; electron suite all pass (141).
- [x] Verification: `bun run test:electron` pass.
- [x] Rollback: git revert this commit.
- Commit: `fix(db): fatal diagnostic reports real cascade stage` — DONE `70d4532`

## Order 3: BACKLOG-2 — collision-safe allocator + parser widening

- [x] 3.1 `electron/db.ts`: add `export function timestampedSnapshotPath(backupsDir: string, d: Date): string` mirroring `corruptTargetFor` — base `path.join(backupsDir, timestampedBackupName(d))`, `n=1`, while-suffix `-<n>` BEFORE `.db`.
- [x] 3.2 Widen `TIMESTAMPED_RE` (`db.ts:19`) + `whenFromName` (`db.ts:197`) with optional `(?:-\d+)?` suffix group (approved).
- [x] 3.3 `electron/main.ts`: `db:backupNow` jornada-close snapshot uses `timestampedSnapshotPath(backupsDirFor(), new Date())`, return that resolved path as `timestampedPath`; dropped `timestampedBackupName` import.
- [x] 3.4 RED new: `db.spec.ts` — fresh minute → base; 2nd same-minute → `-1`; 3rd → `-2`; suffixed `-1.db` matched by `TIMESTAMPED_RE`+parsed by `whenFromName`; suffixed snapshot prunable by `pruneBackups`.
- [x] 3.5 RED: collision-suffix case restore-from-suffixed snapshot (`db.spec.ts`).
- [x] 3.6 RED: `main.spec.ts` jornada-close returns suffixed timestampedPath when base exists.
- [x] 3.7 GREEN: implement 3.1–3.3; electron suite green (141).
- [x] Rollback: revert this commit.
- Commit: `fix(backup): collision-safe snapshot names with prunable suffix` — DONE `118b224`

## VERIFICATION task (final)

- [x] VERIFY: `bun run test:electron` (141 ✓) and web Vitest `bunx vitest run --config vitest.config.ts` (695 ✓) all GREEN; `bun run electron:ts` typecheck clean; lint clean for changed files (pre-existing src/** lint errors out of scope).

## Totals

- Changed files: 5 (`electron/db.ts`, `electron/main.ts`, `electron/db.spec.ts`, `electron/main.spec.ts`, `package.json`).
- Estimated diff: ~230–280 lines (< 400). Single PR. No chained PRs.