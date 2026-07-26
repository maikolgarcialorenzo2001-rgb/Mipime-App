# Tasks: prod-improvements-julio-2026

## Dependency Graph

```
Change 4 (TODO cleanup) ─────────── independent, no deps
Change 3 (Dark mode)    ─────────── independent, no deps
Change 1 (Jornada refresh) ──────── independent, no deps
Change 2 (Test TTL) ─────────────── internal dependency chain:
  2a. environment.test.ts ─┐
  2b. angular.json ────────┤ (no deps between these two)
  2c. ttl-check.ts ────────┤
  2d. ttl-expired component ─┐
  2e. app.ts + app.html ─────┤ (depends on 2d)
  2f. app.config.ts ─────────┘ (depends on 2c)
```

**Recommended execution order:** 3 → 4 → 1 → 2 (but 3, 4, 1 are independent and can be parallelized).

---

## [x] Task T1 — Fix dark mode text visibility (Change 3)

**Dependencies:** None

**Estimate:** 4 lines changed, 1 file

**Steps:**
1. Open `src/app/components/jornada-summary-card/jornada-summary-card.component.html`
2. Add `text-gray-900 dark:text-gray-100` to all 4 `<dd>` elements:
   - Line 12: `<dd class="text-lg font-semibold ...">` → add classes
   - Line 15: same for total_ventas `<dd>`
   - Line 19: same for total_gastos `<dd>`
   - Line 23: same for saldo_esperado `<dd>`
3. Verify `src/app/pages/jornada/jornada.page.html` line 88 already has the correct classes (no change needed).

**Verification:**
- Run existing tests: `npx vitest run --config vitest.config.ts` (no tests should break)
- Visual check: render with dark mode enabled, confirm numbers are visible

**Tests to verify:**
- No new tests needed (pure CSS change). Verify existing tests pass.

---

## [x] Task T2 — Remove A3/A4 from todo-mipime.md (Change 4)

**Dependencies:** None

**Estimate:** 8 lines deleted, 1 file

**Steps:**
1. Open `todo-mipime.md`
2. Delete lines 73–80 (inclusive):
   - `### A3. Editar / eliminar movimientos`
   - Context line
   - Approach line
   - blank line
   - `### A4. CRUD completo de productos desde la UI`
   - Context line
   - Note line
   - Approach line

**Verification:**
- Search for "A3." and "A4." in the file — neither should appear
- Confirm "🔴 Prioridad Alta" section is now empty (or heading removed)
- Confirm no other content was affected

**Tests to verify:** None needed.

---

## [x] Task T3 — Add jornada refresh after POS sale (Change 1)

**Dependencies:** None

**Estimate:** 1 line added, 1 file

**Steps:**
1. Open `src/app/pages/pos/pos.page.ts`
2. In `confirmarVenta()`, after line 221 (`this.searchInput()?.nativeElement.focus();`), add:
   ```typescript
   this._jornadaService.refreshJornadaAbierta();
   ```
3. The line goes INSIDE the `next` callback, after all existing post-sale logic.

**Why this location:**
- After cart reset and UI cleanup (those shouldn't depend on refresh)
- After stock refresh (`_buscar`)
- After focus reset to search input
- The call is fire-and-forget — the service handles its own error (sets `jornadaAbierta` to null)

**Verification:**
- Run `npx vitest run --config vitest.config.ts` — all tests pass
- Manual: do a sale in POS, navigate to jornada page — totals should be updated without manual refresh

**Tests to verify:**
- Existing tests for `confirmarVenta()` should still pass
- No new test needed for a single fire-and-forget service call (the service method is already tested in `jornada.service.spec.ts`)
- **Optional but recommended**: Add a test in `pos.page.spec.ts` that mocks `_jornadaService.refreshJornadaAbierta` and asserts it was called after a successful sale. This protects against regression.

---

## [x] Task T4 — Create environment.test.ts (Change 2a)

**Dependencies:** None (can run in parallel with T1, T2, T3)

**Estimate:** 8 lines new, 1 file

**Steps:**
1. Create `src/app/environments/environment.test.ts`
2. Copy `environment.prod.ts` content exactly
3. Add two new properties:
   ```typescript
   ttlDays: 7,
   testMode: true,
   ```

**Verification:**
- File exists and exports `environment` object
- Import it in a test file and verify `environment.testMode === true` and `environment.ttlDays === 7`
- Verify `environment.production === true` (mirrors prod)

**Tests to verify:** None (static config file).

---

## [x] Task T5 — Add "test" build configuration in angular.json (Change 2b)

**Dependencies:** None (can run in parallel with T1, T2, T3)

**Estimate:** ~18 lines added, 1 file

**Steps:**
1. Open `angular.json`
2. Under `projects.Mipime-Cuentas.architect.build.configurations`, add a new `"test"` entry after the `"development"` entry:
   ```json
   "test": {
     "budgets": [
       {
         "type": "initial",
         "maximumWarning": "500kB",
         "maximumError": "1MB"
       },
       {
         "type": "anyComponentStyle",
         "maximumWarning": "4kB",
         "maximumError": "8kB"
       }
     ],
     "outputHashing": "all",
     "fileReplacements": [
       {
         "replace": "src/app/environments/environment.ts",
         "with": "src/app/environments/environment.test.ts"
       }
     ]
   }
   ```

**Verification:**
- Run `bun ng build --configuration=test` — should succeed with test environment
- Run `bun ng build --configuration=production` — should still work (no regression)
- Run `bun ng build --configuration=development` — should still work (no regression)

**Tests to verify:** None.

---

## [x] Task T6 — Create TTL check initializer (Change 2c)

**Dependencies:** Task T4 (environment.test.ts must exist for import reference)

**Estimate:** ~35 lines new, 1 file

**Steps:**
1. Create `src/app/initializers/ttl-check.ts`
2. Export factory function and the initializer provider:
   ```typescript
   import { environment } from '../environments/environment';

   export function ttlCheckInitializer(): () => Promise<boolean> {
     return () => {
       if (!environment.testMode) return Promise.resolve(true);

       try {
         const stored = localStorage.getItem('mipime_first_launch');
         if (!stored) {
           localStorage.setItem('mipime_first_launch', new Date().toISOString());
           return Promise.resolve(true);
         }

         const firstLaunch = new Date(stored).getTime();
         const now = Date.now();
         const diffDays = (now - firstLaunch) / (1000 * 60 * 60 * 24);

         if (diffDays > (environment.ttlDays ?? 7)) {
           localStorage.setItem('mipime_ttl_expired', 'true');
         }
       } catch {
         // localStorage unavailable or corrupted — fail-safe: block
         localStorage.setItem('mipime_ttl_expired', 'true');
       }

       return Promise.resolve(true);
     };
   }
   ```

**Verification:**
- Unit test: call `ttlCheckInitializer` in a test with mocked localStorage
- Verify: first launch stores timestamp, subsequent launch within TTL does nothing, launch after TTL sets `mipime_ttl_expired`
- Verify: corrupted/invalid stored date sets `mipime_ttl_expired`

**Tests to write:**
- `src/app/initializers/ttl-check.spec.ts` with test scenarios:
  1. First launch in test mode stores timestamp, returns true
  2. Launch within TTL (e.g., 3 days) returns true, does not set expired
  3. Launch after TTL (e.g., 8 days) sets `mipime_ttl_expired`, returns true
  4. Corrupted stored date sets `mipime_ttl_expired`, returns true
  5. Non-test mode returns true without touching localStorage

---

## [x] Task T7 — Create ttl-expired component (Change 2d)

**Dependencies:** None

**Estimate:** ~35 lines new, 1 file

**Steps:**
1. Create `src/app/components/ttl-expired/ttl-expired.component.ts`
2. Create a standalone component with:
   - Full-screen fixed overlay (`fixed inset-0 z-50`)
   - Centered content with app title
   - "Versión de prueba expirada" heading
   - Contact message
   - Use `material-symbols-outlined` for the icon (e.g., `timer_off` or `lock`), consistent with project's existing Material Symbols usage
   - No inputs/outputs — purely presentational

**Verification:**
- Component renders without errors
- Styled correctly in both light and dark mode
- Overlay covers full viewport, scroll doesn't bypass it

**Tests to write:**
1. `src/app/components/ttl-expired/ttl-expired.component.spec.ts`
   - Renders the heading "Versión de prueba expirada"
   - Renders contact message
   - Has the `material-symbols-outlined` element
   - Has the correct container classes (`fixed inset-0 z-50`)

---

## [x] Task T8 — Wire ttl-expired into App component (Change 2e)

**Dependencies:** Task T7 (ttl-expired component must exist)

**Estimate:** ~8 lines modified across 2 files

**Steps:**
1. Open `src/app/app.ts`
   - Import `TtlExpiredComponent` and `signal`
   - Add `ttlExpired = signal(false);` property
   - In constructor (or `afterNextRender`), read `localStorage.getItem('mipime_ttl_expired')` and set the signal
2. Open `src/app/app.html`
   - Replace current `<router-outlet />` with conditional block:
   ```html
   @if (ttlExpired()) {
     <app-ttl-expired />
   } @else {
     <router-outlet />
   }
   ```
3. Import `TtlExpiredComponent` in `app.ts` imports array.

**Verification:**
- Without `mipime_ttl_expired` in localStorage: app renders normally
- With `mipime_ttl_expired` set: app shows blocking overlay only

**Tests to verify/write:**
- Update existing `app.spec.ts` to account for the new conditional rendering
- Test: when `mipime_ttl_expired` is not set, `<router-outlet>` is rendered
- Test: when `mipime_ttl_expired` is set, `<app-ttl-expired>` is rendered

---

## [x] Task T9 — Register TTL initializer in app.config.ts (Change 2f)

**Dependencies:** Task T6 (ttl-check.ts must exist)

**Estimate:** ~5 lines modified, 1 file

**Steps:**
1. Open `src/app/app.config.ts`
2. Import `APP_INITIALIZER` from `@angular/core`
3. Import `environment` from `./environments/environment`
4. Import `ttlCheckInitializer` from `./initializers/ttl-check`
5. Add conditional provider:
   ```typescript
   ...(environment.testMode
     ? [{ provide: APP_INITIALIZER, useFactory: ttlCheckInitializer, multi: true }]
     : []),
   ```

**Verification:**
- With `environment.testMode = true`: initializer runs during bootstrap
- With `environment.testMode = false`: initializer is NOT registered (spread empty array)
- Build with `--configuration=test`: initializer runs
- Build with `--configuration=production`: initializer does NOT run

**Tests to write:**
- `src/app/app.config.spec.ts` (if it doesn't exist): verify providers include APP_INITIALIZER when testMode is true
- Or update existing app config test

---

## Summary

| Task | Description | Files | Lines Δ | Tests | Priority |
|------|-------------|-------|---------|-------|----------|
| T1 | Dark mode text (jornada-summary-card) | 1 | +4 | Verify existing | High |
| T2 | Remove A3/A4 from todo-mipime.md | 1 | -8 | None | Low |
| T3 | Jornada refresh after sale | 1 | +1 | pos.page.spec.ts (2 tests) | Critical |
| T4 | Create environment.test.ts | 1 (new) | +8 | None | High |
| T5 | angular.json test config | 1 | +18 | None | High |
| T6 | TTL check initializer | 1 (new) | ~35 | ttl-check.spec.ts (5 cases) | High |
| T7 | ttl-expired component | 1 (new) | ~35 | ttl-expired.spec.ts (8 cases) | High |
| T8 | Wire ttl-expired into App | 2 | ~8 | app.spec.ts (update) | High |
| T9 | Register initializer in app.config.ts | 1 | ~5 | app.config.spec.ts | High |

**Total:** 10 files touched (3 new), ~106 lines changed, ~17 test cases across 3 new spec files + 2 existing spec updates.
