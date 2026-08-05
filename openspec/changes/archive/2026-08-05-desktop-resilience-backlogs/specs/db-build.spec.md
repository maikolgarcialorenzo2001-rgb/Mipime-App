# Delta for db-build

## ADDED Requirements

### Requirement: Native app-deps rebuild on install

The package MUST declare a `postinstall` script running `electron-builder install-app-deps` so native module dependencies (e.g. `better-sqlite3`) are rebuilt for the Electron Node ABI automatically after `bun install`.
(Postinstall is a configuration-only addition; no runtime behavior is introduced because the change is limited to `package.json` scripts.)

#### Scenario: Postinstall script is present

- GIVEN the project `package.json` exists
- WHEN it is inspected
- THEN a `postinstall` script runs `electron-builder install-app-deps`
- AND it coexists with the existing dedicated `electron:rebuild` script

#### Scenario: Dedicated rebuild remains for manual precision

- GIVEN `electron:rebuild` runs `npx @electron/rebuild -f -w better-sqlite3`
- WHEN postinstall is added
- THEN `electron:rebuild` MUST remain unchanged and available for manual targeted rebuilds

## Constraints

- `electron:rebuild` MUST NOT be removed or replaced by `postinstall` — both coexist (postinstall is not meant to be a migration).
- The build scripts (`electron:build:win|mac|linux`) MUST keep their explicit `electron:rebuild` step; `postinstall` is an additional complementary hook, not a substitute.
- The postinstall is accepted to run on every `bun install` (documented tradeoff; no behavioral side effect beyond rebuild cost).