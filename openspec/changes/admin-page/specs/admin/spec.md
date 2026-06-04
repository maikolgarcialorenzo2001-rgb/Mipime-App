# Delta Specs: AdminPage — CRUD de usuarios

> Change to implement user management in the admin panel (AdminPage + UserService).

**Based on**: `openspec/auth-y-pages-restantes/spec.md` — ADMIN-1, ADMIN-2, ADMIN-3
**Status**: Existing requirements are now split, refined, and superseded by this delta.

---

## MODIFIED Requirements

### Requirement: ADMIN-1 — Crear usuario

The system MUST allow an authenticated admin user to create a new user with `nombre`, `password`, and `rol` (`admin` | `trabajador`).
(Previously: Admin can create workers with nombre, email, password. Reject duplicate email.)

- The `nombre` does NOT need to be unique — múltiples usuarios pueden compartir nombre. Cada uno se autentica con su contraseña (el auth loop en `AuthService._loginAsync` itera todos los que coincidan y loguea al que tenga la contraseña correcta).
- La tabla `usuarios` NO tiene constraint UNIQUE en `nombre`.
- The password MUST be hashed with `generateSalt()` + `hashPassword()` before INSERT.
- The `created_at` and `updated_at` MUST be set to the current ISO timestamp.
- The campo `email` is REMOVED — login is nombre-only (migration v3).

#### Scenario: Crear usuario exitosamente

- GIVEN an admin is authenticated and the form has `nombre`, `password`, and `rol` filled with valid values
- WHEN the admin submits the form
- THEN the system INSERTs a new row in `usuarios` with hashed password
- AND the new user appears in the table immediately
- AND the form resets

#### Scenario: Crear usuario con mismo nombre que otro existente

- GIVEN a user with nombre "juan" already exists
- WHEN the admin submits the form with nombre "juan" and a different password
- THEN the system INSERTs a new row with nombre "juan" (no error)
- AND both "juan" users appear in the table
- AND cada uno loguea con su propia contraseña y obtiene su rol

---

### Requirement: ADMIN-2 — Listar usuarios

The system MUST display all users in a table (excluding `password_hash` and `salt`).
(Previously: List all users in a table.)

- The table MUST show: `nombre`, `rol` (as "Admin" / "Trabajador"), `activo` (as "Activo" / "Inactivo"), `created_at` (formatted).
- The seed admin user (`nombre = 'admin'`) MUST appear in the list with a visual indicator that it is protected.
- The current user MUST be visually distinguishable in the list (e.g., "(usted)" label).
- If the table is empty (should not happen due to seed admin), show `<app-empty-state>`.

#### Scenario: Listar usuarios con datos

- GIVEN there are 3 users in the database
- WHEN the page loads
- THEN the table shows all 3 users with nombre, rol, estado, and created_at columns
- AND sensitive fields (password_hash, salt) are NOT returned

#### Scenario: Listar sin usuarios (borde)

- GIVEN the usuarios table is empty (after DB reset)
- WHEN the page loads
- THEN `<app-empty-state>` is shown with "No hay usuarios registrados"

---

### Requirement: ADMIN-3 — Toggle activo/inactivo

The system MUST let an admin toggle a user's `activo` status (0 ↔ 1).
(Previously: Toggle activo/inactive. Cannot deactivate self.)

- The system MUST prevent toggling the seed admin (`nombre = 'admin'`) — the button MUST be disabled.
- The system MUST prevent toggling the currently authenticated user — the button MUST be disabled with a tooltip "No puedes desactivarte a ti mismo".
- The list MUST re-render after toggling to reflect the new estado.

#### Scenario: Desactivar otro usuario

- GIVEN "maria" is active and the current admin is "admin"
- WHEN the admin clicks the toggle button for "maria"
- THEN the system UPDATEs `activo = 0` for maria
- AND the table shows maria as "Inactivo"

#### Scenario: Reactivar usuario

- GIVEN "maria" is inactive
- WHEN the admin clicks the toggle button for "maria"
- THEN the system UPDATEs `activo = 1` for maria
- AND the table shows maria as "Activo"

#### Scenario: No permite desactivar al seed admin

- GIVEN the user "admin" is the seed admin
- WHEN rendering the row
- THEN the toggle button is disabled with a disabled attribute
- AND the button has a tooltip "Usuario protegido"

#### Scenario: No permite desactivarse a sí mismo

- GIVEN the current user is "admin" and their own row is rendered
- WHEN rendering their own row
- THEN the toggle button is disabled
- AND the button has a tooltip "No puedes desactivarte a ti mismo"

---

## ADDED Requirements

### Requirement: ADMIN-4 — Cambiar rol

The system MUST allow an admin to change another user's role between `admin` and `trabajador`.

- The seed admin (`nombre = 'admin'`) role MUST NOT be changeable — the selector MUST be disabled.
- The current user's own role MUST be changeable (useful for self-demotion).
- The rol selector SHOULD be a dropdown with options "Admin" and "Trabajador".
- The change MUST persist immediately on selection change (no separate save button).

#### Scenario: Cambiar rol de admin a trabajador

- GIVEN "maria" has rol "admin" and current user is "admin"
- WHEN the current user selects "Trabajador" in maria's role dropdown
- THEN the system UPDATEs `rol = 'trabajador'` for maria
- AND the table shows maria's rol as "Trabajador"

#### Scenario: Cambiar rol del seed admin es bloqueado

- GIVEN the user "admin" is the seed admin
- WHEN rendering the seed admin's row
- THEN the role dropdown is disabled with a disabled attribute
- AND a tooltip reads "Usuario protegido"

---

### Requirement: ADMIN-5 — Resetear contraseña

The system MUST allow an admin to reset another user's password.

- The admin clicks "Resetear contraseña" → a prompt or inline form asks for the new password.
- The new password MUST be hashed with `generateSalt()` + `hashPassword()` and stored.
- The `updated_at` timestamp MUST be updated.
- The seed admin's password MAY be resettable (no special protection for password reset).

#### Scenario: Resetear contraseña de otro usuario

- GIVEN the admin is viewing the user list and "maria" exists
- WHEN the admin clicks "Resetear contraseña" for maria, enters "nuevaPass123", and confirms
- THEN the system generates a new salt, hashes "nuevaPass123", and UPDATEs maria's row
- AND `updated_at` is refreshed
- AND the admin sees a success message

#### Scenario: Contraseña vacía rechazada

- GIVEN the admin is resetting a password
- WHEN the admin submits an empty or whitespace-only password
- THEN the system does NOT update the password
- AND the error message "La contraseña no puede estar vacía" is shown

---

### Requirement: ADMIN-6 — UserService: Interfaz de operaciones

The `UserService` MUST expose these async methods returning `Promise<>`:

| Method | Signature | Description |
|--------|-----------|-------------|
| `list()` | `() => Promise<UsuarioPublico[]>` | SELECT all users, ordered by `created_at DESC`, return public type (no hash/salt) |
| `create(nombre, password, rol)` | `(nombre: string, password: string, rol: 'admin' \| 'trabajador') => Promise<UsuarioPublico>` | INSERT with hashed password. No uniqueness check on nombre — múltiples usuarios pueden compartir nombre |
| `toggleActivo(id)` | `(id: number) => Promise<void>` | Flip `activo` 0↔1. MUST NOT be called for seed admin or self |
| `updateRol(id, rol)` | `(id: number, rol: 'admin' \| 'trabajador') => Promise<void>` | UPDATE rol. MUST NOT be called for seed admin |
| `updatePassword(id, password)` | `(id: number, password: string) => Promise<void>` | UPDATE password_hash + salt. Reject empty password |

- The service MUST inject `DATABASE` token for SQL access.
- The service MUST inject `AuthService` to check current user and prevent self-deactivation.
- All methods MUST catch SQL errors and re-throw user-friendly messages.
- The service MUST be `@Injectable({ providedIn: 'root' })`.

---

### Requirement: ADMIN-7 — Diseño UI

The AdminPage MUST use the following layout:

```
+----------------------------------------------+
|  Administrar Usuarios              [Nuevo]   |
+----------------------------------------------+
|  Nombre  |  Rol  |  Estado  |  Creado | Acc. |
|  --------+-------+----------+---------+------|
|  admin   | Admin | Activo   | 01/01  | — 🔒 |
|  maria   | Trab. | Activo   | 02/01  | ⚡ 🔄 |
|  juan    | Trab. | Inactivo | 03/01  | ⚡ 🔄 |
+----------------------------------------------+
```

- "Nuevo usuario" button opens a form inline or in a modal with fields: nombre, contraseña, rol (select).
- The table uses Tailwind CSS only, no inline styles.
- Columns: Nombre, Rol, Estado, Creado, Acciones.
- The seed admin row shows a lock icon and disabled controls.
- The current user's row shows "(usted)" next to the nombre.
- Reuses: `<app-error-alert>`, `<app-empty-state>`, `<app-loading-spinner>` during async operations.
- Error states are cleared on next successful operation or dismissed manually.

#### Scenario: Carga con spinner

- GIVEN the page is loading users from the database
- WHEN the component initializes
- THEN `<app-loading-spinner>` is displayed until `list()` resolves

#### Scenario: Error de base de datos

- GIVEN the database connection fails during `list()`
- WHEN the page loads
- THEN `<app-error-alert>` shows the error message
- AND the empty table is not rendered

---

## REMOVED Requirements

### Requirement: ADMIN-1 (original) — email field

The original requirement `ADMIN-1` included `email` as a required field. The `email` column has been removed via migration v3. Login is now nombre-only.

(Reason: The `email` column was dropped from the schema in migration v3. Users authenticate by `nombre` alone.)

---

## Data Flow

```
AdminPage (component)
  │
  ├─ on init → UserService.list()
  │               └─ SELECT id, nombre, rol, activo, created_at, updated_at
  │                  FROM usuarios ORDER BY created_at DESC
  │
  ├─ create user → UserService.create(nombre, password, rol)
  │                   ├─ salt = generateSalt()
  │                   ├─ hash = hashPassword(password, salt)
  │                   ├─ INSERT INTO usuarios (...)
  │                   └─ return UsuarioPublico
  │
  ├─ toggle activo → UserService.toggleActivo(id)
  │                    ├─ Guard: id === seedAdmin.id → throw
  │                    ├─ Guard: id === currentUser.id → throw
  │                    └─ UPDATE usuarios SET activo = 1 - activo WHERE id = ?
  │
  ├─ update rol → UserService.updateRol(id, rol)
  │                  ├─ Guard: id === seedAdmin.id → throw
  │                  └─ UPDATE usuarios SET rol = ? WHERE id = ?
  │
  └─ reset pass → UserService.updatePassword(id, password)
                     ├─ Guard: password empty → throw
                     ├─ salt = generateSalt()
                     ├─ hash = hashPassword(password, salt)
                     └─ UPDATE usuarios SET password_hash=?, salt=?, updated_at=? WHERE id=?
```

## UI States

| State | Display |
|-------|---------|
| Loading | `<app-loading-spinner>` centered |
| Empty | `<app-empty-state message="No hay usuarios registrados">` |
| Error (list) | `<app-error-alert [message]="...">` above table area |
| Error (action) | `<app-error-alert [message]="...">` above table, keeps existing data |
| Success | Table rendered, no alert |

## Protected Identifiers

- **Seed admin ID**: obtained by querying `SELECT id FROM usuarios WHERE nombre = 'admin' AND rol = 'admin'` on service initialization (or cached). La primera fila que coincida se considera el seed.
- **Current user ID**: from `auth.usuario()?.id`.
- Guards are checked CLIENT-SIDE in the service before the SQL statement, but the SQL itself does not enforce the protection (no DB-level constraint for seed admin).
- **Duplicados**: como `nombre` no tiene UNIQUE, pueden existir múltiples usuarios con el mismo nombre. La identificación del seed admin usa nombre + rol para ser más precisa.
