# Proposal: Desktop Resilience Backlogs

## Intent

Resolve three independent desktop-resilience backlogs in ONE cohesive change (single PR, strict TDD):

1. **BACKLOG-2 — HHmm snapshot collision**: two snapshots in the same minute produce the same `tienda_YYYY-MM-DD_HHmm.db` path → second `db.backup()` silently overwrites the first → a point-in-time backup is lost.
2. **BACKLOG-2 — recovery cascade fatal always reports 'open'**: fatal returns hardcode `stage:'open'`, masking the real failing stage of the recovery cascade.
3. **BACKLOG-3 — missing postinstall** for native module rebuild on install.

## Scope

### In Scope
- Collision-safe snapshot path: `electron/db.ts` (`timestampedBackupName` wraps in a collision-avoiding variant mirroring `corruptTargetFor`) + `electron/main.ts` (`db:backupNow` / `jornada-close`).
- Thread a `stage` state variable through the recovery cascade (`electron/db.ts`, `electron/main.ts`) so fatal reports the actual failing stage; remove both hardcoded `'open'`.
- Add `"postinstall": "electron-builder install-app-deps"` to `package.json` scripts.
- RED/GREEN tests in `electron/db.spec.ts` & `electron/main.spec.ts`.

### Out of Scope
- Changing the cacheable `YYYY-MM-DD_HHmm` base format or `TIMESTAMPED_RE`/`whenFromName` parsing.
- Fatal stage/status schema change beyond what the union already allows (widening only if tests require).
- Replacing dedicated `electron:rebuild` (kept for manual precision).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `db-backup`: snapshot write must be collision-safe (same-minute → `..._HHmm-<n>.db`); postinstall native-deps rebuild for the desktop build.
- `db-recovery`: fatal `stage` must reflect the actual failing cascade stage, not a hardcoded `'open'`.

## Approach

- **Backup collision**: mirror existing `corruptTargetFor()` pattern — allocate the timestamped base path, then while `fs.existsSync(target)` append `-<n>`; keep base parseable.
- **Stage threading**: introduce an in-scope `stage` variable in `runStartupSequence`/`db:initialize` that mutates as each phase advances; fatal paths report the current value (replace both hardcoded `'open'`).
- **Postinstall**: add single `package.json` script line; verify electron-builder `^26.15.3` already in devDeps. Note: with bun, runs on every `bun install` (accepted tradeoff).
- Strict TDD: write failing test first, flip to RED, implement, GREEN.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `electron/db.ts` | Modified | Collision-safe snapshot allocator; threaded `stage` in cascade |
| `electron/main.ts` | Modified | `db:backupNow`/`jornada-close` uses allocator; real fatal `stage` |
| `electron/types.d.ts` | Optional | Union widen only if tests reveal need |
| `electron/db.spec.ts` | Modified/New | Tests for snapshot collISION + stage expectations |
| `electron/main.spec.ts` | Modified/New | `db:backupNow`/`db:initialize` stage tests |
| `package.json` | Modified | Add `postinstall` script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Negates single-PR cohesion if sub-changes conflict | Low | Independent files/areas; one commit per work unit |
| `stage` refactor ripple through existing assertions | Med | Invert existing `'open'` assertions to RED first (spec:437-464, main.spec:323-361) |
| postinstall runs on every `bun install` | Low | Documented; no behavioral side effect beyond rebuild cost |

## Rollback Plan

- Revert per-area commits (git revert); each backlog is independently revertible.
- `package.json` postinstall is trivially removable.

## Dependencies

- electron-builder `^26.15.3` (already in devDeps).
- Existing `corruptTargetFor()` collision pattern as reference.

## Success Criteria

- [ ] Same-minute second snapshot persists at `..._HHmm-1.db` (never overwrites).
- [ ] Fatal during recovery reports the actual `stage`, not `'open'`.
- [ ] `postinstall` runs `electron-builder install-app-deps` successfully.
- [ ] Electron tests all GREEN; new tests RED→GREEN under strict TDD.