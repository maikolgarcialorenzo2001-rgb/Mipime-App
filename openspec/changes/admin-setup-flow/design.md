# Design: admin-setup-flow

## Technical Approach

Replace hardcoded admin credentials in 3 environment files with a first-boot setup flow (`/setup`) that creates the initial admin user and stores `nombreComercio` in a new `config` table (migration v18). The existing seed in migration v2 is edited (justified exception to historical freeze) to not depend on `environment.*`. A `SetupGuard` on `/login` and `/setup` routes redirects based on `COUNT(usuarios)`. The "last active admin" rule replaces the name-based protection (`e.z`) with a query counting active admins. Legacy password detection runs in `AuthService._restoreSession` by verifying stored hashes against SHA-256(`salt` + `softwarez`/`admin123`); on first detection, user is redirected to `/setup?mode=reset&userId=X` with a one-time `config.legacy_reset_done` flag. All changes use existing patterns: standalone components, functional guards, `providedIn: 'root'` services, Signals, and the shared migration runner.

## Architecture Decisions

### Decision: Config Table Schema (v18)

**Choice**: Key-value table `config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)`

**Alternatives considered**:
- Fixed columns: `nombre_comercio`, `legacy_reset_done`, ... — rigid, requires schema changes for new flags
- JSON blob in single row — harder to query/index, overkill for simple flags

**Rationale**: Key-value matches SQLite's flexibility, allows adding flags without migrations, and is trivial to query/upsert. Only three keys needed initially (`nombre_comercio`, `legacy_reset_done`, `seedProducts`), but extensible.

### Decision: Seed v2 Edit Strategy

**Choice**: Replace `environment.adminUser`/`adminPassword` references in `migrationV2` with a no-op seed (admin creation deferred to `/setup` page). Keep the `usuarios` table creation intact.

**Alternatives considered**:
- Remove seed entirely from v2 — breaks fresh installs that expect a user to exist post-migration
- Keep seed but use hardcoded values — defeats the purpose of removing env credentials

**Rationale**: The seed in v2 is the *only* place `environment.adminUser`/`adminPassword` are used at runtime. Editing v2 is a justified exception to the "migrations are frozen" rule because: (a) it's the root cause of the credential exposure, (b) the change is surgical (only the seed block), (c) fresh-install tests will validate the new flow end-to-end.

### Decision: SetupGuard Placement

**Choice**: `CanActivateFn` on both `/login` and `/setup` routes. `/login` → `/setup` when 0 users; `/setup` → `/pos` when users exist.

**Alternatives considered**:
- APP_INITIALIZER check — runs once at bootstrap, doesn't handle navigation after login/logout
- AuthService-driven redirect in LoginPage — couples page to routing logic

**Rationale**: Functional guards are the project pattern (`authGuard`, `adminGuard`). Guard runs on every navigation, handles all entry points (deep links, refresh), and keeps pages clean.

### Decision: SetupService as Root-Provided Service

**Choice**: `SetupService` with `providedIn: 'root'`, injected `DATABASE`, methods: `countUsers()`, `createInitialAdmin(nombre, password, nombreComercio, seedProducts)`, `getConfig()`, `setConfig()`.

**Alternatives considered**:
- Logic inline in SetupPage — violates separation, hard to test
- APP_INITIALIZER factory — runs at bootstrap, not on-demand

**Rationale**: Service encapsulates DB logic, testable with mocked `DATABASE`, reusable by guard and page. Matches `UserService`/`AuthService` pattern.

### Decision: Seed de Productos en Setup

**Choice**: `createInitialAdmin(nombre, password, nombreComercio, seedProducts: boolean)` — a 4th param carrying the toggle decision. Internally persists `config.seedProducts` (`'1'`/`'0'`) and, when true, calls an exported `seedProductosSiVacio(exec)` from db-migrations (rename of the existing `seedIfEmpty`, logic unchanged). Existing `runMigrations` callers stay untouched.

**Alternatives considered**:
- New `productos-seed.ts` module — moves ~90 lines (74 products + batch insert): more diff churn and a new file to review for identical logic
- Separate `seedProductos()` method on `SetupService` — decouples the seed from admin creation, risking a seed without an admin and a non-transactional decision
- Keep `environment.seedEnabled` as the control — contradicts the requirement: the control moves to runtime (setup decision), not build-time

**Rationale**: The existing logic is idempotent (`SELECT COUNT(*) FROM productos`, returns if count > 0) and already tested. Rename+export is surgical (~2 lines) and keeps `runMigrations`/callers intact (`seedEnabled` still governs pre-setup). A single `createInitialAdmin` call keeps the setup transactional: admin, business name, and seed in one persisted, testable invocation. `config` stays a key-value table — no schema change.

### Decision: Legacy Password Detection in `_restoreSession`

**Choice**: In `AuthService._restoreSession`, after restoring session from localStorage, verify if the user's stored `password_hash` equals `SHA-256(salt + 'softwarez')` OR `SHA-256(salt + 'admin123')`. If match AND `config.legacy_reset_done` is not true → set a signal flag, redirect to `/setup?mode=reset&userId=X`.

**Alternatives considered**:
- Check on login only — misses restored sessions
- Add `is_legacy` column to `usuarios` — schema change, not needed for one-time migration

**Rationale**: `_restoreSession` runs on every app start (including restored tabs), catches all legacy users. No schema change needed. Uses existing `hashPassword` utility. Flag in `config` table persists across logins.

### Decision: Last Active Admin Rule Implementation

**Choice**: `UserService.getActiveAdminCount()` → `COUNT(*) FROM usuarios WHERE rol='admin' AND activo=1`. `toggleActivo`/`updateRol` call this and throw if count === 1 and target is admin. `AdminPage` disables controls via computed signal.

**Alternatives considered**:
- Database CHECK constraint — can't express cross-row logic
- Trigger — opaque, hard to test, SQLite triggers are limited

**Rationale**: Service-side enforcement is the single source of truth. UI reflects via computed signal (reactive, no manual subscription). Replaces current `environment.adminUser` name check with semantic rule.

## Data Flow

```
App Bootstrap
     │
     ▼
APP_INITIALIZER → Database.initialize() → runMigrations(v1..v18) → config table exists
     │
     ▼
AuthService constructor → _restoreSession()
     │
     ├─ Session valid? ──Yes──→ _currentUser.set(session) ──→ App ready
     │
     └─ No ──→ Check legacy hash (if session had user)
                │
                ├─ Legacy + !legacy_reset_done ──→ legacyResetRequired.set(true) + redirect /setup?mode=reset&userId=X
                │
                └─ Normal ──→ No session → LoginPage

Navigation to /login
     │
     ▼
SetupGuard.canActivate()
     │
     ├─ countUsers() === 0 ──→ redirect /setup
     │
     └─ countUsers() > 0 ──→ allow /login

Navigation to /setup
     │
     ▼
SetupGuard.canActivate()
     │
     ├─ countUsers() > 0 ──→ redirect /pos (or /login if not auth)
     │
     └─ countUsers() === 0 ──→ allow SetupPage

SetupPage.onSubmit()
     │
     ▼
SetupService.createInitialAdmin(nombre, password, nombreComercio, seedProducts)
     │
     ├─ INSERT INTO usuarios (..., rol='admin', activo=1)
     │
     ├─ INSERT INTO config (clave, valor) VALUES ('nombre_comercio', ?)
     │
     ├─ INSERT INTO config (clave, valor) VALUES ('seedProducts', ?)   -- '1' | '0'
     │
     ├─ seedProducts='1' AND productos vacía? ──Yes──→ seedProductosSiVacio(exec) → 74 items, stock 0
     │                                    └─ No ──→ catálogo vacío / intacto (idempotente)
     │
     └─ AuthService.login(nombre, password) → session → redirect /pos
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/environments/environment.ts` | Modify | Remove `adminUser`, `adminPassword`; keep other props |
| `src/app/environments/environment.prod.ts` | Modify | Remove `adminUser`, `adminPassword` |
| `src/app/environments/environment.test.ts` | Modify | Remove `adminUser`, `adminPassword`; keep `seedEnabled: true` for tests |
| `src/app/services/db-migrations.ts` | Modify | Edit `migrationV2`: remove seed block using `environment.*`; add `migrationV18` creating `config` table; rename+export `seedIfEmpty` → `seedProductosSiVacio` (reusable, logic unchanged) |
| `electron/db.ts` | Modify | `MAX_SCHEMA_VERSION` 17 → 18 |
| `src/app/guards/setup.guard.ts` | Create | `CanActivateFn` for `/login` (→ `/setup` if 0 users) and `/setup` (→ `/pos` if users exist) |
| `src/app/services/setup.service.ts` | Create | `SetupService` with `countUsers()`, `createInitialAdmin(nombre, password, nombreComercio, seedProducts)`, `getConfig()`, `setConfig()` — persists `config.seedProducts`; calls `seedProductosSiVacio` when enabled |
| `src/app/pages/setup/setup.page.ts` | Create | Standalone component: form (admin nombre, password, nombreComercio, seedProducts toggle), mode=reset support, loading/error states |
| `src/app/pages/setup/setup.page.html` | Create | Template following login.page.html pattern (centered card, Tailwind, ErrorAlertComponent, seedProducts toggle) |
| `src/app/pages/setup/setup.page.css` | Create | Minimal styles (reuse login patterns) |
| `src/app/services/user.service.ts` | Modify | Add `getActiveAdminCount()`; replace `environment.adminUser` checks in `toggleActivo`/`updateRol` with count-based logic |
| `src/app/pages/admin/admin.page.ts` | Modify | Remove `seedAdminId` computed; add `activeAdminCount` signal/computed; disable deactivation/rol change when count === 1 |
| `src/app/pages/admin/admin.page.html` | Modify | Bind disabled state to `activeAdminCount() === 1`; show warning tooltip/message |
| `src/app/services/auth.service.ts` | Modify | In `_restoreSession`: add legacy hash verification; add `legacyResetRequired` signal; redirect logic |
| `src/app/app.routes.ts` | Modify | Add `/setup` route with `SetupPage` lazy load; apply `setupGuard` to `/login` and `/setup` |
| `src/app/app.config.ts` | Modify | No change needed (APP_INITIALIZER already runs migrations) |

## Interfaces / Contracts

```typescript
// src/app/services/setup.service.ts
// import { seedProductosSiVacio } from './db-migrations';
// createInitialAdmin → setConfig('nombre_comercio'), setConfig('seedProducts', '1'|'0'),
//   and if seedProducts: await seedProductosSiVacio(this._db) (idempotent)
@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly _db = inject(DATABASE);

  async countUsers(): Promise<number> { ... }

  async createInitialAdmin(
    nombre: string,
    password: string,
    nombreComercio: string,
    seedProducts: boolean
  ): Promise<UsuarioPublico> { ... }

  async getConfig(clave: string): Promise<string | null> { ... }

  async setConfig(clave: string, valor: string): Promise<void> { ... }
}
```

```typescript
// src/app/guards/setup.guard.ts
export const setupGuard: CanActivateFn = (route) => {
  const setup = inject(SetupService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return setup.countUsers().then((count) => {
    const isSetupRoute = route.routeConfig?.path === 'setup';
    if (count === 0) {
      return isSetupRoute ? true : router.parseUrl('/setup');
    }
    if (isSetupRoute) {
      return auth.isLoggedIn() ? router.parseUrl('/pos') : router.parseUrl('/login');
    }
    return true;
  });
};
```

```typescript
// src/app/services/auth.service.ts (additions)
readonly legacyResetRequired = signal(false);

private async _checkLegacyPassword(user: Usuario): Promise<boolean> {
  const legacyHashes = [
    await hashPassword('softwarez', user.salt),
    await hashPassword('admin123', user.salt),
  ];
  return legacyHashes.includes(user.password_hash);
}
```

```sql
-- migrationV18 in db-migrations.ts
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO schema_version (version) VALUES (18);
-- Keys: nombre_comercio (TEXT), legacy_reset_done ('1'/'0'), seedProducts ('1'/'0')
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `SetupService.countUsers`, `createInitialAdmin` (incl. `seedProducts` on/off), `getConfig`/`setConfig` | Mock `DATABASE` with `vi.fn()`, spy `seedProductosSiVacio`; verify SQL calls, `config.seedProducts` value, seed called/skipped |
| Unit | `setupGuard` redirections (0 users, >0 users, authenticated) | Mock `SetupService`, `AuthService`, `Router`; test `CanActivateFn` return values |
| Unit | `UserService.getActiveAdminCount`, `toggleActivo`/`updateRol` blocking | Mock `DATABASE`, test count query and throw conditions |
| Unit | `AuthService._restoreSession` legacy detection | Mock `DATABASE` returning user with known legacy hash; verify redirect flag set |
| Unit | `seedProductosSiVacio` idempotencia | Mock `DATABASE`: count=0 → 74 inserts; count>0 → no-op |
| Integration | SetupPage form submission → service → DB → login → redirect (seed on / seed off) | Mount `SetupPage` with TestBed, mock services, simulate submit with toggle both ways, verify navigation + `config.seedProducts` |
| Integration | Fresh install: migrations v1..v18 run, config table created, `/setup` accessible | Spin up `SqliteService` with real SQLocal in Vitest, run `initialize()`, query `schema_version` |
| Integration | Existing DB at v17 upgrades to v18, config table created, data intact | Use `runMigrations` with executor hitting test DB at v17, verify v18 applied |
| E2E | Fresh install flow: `/login` → `/setup` → form → `/pos` authenticated | Playwright/Vitest browser mode: no DB → setup page → create admin + negocio → POS |
| E2E | Legacy user `e.z`/`softwarez` login → forced reset once → new password works | Seed v2 with legacy hash, login, verify redirect to `/setup?mode=reset`, submit new pass, verify login |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

1. **Migration v18** runs automatically via `APP_INITIALIZER` on first app start after upgrade. Creates `config` table. No data loss (additive).
2. **Fresh installs**: `runMigrations` runs v1..v18 sequentially. `migrationV2` creates `usuarios` table but **does not seed admin**. `SetupGuard` detects 0 users → `/setup`.
3. **Existing installs (pre-v18)**: Migration v18 adds `config` table. `SetupGuard` sees users exist → normal `/login`. Legacy users (`e.z`/`softwarez` or `admin`/`admin123`) detected on `_restoreSession` → forced reset once.
4. **Backup/restore**: Schema version 18 included in `validateDb()` check (`MAX_SCHEMA_VERSION=18` in electron). Backups include `config` table. Restore validates schema version ≤ 18.
5. **Env files**: All 3 updated atomically in same commit. `fileReplacements` in `angular.json` unchanged (shapes intact).

## Resolved Decisions (Binding — user-confirmed 2026-08-29)

1. **Un solo admin en el flujo setup**: `SetupService.createInitialAdmin` crea únicamente el admin inicial. No se crea usuario "trabajador" por defecto (fuera de scope). Admins adicionales se crean luego desde `AdminPage`.
2. **`nombreComercio` con límite de 18 caracteres**: el campo valida un máximo de 18 chars (UI: `maxlength` + validación en el form). La tabla `config.valor` sigue siendo `TEXT` (el límite es de dominio, no de esquema). Si durante el apply surgiera complejidad inesperada que haga el límite un trabajo especializado, se marca como pendiente (follow-up) la modificación para aceptar solo 18 y se entrega sin límite por ahora — esto NO bloquea el PR.
3. **Usuario trabajador default en setup**: fuera de scope (confirmado).
4. **Seed opcional en setup**: el form de setup incorpora un toggle para habilitar el seed de productos (catálogo de ejemplo de 74 items, stock 0). La decisión se persiste en `config.seedProducts` (`'1'`/`'0'`). El seed se ejecuta solo si `productos` está vacía (idempotente, reusando la lista actual vía `seedProductosSiVacio` exportada desde db-migrations). `seedEnabled` de environments NO cambia (`environment.test.ts` true; dev/prod false) y los callers de `runMigrations` no se tocan; el control para instalaciones nuevas pasa a runtime vía SetupService. Confirmado 2026-08-29.

---