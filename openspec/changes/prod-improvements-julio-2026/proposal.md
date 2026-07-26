# Proposal: prod-improvements-julio-2026

## Intent

Fix two production bugs (stale jornada totals after sale, invisible numbers in dark mode), add a time-limited test environment for client demos, and clean up obsolete TODO entries. Low-risk, high-value improvements.

## Scope

### In Scope
- **Change 1**: Call `refreshJornadaAbierta()` after POS sale to fix stale jornada totals
- **Change 2**: Create `environment.test.ts` (prod clone + 7-day TTL), add `test` build config in `angular.json`, TTL check via APP_INITIALIZER + localStorage
- **Change 3**: Add `dark:text-gray-100` to `<dd>` elements in `jornada-summary-card.component.html` and modal values in `jornada.page.html`
- **Change 4**: Remove A3 (edit/delete movements) and A4 (CRUD products) entries from `todo-mipime.md`

### Out of Scope
- Multi-device polling for jornada sync (deferred — single-device use case currently)
- ProductoService CRUD changes (methods stay, only TODO entries removed)
- Any new features beyond TTL gating

## Capabilities

### New Capabilities
- `test-ttl-gating`: 7-day test environment with expiry check and blocking UI

### Modified Capabilities
- `checkout`: POS sale triggers jornada refresh (post-sale sync, not checkout flow itself)

## Approach

**Change 1 (Jornada refresh):** One-line fix — add `this._jornadaService.refreshJornadaAbierta()` in the `next` callback of `confirmarVenta()` at `pos.page.ts:215`. No polling needed for v1.

**Change 2 (Test TTL):**
1. Create `src/app/environments/environment.test.ts` — copy of prod config with `ttlDays: 7, testMode: true`
2. Add `"test"` build configuration in `angular.json` with fileReplacements → `environment.test.ts`
3. Create `src/app/initializers/ttl-check.ts` — APP_INITIALIZER that checks `mipime_first_launch` in localStorage; stores timestamp on first visit; blocks app if >7 days
4. Register initializer in `app.config.ts` when `environment.testMode === true`
5. Create `src/app/components/ttl-expired/ttl-expired.component.ts` — full-screen blocking overlay

**Change 3 (Dark mode):** Add `text-gray-900 dark:text-gray-100` to all numeric `<dd>` elements in both files.

**Change 4 (A3/A4 cleanup):** Delete lines 73-80 from `todo-mipime.md`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/pages/pos/pos.page.ts` | Modified | Add jornada refresh call after sale |
| `src/app/environments/environment.test.ts` | New | Test environment config |
| `angular.json` | Modified | Add `test` build configuration |
| `src/app/initializers/ttl-check.ts` | New | TTL check logic |
| `src/app/app.config.ts` | Modified | Register TTL initializer |
| `src/app/components/ttl-expired/` | New | Expiry blocking component |
| `src/app/components/jornada-summary-card/jornada-summary-card.component.html` | Modified | Dark mode text classes |
| `src/app/pages/jornada/jornada.page.html` | Modified | Dark mode text in modal |
| `todo-mipime.md` | Modified | Remove A3/A4 entries |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| TTL check blocks app incorrectly (localStorage cleared) | Low | Show "contact developer" message, not crash |
| Dark mode classes conflict with existing styles | Low | Using same pattern as rest of codebase (gray-100/900) |

## Rollback Plan

- **Change 1**: Revert the added line in `pos.page.ts`
- **Change 2**: Remove `environment.test.ts`, revert `angular.json` and `app.config.ts`, delete initializer and component
- **Change 3**: Revert the class additions in both HTML files
- **Change 4**: Restore A3/A4 entries from git history

## Dependencies

- None (all changes are self-contained)

## Success Criteria

- [ ] After a POS sale, the jornada page shows updated `total_ventas` and `saldo_esperado` without manual refresh
- [ ] `ng build --configuration=test` produces a build with 7-day TTL
- [ ] After 7 days, the app shows a blocking message and does not load
- [ ] Numbers on jornada page are readable in both light and dark mode
- [ ] A3/A4 entries no longer appear in `todo-mipime.md`
