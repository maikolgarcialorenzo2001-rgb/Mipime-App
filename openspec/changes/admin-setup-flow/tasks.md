# Tasks: admin-setup-flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500 (range 480-520) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (size:exception ya aprobado) |
| Delivery strategy | exception-ok |
| Chain strategy | n/a (single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a (single PR)
400-line budget risk: High

> Binding (user-confirmed 2026-08-29): single PR — `size:exception` ya aprobado. Todo queda en `admin-setup-flow`; el estimado sube a ~500 líneas por el seed opcional pero el PR NO se divide.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Env cleanup + migration v18 | PR 1 | `bunx vitest run --setup` | `bun test:setup` | Rollback env files + migration v18 |
| 2 | SetupService + guard | PR 2 | `bunx vitest run --service` | `bun test:service` | Rollback service + guard |
| 3 | Auth legacy detection + UserService admin rule | PR 3 | `bunx vitest run --auth` | `bun test:auth` | Rollback auth + user changes |
| 4 | Setup page + routes | PR 4 | `bunx vitest run --setup-page` | `bun test:page` | Rollback page + routes |
| 5 | Testing (unit/integration/E2E) | - | `bunx vitest run` | `bun test:e2e` | Full rollback |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Remove `adminUser`/`adminPassword` from `src/app/environments/environment.ts` (~2 del). Accept: no credentials; `fileReplacements` shape intact.
- [x] 1.2 Remove from `src/app/environments/environment.prod.ts` (~2 del). Accept: same.
- [x] 1.3 Remove from `src/app/environments/environment.test.ts` (~2 del, keep `seedEnabled: true`). Accept: test env clean.
- [x] 1.4 Edit `src/app/services/db-migrations.ts`: remove env-based seed block in migrationV2; replace with no-op. Accept: seed has no env references.
- [x] 1.5 Add migration v18 config table SQL + update `electron/db.ts` `MAX_SCHEMA_VERSION` 17→18. Accept: config table created; schema version 18 set.
- [x] 1.6 Refactor seed: rename `seedIfEmpty` → `seedProductosSiVacio` and export from `src/app/services/db-migrations.ts`; update call site in `runMigrations`. Accept: reusable export, existing seed tests still green.

## Phase 2: Core Implementation

- [ ] 2.1 Create `src/app/guards/setup.guard.ts` CanActivateFn using SetupService.countUsers. Accept: `/login`→`/setup` when 0 users; `/setup`→`/pos` when users exist.
- [ ] 2.2 Create `src/app/services/setup.service.ts` providedIn:'root': countUsers, getConfig, setConfig, createInitialAdmin(nombre, password, nombreComercio, seedProducts) — persist `config.seedProducts` ('1'/'0'); call `seedProductosSiVacio` only when seedProducts true. Accept: SQL correct, seed conditional + persisted, testable with mocked DATABASE.
- [ ] 2.3 Modify `src/app/services/user.service.ts`: add getActiveAdminCount(); replace `environment.adminUser` checks in toggleActivo/updateRol with count-based blocking when count===1. Accept: last active admin blocked from deactivation.
- [ ] 2.4 Modify `src/app/pages/admin/admin.page.ts`: remove seedAdminId computed; add activeAdminCount signal/computed; disable deactivation/rol change when activeAdminCount()===1. Accept: UI disables controls for last admin.
- [ ] 2.5 Modify `src/app/pages/admin/admin.page.html`: bind disabled state to activeAdminCount; show warning tooltip. Accept: tooltip appears when last admin.
- [ ] 2.6 Modify `src/app/services/auth.service.ts`: add legacy hash verification in _restoreSession against SHA-256(salt+'softwarez'/admin123); set legacyResetRequired signal; redirect to /setup?mode=reset&userId=X if legacy detected and flag not set. Accept: legacy user forced reset on startup.

## Phase 3: Integration / Wiring

- [ ] 3.1 Create `src/app/pages/setup/setup.page.ts` standalone component: form admin nombre, password, nombreComercio (maxlength 18), seedProducts toggle (default off); mode=reset support; loading/error states. Accept: toggle wired to submit, decision sent to service.
- [ ] 3.2 Create `src/app/pages/setup/setup.page.html` template: centered card, Tailwind, ErrorAlertComponent, seedProducts toggle following login.page.html pattern. Accept: template matches design, toggle renders and binds.
- [ ] 3.3 Create `src/app/pages/setup/setup.page.css` minimal styles reusing login patterns. Accept: styles applied correctly.
- [ ] 3.4 Modify `src/app/app.routes.ts`: add /setup route lazy load SetupPage; apply setupGuard to /login and /setup routes. Accept: routes configured, guard applied.

## Phase 4: Testing

- [ ] 4.1 Unit: SetupService.countUsers, createInitialAdmin, getConfig/setConfig — mock DATABASE with vi.fn(). Accept: SQL calls verified, returns correct.
- [ ] 4.2 Unit: setupGuard redirections (0 users, >0 users, authenticated). Mock SetupService, AuthService, Router; test CanActivateFn return values. Accept: guard behavior correct.
- [ ] 4.3 Unit: UserService.getActiveAdminCount, toggleActivo/updateRol blocking. Mock DATABASE, test count query and throw conditions. Accept: blocking works as expected.
- [ ] 4.4 Unit: AuthService._restoreSession legacy detection. Mock DATABASE returning user with known legacy hash; verify legacyResetRequired signal set and redirect flag. Accept: legacy detection works.
- [ ] 4.5 Integration: SetupPage form submission → SetupService → DB → AuthService login → redirect /pos, with seedProducts toggle on and off. Mount SetupPage with TestBed, mock services, simulate submit for both states. Accept: navigation to /pos authenticated + `config.seedProducts` persisted.
- [ ] 4.6 Integration: Fresh install — run migrations v1..v18, config table created, /setup accessible. Spin up SqliteService with real SQL in Vitest, run initialize(), query schema_version. Accept: migration v18 applied successfully.
- [ ] 4.7 Integration: Existing DB at v17 upgrades to v18, config table created without data loss. Use runMigrations executor hitting test DB at v17, verify v18 applied. Accept: upgrade path works.
- [ ] 4.8 E2E: Fresh install flow — /login → /setup → form submission → /pos authenticated. Playwright/Vitest browser mode. Accept: end-to-end setup flow works from scratch.
- [ ] 4.9 E2E: Legacy user `e.z`/`softwarez` login → forced reset once → new password works. Seed v2 with legacy hash, login, verify redirect to /setup?mode=reset, submit new password, verify login. Accept: legacy reset flow completes.
- [ ] 4.10 Unit: `seedProductosSiVacio` idempotencia — mock DATABASE: count=0 → 74 inserts; count>0 → no-op. Accept: seed runs only on empty table.
- [ ] 4.11 Unit: `SetupService.createInitialAdmin` seedProducts=true/false → setConfig('seedProducts','1'/'0') and `seedProductosSiVacio` called / not called. Mock DATABASE + spy. Accept: decision persisted and honored.

## Phase 5: Cleanup

- [ ] 5.1 Remove temporary console.log/debug code from all modified files. Accept: no temporary debugging artifacts remain.
- [ ] 5.2 Update documentation comments reflecting new flow (setup guard, service, legacy detection). Accept: comments consistent with implementation.

Review Workload Forecast (plain text):
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High