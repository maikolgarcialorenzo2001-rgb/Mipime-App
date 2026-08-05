# Design: Desktop Resilience Backlogs

Single-PR, strict TDD. Three independent backlogs over `electron/db.ts`, `electron/main.ts`, `package.json`. NO scalar feed, NO libs.

## Technical Approach

- **BACKLOG-2 (snapshot collision)**: mirror house pattern `corruptTargetFor()` — a real-`fs` verified allocator in `db.ts`, consumed by `db:backupNow`. Caller writes only to the `fs`-proven free path and returns it to the renderer.
- **BACKLOG-3 (stage threading)**: module-scoped `let currentStage` in `db.ts`, mutated as the cascade advances; both fatal call sites read one exported getter so they cannot drift.
- **BACKLOG-4**: one `package.json` scripts line. No structural design.

## Backlog-2 — Collision-safe snapshot path

**WHERE dedup lives**: in `db.ts`, as a new exported helper — NOT scattered in `main.ts`. Matches the house pattern (`corruptTargetFor` is also a `db.ts` private helper), keeps `nm.ts` an orchestration-only consumer, and makes the allocator unit-testable against real `fs` in `db.spec.ts`.

```ts
// electron/db.ts  (module accepts NO electron import — pure)
export function timestampedSnapshotPath(backupsDir: string, d: Date): string {
  const base = path.join(backupsDir, timestampedBackupName(d)); // keeps base format parseable (TIMESTAMPED_RE)
  let target = base;
  let n = 1;
  while (fs.existsSync(target)) {
    target = `${base}-${n++}`; // first collision → `-1`, then `-2`…
  }
  return target;
}
```

- Uniqueness loop: start with the unsuffixed base (n=1), append `-<n>` (n starts **1**) until `!fs.existsSync`. Fresh minute → unsuffixed base; second same-minute write → `-1`; third → `-2`. (Matches spec `starting at 1` and `corruptTargetFor`.)
- `timestampedBackupName(d)` is reused unchanged → `TIMESTAMPED_RE` base format + `stamp()` untouched for non-suffixed names.
- `snapshotDirFor` branch in `main.ts` (`db:backupNow` / `jornada-close`) calls the allocator and returns the resolved path as `timestampedPath`:
  - Old: `path.join(backupsDirFor(), timestampedBackupName(new Date()))`
  - New: `const snapshotPath = timestampedSnapshotPath(backupsDirFor(), new Date());` … `return { ok: true, rodantePath, timestampedPath: snapshotPath };`
  - `timestampedBackupName` removed from `main.ts` import (no longer referenced; avoids no-unused).
- Data flow: `db:backupNow(jornada-close)` → `timestampedSnapshotPath` (returns `fs`-free path) → `backupDb(snapDb, snapshotPath)` writes → same path returned as `timestampedPath` → renderer UI reports the *real* written file.

### Data flow (snapshot)

```
db:backupNow('jornada-close')
   │ backupDb(db, rodantePathFor())
   ├─ snapshotPath = timestampedSnapshotPath(backupsDirFor(), now)   // fs-checked free path
   ├─ backupDb(snapDb, snapshotPath)                                  // write actual
   ├─ pruneBackups(backupsDirFor(), 30)
   └─ return { ok, rodantePath, timestampedPath: snapshotPath }      // real path → renderer
```

### DECIDED: Parser widening approved

`TIMESTAMPED_RE` and `whenFromName` hard-require `.db` at the END. A suffixed `…_1430-1.db` would fail `listTimestampedBackups` (not restorable) and `pruneBackups` (unbounded retention leak) — contradicting the db-backup spec MUST clauses ("still parseable by whenFromName" + "auto-prune MUST apply to suffixed"). The user APPROVED the minimal regex widening. Base layout/date format stays identical; only an optional `-\d+` suffix group is tolerated:

```
TIMESTAMPED_RE   = /^tienda_\d{4}-\d{2}-\d{2}_\d{4}(?:-\d+)?\.db$/
whenFromName(m)  = /^tienda_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(?:-\d+)?\.db$/
```

No additional changes to `db.ts` beyond these two regexes. Both `restore` and `prune` now accept suffixed names; the base `YYYY-MM-DD_HHmm` format and `stamp()` are untouched for non-suffixed names. Add a RED→GREEN collision-suffix case to the strict-regex test (`db.spec.ts:190-197` asserts `timestampedBackupName` matches the base regex — unchanged; new case asserts a suffixed `…-1.db` is matched by `TIMESTAMPED_RE` and parsed by `whenFromName`).

## BACKLOG-3 — Thread stage through the recovery cascade

**Decision**: module-scoped mutable + exported getter in `db.ts` (single shared source; both call sites read the same object → cannot drift). Not pass-through-arg (simpler: the `main.ts` catch synthesizing fatal needs the stage even though the throw has no return value).

```ts
// electron/src/db.ts
let currentStage: DbDiagnostics['stage'] = 'open';
export function getStartupStage(): DbDiagnostics['stage'] {
  return currentStage;
}
```

- `runStartupSequence`: default `'open'`; set `currentStage = 'recover'` the instant the cascade advances past open (post open/validate failure, before `recoverInPlace`). Replaces both hardcoded `stage: 'open'` at (`db.ts:403-412` fatal) and (`main.ts:245-254` db:initialize catch) with `stage: getStartupStage()`.
- The `db:initialize` catch also reads `getStartupStage()` → reflects the phase underway at throw (`open` | `import` | `recover`) — true shared source.
- Union `'open'|'recover'|'backup'|'import'` unchanged (no widening, per spec non-goal).

### Data flow (stage)

```
runStartupSequence      main.ts db:initialize
   ◄── currentStage ◄──► getStartupStage()  // one module var
   open → 'open'
   recover cascade → 'recover'
   fatal → { stage: getStartupStage() }      └ catch → { stage: getStartupStage() } (M1)
```

## Architecture Decisions

| Decision | Option | Choice | Rationale |
|---|---|---|---|
| Snapshot dedup location | helper in db.ts vs in main.ts | `db.ts: timestampedSnapshotPath` | house pattern (corruptTargetFor); fs-testable in db.spec; main.ts stays orchestration |
| Stage threading | module-scope+getter vs pass-through param | module-scope+getter | main.ts catch needs stage after throw (no return value); 1 shared source |
| `whenFromName`/`TIMESTAMPED_RE` suffix tolerance | widen vs leave | widen (minimal, APPROVED) | spec MUSTs it: suffixed must be restorable + prunable |
| Postinstall | scripts line w/ coexisting | `"postinstall": "electron-builder install-app-deps"` | rebuild native after bun install; keep dedicated `electron:rebuild` |

## BACKLOG-4 — postinstall (config-only)

- Add after `electron:rebuild` line (alphabetical/companion placement), `package.json` scripts:
  `"postinstall": "electron-builder install-app-deps",`
- electron-builder `^26.15.3` confirmed present (line 36). Runs on every `bun install` (accepted). `electron:rebuild` co-exists and unchanged. Build scripts keep their explicit `electron:rebuild` step.
- **Verification**: `bun install` (or `bun install --frozen-lockfile`) triggers postinstall; confirm electron-builder CLI resolves. No unit test (config package.json), integration verified by migration of native rebuild.

## File Changes

| File | Action | Description |
|---|---|---|
| `electron/db.ts` | Modify | `timestampedSnapshotPath()`; `currentStage`/`getStartupStage()`; `TIMESTAMPED_RE`+`whenFromName` suffix-tolerance; replace 2 hardcoded `'open'` calls it to getter; `backupNow` snapshot allocator |
| `electron/main.ts` | Modify | use `timestampedSnapshotPath` for journada-clock snapshots; return real path; read `getStartupStage()` in `db:initialize` catch (replace hardcoded `stage: 'open'`); imports |
| `package.json` | Modify | add `postinstall` script |
| `electron/db.spec.ts` | Modify | flip `stage` assertion; add collision + suffixed-retention tests |
| `electron/main.spec.ts` | Modify | flip M1 stage assertion; collodile-path end-to-end for journada-close |

## Interfaces / Contracts

- `db.ts` new: `timestampedSnapshotPath(backupsDir: string, d: Date): string`; `getStartupStage(): DbDiagnostics['stage']`.
- Existing `DbDiagnostics.stage`, `DbBackupInfo.status`, IPC payloads unchanged (no schema widening).
- `main.ts` returns `{ ok: true, rodantePath, timestampedPath }` — `timestampedPath` now the real (possibly suffixed) path.

## Testing Strategy

| Layer | What to Test | Approach / RED→GREEN |
|---|---|---|
| Unit (db.spec) | fresh-minute → base; 2nd same-minute → `-1`; 3rd → `-2` | new cases, RED then GREEN |
| Unit (db.spec) | suffixed snapshot prunable by retention (after RE widening) | new case proving retention applies to suffix |
| Unit (db.spec) | fatal "all candidates fail" `stage` | **RED-FLIP line 457 `'open'` → `'recover'`** (cascade exhausted past open) |
| Integration (main.spec) | journada-close returns raila (suffix) `timestampedPath` | extend/flip existing test (mock fs: exists→true once → expects `-1` path) |
| Integration (main.spec) | M1 db:initialize unexpected throw stage | **RED-FLIP line-iss 362 `'open'` → `getStartupStage()`** (`mockGetStartupStage` → `'recover'` proves non-hardcoded) |

Existing specs moved: `db.spec.ts:457` `stage:'open'`→`'recover'`; `main.spec.ts:362` (M1) `'open'`→read-through `getStartupStage()`. New collision tests in `db.spec.ts`; journada-close path test updated in `main.spec.ts:573-589`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Suffixed snapshots invisible to prune/restore | High (sure bug) | RESOLVED — widening `TIMESTAMPED_RE`/`whenFromName` (minimal, base layout unchanged) approved |
| `stage` ripple through existing assertions | Med | RED-flip listed tests first (strict TDD) |
| postinstall rebuild on every bun install | Low | Documented; no behavioral side effect |

## Implementation Order

Independent (no coupling): 
1. **BACKLOG-4** postinstall (config, trivial) — commit 1.
2. **BACKLOG-3** stage threading — commit 2 (has the 2 RED-flips).
3. **BACKLOG-2** collision allocator + parser widening + main.ts snapshot — commit 3.

Preferred 2→3→1 grouping if commits pair TDD runs; each commit = reviewable unit, individually revertible.

## Open Questions

- [x] DECIDED: parser widening (`whenFromName`/`TIMESTAMPED_RE` optional `-\d+` suffix) APPROVED by user. No remaining blockers.

## Migration / Rollout

No DB migration. Config-only postinstall + additive snapshot allocator. No feature flags. Rollback = per-commit revert.