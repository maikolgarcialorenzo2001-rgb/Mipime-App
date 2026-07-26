# Design: prod-improvements-julio-2026

## Architecture Decisions

### AD-1: Single-line call in `next` callback (Change 1)
- **Decision**: Add `this._jornadaService.refreshJornadaAbierta()` as the last line inside the `next` callback of `confirmarVenta()`.
- **Rationale**: The service method already exists and is tested. The current code already follows this pattern for movement registration (`jornada.page.ts:69`). No new service, no new DI, no error handling needed (the service handles its own errors internally — sets `jornadaAbierta` to null on failure).
- **Tradeoff**: If the refresh fails, the signal goes to `null`. This is the same behavior as the movement path, so it's acceptable. A stale signal is worse than a null one briefly.

### AD-2: TTL stored in localStorage, checked via APP_INITIALIZER (Change 2)
- **Decision**: Use `localStorage` for TTL persistence and Angular's `APP_INITIALIZER` injection token for the bootstrap-time check.
- **Rationale**: localStorage is simple, survives page reloads, and doesn't require a backend. APP_INITIALIZER blocks Angular bootstrap until the Promise resolves, ensuring the blocking overlay renders before any page content.
- **Tradeoff**: localStorage can be cleared by the user — we treat missing key as "expired" (fail-safe). A server-side check would be more robust but contradicts the "client-only demo" use case.

### AD-3: Production clone for environment.test.ts (Change 2)
- **Decision**: `environment.test.ts` is a direct copy of `environment.prod.ts` with `ttlDays: 7, testMode: true` added.
- **Rationale**: The test build must simulate production behavior (same db, same credentials, seed disabled) with only the TTL gating added. Deriving from dev would include dev data/seed that shouldn't exist in a demo.
- **Tradeoff**: Duplication of the prod config. Acceptable because the config is 7 lines and admins can tweak independently.

### AD-4: TTL initializer registered conditionally (Change 2)
- **Decision**: In `app.config.ts`, register the TTL initializer only when `environment.testMode === true`.
- **Rationale**: Zero overhead in production/dev builds. The initializer file is tree-shaken if unused (no direct import in non-test configs).

### AD-5: Dark mode classes follow existing pattern (Change 3)
- **Decision**: Use `text-gray-900 dark:text-gray-100` on `<dd>` elements, matching the existing pattern used throughout the app (e.g., `jornada.page.html:88`).
- **Rationale**: Consistency with existing Tailwind 4 dark mode implementation. No new CSS or component changes needed.

### AD-6: Hard delete from todo-mipime.md (Change 4)
- **Decision**: Delete lines 73–80 directly — no git mv, no comments, no placeholder.
- **Rationale**: These are "future candidate" entries, not active code. If they're needed later, git history preserves them. Keeping dead entries in a living TODO is misleading.

---

## Change 1 — Jornada refresh after POS sale

### File: `src/app/pages/pos/pos.page.ts`

**Current state (line ~214-221):**
```typescript
next: () => {
  this.showModal.set(false);
  this.cart.limpiar();
  this.successMessage.set('¡Venta registrada con éxito!');
  setTimeout(() => this.successMessage.set(null), 2000);
  this._buscar(this.query());
  this.searchInput()?.nativeElement.focus();
},
```

**After change — add one line after `focus()`:**
```typescript
next: () => {
  this.showModal.set(false);
  this.cart.limpiar();
  this.successMessage.set('¡Venta registrada con éxito!');
  setTimeout(() => this.successMessage.set(null), 2000);
  this._buscar(this.query());
  this.searchInput()?.nativeElement.focus();
  this._jornadaService.refreshJornadaAbierta();
},
```

**Why after `focus()`:** The refresh is fire-and-forget. The service handles its own error state. Placing it last ensures all other post-sale side effects (cart clear, UI reset, stock refresh) run first.

**Lines changed:** 1 line added.

---

## Change 2 — Test environment with 7-day TTL

### File: `src/app/environments/environment.test.ts` (NEW)

```typescript
export const environment = {
  production: true,
  dbName: 'mipime-prod.db',
  adminUser: 'e.z',
  adminPassword: 'softwarez',
  seedEnabled: false,
  ttlDays: 7,
  testMode: true,
};
```

**Interface implications:** The `environment` object now has optional `ttlDays?: number` and `testMode?: boolean`. The other environment files do NOT need these fields (they're `undefined` by default, which is falsy).

### File: `angular.json`

Add a `"test"` configuration under `build.configurations`:

```json
"test": {
  "fileReplacements": [
    {
      "replace": "src/app/environments/environment.ts",
      "with": "src/app/environments/environment.test.ts"
    }
  ]
}
```

Copy existing production `budgets` and `outputHashing` into the test config since test should mirror production behavior:

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

### File: `src/app/initializers/ttl-check.ts` (NEW)

**Architecture — TTL initializer factory:**

```
┌─────────────────────────────────────────────┐
│ APP_INITIALIZER factory function             │
│                                              │
│   if (!environment.testMode)                 │
│     return Promise.resolve(true)  ← no-op    │
│                                              │
│   const stored = localStorage.getItem(       │
│     'mipime_first_launch'                    │
│   )                                          │
│                                              │
│   if (!stored) {                             │
│     // FIRST LAUNCH                          │
│     localStorage.setItem(                    │
│       'mipime_first_launch',                 │
│       new Date().toISOString()               │
│     )                                        │
│     return Promise.resolve(true)  ← OK       │
│   }                                          │
│                                              │
│   const firstLaunch = new Date(stored)       │
│   const now = new Date()                     │
│   const diffDays = (now - firstLaunch) /     │
│                   (1000 * 60 * 60 * 24)      │
│                                              │
│   if (diffDays > environment.ttlDays) {      │
│     // EXPIRED — store expiry info & block   │
│     localStorage.setItem(                    │
│       'mipime_ttl_expired',                 │
│       now.toISOString()                      │
│     )                                        │
│     return Promise.resolve(false)  ← block   │
│   }                                          │
│                                              │
│   return Promise.resolve(true)  ← still OK   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ttl-expired.component                       │
│ (guarded by *ngIf / @if in root template)   │
│                                              │
│ Renders full-screen overlay:                 │
│   - "Mipime-Cuentas" title                   │
│   - "Versión de prueba expirada"             │
│   - Expiry date from localStorage            │
│   - "Contactar al desarrollador"             │
│   - No close/escape (user cannot bypass)     │
└─────────────────────────────────────────────┘
```

**Implementation details:**
- The factory returns a `Promise<boolean>`. Angular awaits the promise; if it resolves to `false`, Angular considers initialization failed. However, we don't want Angular to error-log or crash — we want a graceful UI. Therefore:
  - When expired, the factory stores the expiry info in localStorage and resolves `true` (allowing bootstrap), BUT stores a flag `mipime_ttl_expired`.
  - The root component (`App`) checks `localStorage.getItem('mipime_ttl_expired')` and conditionally renders `ttl-expired` instead of `<router-outlet>`.
  - Alternative simpler approach: have the initializer itself throw or reject, and catch it at the app root. But that's less clean.

  **Simpler and preferred approach:** The initializer runs and sets a global signal or just stores a marker in localStorage. The `App` component (or a wrapper) checks this marker and renders the overlay. But since `App` is a standalone component template, we need a way to conditionally show the overlay.

  **Even simpler approach (recommended):** The initializer factory checks TTL. If expired, it directly manipulates the DOM to show the overlay BEFORE Angular bootstrap completes. It returns a NEVER-ENDING promise (or throws) to prevent Angular from rendering. This is a pattern used in many Angular apps for "maintenance mode" checks.

  Wait — that would prevent Angular from initializing at all. But the overlay needs Angular (it uses `ttl-expired.component`). Let me reconsider.

  **Recommended pattern:** 
  1. The initializer checks TTL. If expired, it sets `localStorage.setItem('mipime_ttl_expired', 'true')` and resolves `true`. 
  2. The root template (`app.html`) checks this key:
  ```html
  @if (!ttlExpired()) {
    <router-outlet />
  } @else {
    <app-ttl-expired />
  }
  ```
  3. `App` component reads from localStorage in its constructor.

  Actually, for a clean solution: since the initializer runs before anything else, we can have it set a value on a global injectable. But simpler: just have `App` component check `localStorage`.

  **Final design:**
  
  ```typescript
  // ttl-check.ts
  export const ttlCheckInitializer = (): (() => Promise<boolean>) => {
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
        localStorage.setItem('mipime_ttl_expired', 'true');
      }
      
      return Promise.resolve(true);
    };
  };
  ```

  ```typescript
  // app.ts
  export class App {
    ttlExpired = signal(false);
    
    constructor() {
      if (localStorage.getItem('mipime_ttl_expired')) {
        this.ttlExpired.set(true);
      }
    }
  }
  ```

  ```html
  <!-- app.html -->
  @if (ttlExpired()) {
    <app-ttl-expired />
  } @else {
    <router-outlet />
  }
  ```

  This is clean, testable, and doesn't block Angular bootstrap.

### File: `src/app/components/ttl-expired/ttl-expired.component.ts` (NEW)

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-ttl-expired',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-950">
      <div class="text-center max-w-md mx-auto p-8">
        <div class="text-6xl mb-6">⏰</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Mipime-Cuentas
        </h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Versión de prueba expirada
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Esta versión de prueba ya no está disponible.
          Contactá al desarrollador para obtener una nueva versión.
        </p>
        <div class="text-xs text-gray-400">
          mipime-cuentas@ejemplo.com
        </div>
      </div>
    </div>
  `,
})
export class TtlExpiredComponent {}
```

Wait, the user said "no emojis unless explicitly requested". But this is a UI string inside a component template — the Persona Scope rule says UI copy is exempt from persona rules and defaults to English, but emojis are about content, not persona. The rule says "Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked." Let me drop the emoji and use a more subdued approach.

Actually let me reconsider — the "⏰" emoji is used as a decorative icon in the component template. The restriction says "Only use emojis if the user explicitly requests it." This seems to apply to communication and file content. Let me use a material icon instead since the project already uses Material Symbols.

Let me redesign using Material Icons which the project already uses.

### File: `src/app/components/ttl-expired/ttl-expired.component.ts` (NEW)

```typescript
import { Component } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-ttl-expired',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-950">
      <div class="text-center max-w-md mx-auto p-8">
        <span class="material-symbols-outlined text-6xl text-gray-400 mb-6">
          timer_off
        </span>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Mipime-Cuentas
        </h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Versión de prueba expirada
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Esta versión de prueba ya no está disponible.
          Contactá al desarrollador para obtener una nueva versión.
        </p>
        <div class="text-xs text-gray-400">
          mipime-cuentas&#64;ejemplo.com
        </div>
      </div>
    </div>
  `,
})
export class TtlExpiredComponent {}
```

Actually wait — @ is a special character in Angular templates. Let me use `&#64;` for the email.

Hmm, but this might not be needed for the design doc. Let me keep it simple and just describe the component — I can finalize the exact template in implementation.

### File: `src/app/app.config.ts`

Add the TTL initializer provider:

```typescript
import { APP_INITIALIZER } from '@angular/core';
import { environment } from './environments/environment';
import { ttlCheckInitializer } from './initializers/ttl-check';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideDatabase(SqliteService),
    { provide: LOCALE_ID, useValue: 'es' },
    ...(environment.testMode
      ? [{ provide: APP_INITIALIZER, useFactory: ttlCheckInitializer, multi: true }]
      : []),
  ],
};
```

### File: `src/app/app.ts` and `src/app/app.html`

Read `mipime_ttl_expired` from localStorage and conditionally render overlay.

**Lines changed:** ~5 (app.ts: add constructor with signal check, app.html: add @if block)

---

## Change 3 — Dark mode text visibility

### File: `src/app/components/jornada-summary-card/jornada-summary-card.component.html`

Change each `<dd>` from:
```html
<dd class="text-lg font-semibold">${{ ... }}</dd>
```
to:
```html
<dd class="text-lg font-semibold text-gray-900 dark:text-gray-100">${{ ... }}</dd>
```

All 4 `<dd>` elements.

### File: `src/app/pages/jornada/jornada.page.html`

The saldo_esperado display at line 88 **already has** `text-gray-900 dark:text-gray-100`. Verify no other numeric `<dd>` or `<span>` in the modal section lacks the dark class. Based on reading lines 84-91, only that one value exists in the close modal section and it's already correct. **No change needed** for this file.

**Lines changed:** 4 (adding a CSS class to 4 elements in one file).

---

## Change 4 — Remove A3/A4 from todo-mipime.md

### File: `todo-mipime.md`

Delete lines 73–80 (inclusive):
```
### A3. Editar / eliminar movimientos
**Contexto:** Hoy los movimientos (gastos/ingresos_extra) solo se pueden registrar, no modificar ni eliminar.
**Posible approach:** Botones editar/eliminar en cada fila del formulario de movimientos en JornadaPage.

### A4. CRUD completo de productos desde la UI
**Contexto:** `ProductosPage` solo lista y busca. `AdminPage` solo maneja usuarios. No hay forma de crear, editar o eliminar productos desde la app; solo existen los 50 productos del seed en `sqlite.service.ts`.
**Nota:** El `ProductoService` ya tiene métodos `crear()` y `eliminar()` — solo falta la UI para usarlos.
**Posible approach:** Formulario de alta/edición en AdminPage o ProductosPage. Confirmación para baja.
```

After deletion, the `## 🔴 Prioridad Alta` heading is immediately followed by `---` (the section separator). The section is now empty, which is fine — the heading can stay or be removed. **Recommendation**: keep the heading to avoid shifting the rest of the file. In future changes, it can be removed.

**Lines changed:** 8 lines deleted.

---

## File Change Summary

| File | Status | Lines Δ | Change |
|------|--------|---------|--------|
| `src/app/pages/pos/pos.page.ts` | Modified | +1 | Call `refreshJornadaAbierta()` after sale |
| `src/app/environments/environment.test.ts` | **New** | +8 | Test env config (prod clone + ttl) |
| `angular.json` | Modified | +18 | Add `test` build config with fileReplacements |
| `src/app/initializers/ttl-check.ts` | **New** | +35 | TTL check factory |
| `src/app/components/ttl-expired/ttl-expired.component.ts` | **New** | +35 | Blocking overlay component |
| `src/app/app.config.ts` | Modified | +5 | Register TTL initializer conditionally |
| `src/app/app.ts` | Modified | +5 | Read ttlExpired signal |
| `src/app/app.html` | Modified | +3 | Conditional render ttl-expired |
| `src/app/components/jornada-summary-card/jornada-summary-card.component.html` | Modified | +4 | Add dark:text-gray-100 to 4 `<dd>` |
| `todo-mipime.md` | Modified | -8 | Remove A3/A4 entries |

**Total: ~106 lines changed (including 2 new files, ~78 lines new, ~8 lines deleted).**
