# Apply Progress: admin-setup-flow

**Mode**: Strict TDD (bunx vitest run)
**Change**: admin-setup-flow
**Artifact Store**: hybrid (openspec files + Engram)

## Phase 1: Foundation / Infrastructure

### Task 1.1: Remove adminUser/adminPassword from environment.ts
- [x] RED: Write test verifying credentials removed
- [x] GREEN: Remove credentials
- [x] REFACTOR: Verify fileReplacements shape intact

### Task 1.2: Remove from environment.prod.ts
- [x] RED: Write test verifying credentials removed
- [x] GREEN: Remove credentials
- [x] REFACTOR: Verify fileReplacements shape intact

### Task 1.3: Remove from environment.test.ts (keep seedEnabled: true)
- [x] RED: Write test verifying credentials removed, seedEnabled kept
- [x] GREEN: Remove credentials, keep seedEnabled
- [x] REFACTOR: Verify test env clean

### Task 1.4: Edit db-migrations.ts: remove env-based seed block in migrationV2; replace with no-op
- [x] RED: Write test verifying migrationV2 no longer uses environment.*
- [x] GREEN: Remove seed block using environment.*, replace with no-op
- [x] REFACTOR: Verify seed has no env references

### Task 1.5: Add migration v18 config table SQL + update electron/db.ts MAX_SCHEMA_VERSION 17→18
- [x] RED: Write test verifying config table created and schema version 18
- [x] GREEN: Add migrationV18 creating config table, update MAX_SCHEMA_VERSION
- [x] REFACTOR: Verify config table created; schema version 18 set

### Task 1.6: Refactor seed: rename seedIfEmpty → seedProductosSiVacio and export
- [x] RED: Write test verifying seedProductosSiVacio exported and idempotent
- [x] GREEN: Rename function, export, update runMigrations call site
- [x] REFACTOR: Verify existing seed tests still green

## Phase 2: Core Implementation

### Task 2.1: Create src/app/guards/setup.guard.ts CanActivateFn
- [x] RED: Write tests for guard redirections (0 users, >0 users, authenticated)
- [x] GREEN: Implement setupGuard
- [x] REFACTOR: Verify guard behavior correct

### Task 2.2: Create src/app/services/setup.service.ts
- [x] RED: Write tests for countUsers, createInitialAdmin, getConfig, setConfig
- [x] GREEN: Implement SetupService with mocked DATABASE
- [x] REFACTOR: Verify SQL calls correct, returns correct

### Task 2.3: Modify user.service.ts: add getActiveAdminCount(); replace environment.adminUser checks
- [x] RED: Write tests for getActiveAdminCount and blocking logic
- [x] GREEN: Add method, replace env checks with count-based blocking
- [x] REFACTOR: Verify blocking works

### Task 2.4: Modify admin.page.ts: remove seedAdminId; add activeAdminCount signal
- [x] RED: Write tests for activeAdminCount and disabled controls
- [x] GREEN: Remove seedAdminId, add activeAdminCount computed
- [x] REFACTOR: Verify UI disables for last admin

### Task 2.5: Modify admin.page.html: bind disabled state, show warning tooltip
- [x] RED: Write tests for disabled binding and tooltip
- [x] GREEN: Update template
- [x] REFACTOR: Verify tooltip appears

### Task 2.6: Modify auth.service.ts: add legacy hash verification in _restoreSession
- [x] RED: Write tests for legacy detection and redirect flag
- [x] GREEN: Add _checkLegacyPassword, legacyResetRequired signal, redirect logic
- [x] REFACTOR: Verify legacy detection works

## Phase 3: Integration / Wiring

### Task 3.1: Create setup.page.ts standalone component
- [x] RED: Write tests for form rendering, submission, mode=reset support
- [x] GREEN: Create SetupPage with form, loading/error states
- [x] REFACTOR: Verify form renders, submits via service

### Task 3.2: Create setup.page.html template
- [x] RED: Write tests for template rendering
- [x] GREEN: Create template following login.page.html pattern
- [x] REFACTOR: Verify template matches design

### Task 3.3: Create setup.page.css
- [x] RED: Verify styles applied
- [x] GREEN: Create minimal styles reusing login patterns
- [x] REFACTOR: Verify styles correct

### Task 3.4: Modify app.routes.ts: add /setup route, apply setupGuard
- [x] RED: Write tests for routes and guard application
- [x] GREEN: Add /setup route with lazy load, apply setupGuard to /login and /setup
- [x] REFACTOR: Verify routes configured, guard applied

## Phase 4: Testing

### Task 4.1: Unit - SetupService
- [x] RED: Tests written in Task 2.2
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

### Task 4.2: Unit - setupGuard
- [x] RED: Tests written in Task 2.1
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

### Task 4.3: Unit - UserService getActiveAdminCount, blocking
- [x] RED: Tests written in Task 2.3
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

### Task 4.4: Unit - AuthService _restoreSession legacy detection
- [x] RED: Tests written in Task 2.6
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

### Task 4.5: Integration - SetupPage form submission
- [ ] RED: Write integration test
- [ ] GREEN: Test passes
- [ ] REFACTOR: Verify navigation to /pos authenticated

### Task 4.6: Integration - Fresh install migrations v1..v18
- [ ] RED: Write integration test
- [ ] GREEN: Test passes
- [ ] REFACTOR: Verify migration v18 applied

### Task 4.7: Integration - Existing DB at v17 upgrades to v18
- [ ] RED: Write integration test
- [ ] GREEN: Test passes
- [ ] REFACTOR: Verify upgrade path works

### Task 4.8: E2E - Fresh install flow
- [ ] RED: Write E2E test
- [ ] GREEN: Test passes
- [ ] REFACTOR: Verify end-to-end flow

### Task 4.9: E2E - Legacy user reset flow
- [ ] RED: Write E2E test
- [ ] GREEN: Test passes
- [ ] REFACTOR: Verify legacy reset flow

### Task 4.10: Unit: seedProductosSiVacio idempotencia
- [x] RED: Written in Task 1.6
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

### Task 4.11: Unit: SetupService.createInitialAdmin seedProducts toggle
- [x] RED: Tests written in Task 2.2
- [x] GREEN: Tests pass
- [ ] REFACTOR: -

## Phase 5: Cleanup

### Task 5.1: Remove temporary console.log/debug code
- [ ] RED: -
- [ ] GREEN: Clean up debug code
- [ ] REFACTOR: Verify no debugging artifacts

### Task 5.2: Update documentation comments
- [ ] RED: -
- [ ] GREEN: Update comments
- [ ] REFACTOR: Verify comments consistent

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/app/environments/environment.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.2 | `src/app/environments/environment.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.3 | `src/app/environments/environment.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.4 | `src/app/services/db-migrations.spec.ts` | Unit | ✅ 10/10 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 1.5 | `src/app/services/db-migrations.spec.ts` | Unit | ✅ 10/10 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 1.6 | `src/app/services/db-migrations.spec.ts` | Unit | ✅ 10/10 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 2.1 | `src/app/guards/setup.guard.spec.ts` | Unit | ✅ 5/5 | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ Clean |
| 2.2 | `src/app/services/setup.service.spec.ts` | Unit | ✅ 8/8 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 2.3 | `src/app/services/user.service.spec.ts` | Unit | ✅ 18/18 | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| 2.4 | `src/app/pages/admin/admin.page.spec.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 2.5 | (template) | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 2.6 | `src/app/services/auth.service.spec.ts` | Unit | ✅ 4/4 | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| 3.1 | `src/app/pages/setup/setup.page.spec.ts` | Unit | ✅ 7/7 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 3.2 | (template) | Integration | ✅ 7/7 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 3.3 | (css) | Integration | ✅ 7/7 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 3.4 | `src/app/app.routes.spec.ts` | Unit | ✅ 4/4 | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |

## Files Changed (Tracking)

### Created
- `src/app/environments/environment.spec.ts`
- `src/app/guards/setup.guard.ts`
- `src/app/guards/setup.guard.spec.ts`
- `src/app/services/setup.service.ts`
- `src/app/services/setup.service.spec.ts`
- `src/app/pages/setup/setup.page.ts`
- `src/app/pages/setup/setup.page.spec.ts`
- `src/app/pages/setup/setup.page.html`
- `src/app/pages/setup/setup.page.css`
- `src/app/app.routes.spec.ts`

### Modified
- `src/app/environments/environment.ts`
- `src/app/environments/environment.prod.ts`
- `src/app/environments/environment.test.ts`
- `src/app/services/db-migrations.ts`
- `src/app/services/db-migrations.spec.ts`
- `electron/db.ts`
- `src/app/services/user.service.ts`
- `src/app/services/user.service.spec.ts`
- `src/app/pages/admin/admin.page.ts`
- `src/app/pages/admin/admin.page.html`
- `src/app/pages/admin/admin.page.spec.ts`
- `src/app/services/auth.service.ts`
- `src/app/services/auth.service.spec.ts`
- `src/app/app.routes.ts`

## Tests Summary
- Runner: `bunx vitest run`
- Phase 1: 15 tests passing
- Phase 2: 38 tests passing
- Phase 3: 18 tests passing
- Total tests passing: 110 (including safety net)

## Deviations from Design
None — implementation matches design.

## Issues Found
None.

## Remaining Tasks
Phase 4 (tasks 4.5-4.9), Phase 5 (5.1-5.2) — 11 tasks pending.

## Workload / PR Boundary
- Mode: Single PR with size:exception (~500 lines estimated, maintainer approved)
- Current work unit: Phase 4
- Boundary: All 27 tasks in one PR on branch `setup-upgrade`
- Estimated review budget impact: ~500 lines (exception approved)