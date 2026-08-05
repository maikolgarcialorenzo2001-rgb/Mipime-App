# Delta for db-backup

## ADDED Requirements

### Requirement: Collision-safe timestamped snapshot

When a timestamped snapshot is written, the system MUST produce a destination path that never overwrites an existing file. The base name MUST remain `tienda_<YYYY-MM-DD_HHmm>.db`; if that exact path already exists in the backups folder, the system MUST append a numeric suffix `-<n>` (starting at `1`) to produce a free path, mirroring the existing collision-avoidance behavior used for corrupt-target files.

The resulting path MUST still be a readable timestamped backup name that `whenFromName` can parse for the restore/display path.

#### Scenario: Same-minute second snapshot lands at a suffixed path

- GIVEN a timestamped backup `tienda_2026-07-31_1430.db` already exists in the backups folder
- WHEN a `jornada-close` snapshot is written in the same minute (`2026-07-31 14:30`)
- THEN the snapshot persists at `tienda_2026-07-31_1430-1.db`
- AND the first file is NOT overwritten

#### Scenario: Third same-minute snapshot increments the counter

- GIVEN `tienda_2026-07-31_1430.db` and `tienda_2026-07-31_1430-1.db` already exist
- WHEN a further `jornada-close` snapshot is written in the same minute
- THEN the new snapshot lands at `tienda_2026-07-31_1430-2.db`

#### Scenario: Fresh-minute snapshot uses the base path

- GIVEN no snapshot exists for the current minute
- WHEN a `jornada-close` snapshot is written
- THEN the file is written exactly at `tienda_<YYYY-MM-DD_HHmm>.db` with no suffix

### Requirement: Collision-safe snapshot returned to caller

The `db:backupNow` handler (and jornada-close flow) MUST return the actual resolved snapshot path (including any collision suffix) so the UI reports the file that was really written, not an assumed unsuffixed path.

#### Scenario: Returned path reflects the collision suffix

- GIVEN a same-minute collision produced `tienda_2026-07-31_1430-1.db`
- WHEN the `db:backupNow` handler resolves
- THEN `timestampedPath` equals the suffixed value actually written

## MODIFIED Requirements

### Requirement: Timestamped backup at jornada close

On each jornada close the system MUST write a timestamped backup to the backups folder using base name `tienda_<YYYY-MM-DD_HHmm>.db`; when a snapshot for the current minute already exists, the system MUST append a numeric suffix to avoid overwrite, so multiple same-minute closes each persist a distinct point-in-time snapshot.
(Previously: the timestamped backup path used the minute-granular `tienda_<YYYY-MM-DD_HHmm>.db` name with no collision handling, so two snapshot in the same second minute to the same path and the second silently overwrote the first.)

#### Scenario: Jornada close creates both backups

- GIVEN a jornada is being closed
- WHEN the close flow completes
- THEN the rodante backup is updated AND a snapshot `tienda_<YYYY-MM-DD_HHmm>.db` (or its `-<n>`-suffixed variant on collision) is created in the backups folder

## Non-goals and constraints

- The base `YYYY-MM-DD_HHmm` format and `TIMESTAMPED_RE` / `whenFromName` parsing MUST NOT change.
- Any new snapshot MUST remain parseable by `whenFromName` so restore timestamps stay accurate.
- Retention auto-prune MUST continue to apply to suffixed snapshots as it does to non-suffixed ones.