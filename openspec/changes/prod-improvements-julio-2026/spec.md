# Spec: prod-improvements-julio-2026

## Change 1 — Jornada refresh after POS sale

### What exists today
- `PosPage.confirmarVenta()` calls `VentaService.registrar()` or `CuentaCosasService.registrar()` and on success clears the cart, shows a success toast, and refreshes product search (stock), but **never refreshes the jornada signal**.
- Movement registration (`jornada.page.ts:69`) already calls `refreshJornadaAbierta()` — only the sale path is missing.
- `JornadaService.refreshJornadaAbierta()` exists and simply re-fetches the open jornada from SQLite, updating the `jornadaAbierta` signal.

### What changes
- After the success path in `confirmarVenta()`, call `this._jornadaService.refreshJornadaAbierta()` so the jornada signal reflects the new totals immediately.

### Requirements
1. After any successful sale (both `VentaService` and `CuentaCosasService` paths), the `jornadaAbierta` signal MUST be refreshed.
2. The refresh MUST happen AFTER the service call resolves (inside the `next` callback).
3. No UI change — the jornada page will automatically reflect new values because it reads the same signal.

### Acceptance scenarios

```
Scenario: Post-sale jornada totals update
  Given the POS has an open jornada
  When the user confirms a sale (any payment method)
  Then the jornada signal reflects the updated total_ventas and saldo_esperado
  And the user sees the new totals when navigating to the jornada page (no manual refresh needed)
```

```
Scenario: Error during sale does NOT trigger refresh
  Given a sale that fails (e.g. stock validation error)
  When the user confirms the sale
  Then refreshJornadaAbierta() is NOT called
  And the error message is displayed to the user
```

---

## Change 2 — Test environment with 7-day TTL

### What exists today
- Two environments: `development` (environment.ts) and `production` (environment.prod.ts).
- `angular.json` has `production` and `development` build configurations; `production` uses fileReplacements.
- No TTL or expiry mechanism exists.

### What changes
- New `environment.test.ts` — identical to prod config but with `ttlDays: 7, testMode: true`.
- New `test` build configuration in `angular.json` with fileReplacements → environment.test.ts.
- New `src/app/initializers/ttl-check.ts` — APP_INITIALIZER factory that reads/writes `mipime_first_launch` in localStorage.
- New `src/app/components/ttl-expired/` — blocking full-screen component shown when TTL is exceeded.
- `app.config.ts` conditionally registers the TTL initializer when `environment.testMode === true`.

### Requirements
1. The test environment MUST behave identically to production except for the TTL gating.
2. On first launch in test mode, the app MUST store the current ISO timestamp in localStorage under key `mipime_first_launch`.
3. On every subsequent launch, the app MUST check if `now - first_launch > 7 days`. If yes, render a blocking overlay that prevents any interaction.
4. The blocking overlay MUST include: app name "Mipime-Cuentas", "Versión de prueba expirada", the date when access ended, and a "Contactar al desarrollador" message.
5. The TTL check MUST run during Angular bootstrap (before any page loads).
6. If localStorage is unavailable or the key is missing/invalid, the app MUST treat it as a first launch: store the current timestamp and allow access normally. This is the safe default — a wiped localStorage does not block a legitimate user.

### Acceptance scenarios

```
Scenario: First launch in test mode stores timestamp
  Given the app is built with --configuration=test
  When the user opens the app for the first time
  Then localStorage key "mipime_first_launch" is set to the current ISO timestamp
  And the app loads normally
```

```
Scenario: Subsequent launch within 7 days
  Given localStorage has "mipime_first_launch" from 3 days ago
  When the user opens the app
  Then the app loads normally (TTL check passes)
```

```
Scenario: Launch after 7-day TTL expired
  Given localStorage has "mipime_first_launch" from 8 days ago
  When the user opens the app
  Then the app shows the ttl-expired blocking overlay
  And no other component or page renders
```

```
Scenario: Missing localStorage key (first launch)
  Given localStorage does not contain "mipime_first_launch"
  When the user opens the app in test mode
  Then localStorage key "mipime_first_launch" is set to the current ISO timestamp
  And the app loads normally (no blocking overlay)
```

```
Scenario: Production build is NOT affected
  Given the app is built with --configuration=production
  When the user opens the app
  Then the TTL initializer is NOT registered
  And the app loads normally with no expiry check
```

---

## Change 3 — Dark mode text visibility on jornada numbers

### What exists today
- `jornada-summary-card.component.html` — `<dd>` elements have `text-lg font-semibold` but **no** `dark:text-gray-100`, making them invisible in dark mode (text-gray-900 default on dark bg-gray-900).
- `jornada.page.html` (close modal) — the saldo_esperado display `<div>` already has `text-gray-900 dark:text-gray-100` (line 88), so it's already correct. But need to verify the rest of the modal.

### What changes
- `jornada-summary-card.component.html`: Add `dark:text-gray-100` to all 4 `<dd>` elements (monto_inicial, total_ventas, total_gastos, saldo_esperado).
- `jornada.page.html`: Verify all numeric value spans in the close modal use `dark:text-gray-100`. If the saldo_esperado div is already correct (it is), no change needed there.

### Requirements
1. All numeric values in the jornada summary card MUST be readable in dark mode.
2. The change MUST use the same pattern as the rest of the codebase: `text-gray-900 dark:text-gray-100`.
3. No functional change to any component.

### Acceptance scenarios

```
Scenario: Jornada summary card in dark mode
  Given dark mode is enabled
  When viewing the jornada summary card
  Then all <dd> values (monto_inicial, total_ventas, total_gastos, saldo_esperado) are visible
  And they use text-gray-100 color (not default gray-900)
```

```
Scenario: Jornada summary card in light mode
  Given dark mode is disabled
  When viewing the jornada summary card
  Then all <dd> values use the default text-gray-900 color
  And there is no visual regression from the previous light mode appearance
```

---

## Change 4 — Remove A3/A4 entries from todo-mipime.md

### What exists today
- Lines 73–80 in `todo-mipime.md` contain two pending feature entries under "🔴 Prioridad Alta":
  - **A3. Editar / eliminar movimientos** — 3 lines
  - **A4. CRUD completo de productos desde la UI** — 5 lines

### What changes
- Delete lines 73–80 (both entries and the blank line between them).
- The remaining file structure is preserved. No other content changes.

### Requirements
1. A3 and A4 entries MUST be removed from the file.
2. The blank line between A3 and A4 MUST be removed.
3. No other content in `todo-mipime.md` is modified.

### Acceptance scenarios

```
Scenario: A3 and A4 removed
  Given the file todo-mipime.md
  When searching for "A3." or "A4."
  Then neither string is found in the file
  And the "🔴 Prioridad Alta" section contains no entries
```

```
Scenario: Remaining content preserved
  Given the file todo-mipime.md after the change
  Then all completed items, B4, C7, and other entries remain unchanged
  And the "🔴 Prioridad Alta" section heading still exists (may be empty or removed)
```
