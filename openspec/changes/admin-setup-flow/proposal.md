# Propuesta: admin-setup-flow

## Intent
Eliminar credenciales admin hardcodeadas (3 env files) expuestas en binario/repo (S1-2/BACKLOG-15, ALTO). Flujo **primer arranque** (`/setup`): crear admin + `nombreComercio`. Regla **"último admin activo"** reemplaza protección por nombre `e.z`. Cierre backdoor: **detección runtime + reset forzado** passwords legacy (`softwarez`, `admin123`). Upgrade criptográfico → **PR2 `hashing-upgrade`**.

## Scope
**In**: Quitar credenciales de 3 env files. Editar migración v2 seed sin `environment.*` (excepción justificada). Guard `/setup` + `SetupService`; detección `COUNT(usuarios)==0`. Página `/setup` (admin + `nombreComercio`) molde `login.page.html`. **Migración v18**: tabla `config` para `nombreComercio`/flags; `MAX_SCHEMA_VERSION` 17→18. Regla **"último admin activo"** en `UserService` + UI `AdminPage`. Detección runtime + reset forzado (explore B1): verifica hash legacy contra `'softwarez'`/`'admin123'` → exige nueva contraseña once. Sin schema change; flag `config.legacy_reset_done`. Specs + TDD estricto.

**Out**: "Cambiar mi contraseña" no-admin. bcryptjs/argon2id + rehash-on-login → PR2. Wiring `nombreComercio` en UI/Excel. Limpieza jornadas huérfanas.

## Capabilities
- **New**: `setup-flow`, `legacy-admin-reset`.
- **Modified**: `login`, `user-management`.

## Approach
1. Env cleanup: quitar credenciales (3).
2. Migración v2: editar seed sin `environment.*`; test fresh-install.
3. v18 config: `CREATE TABLE config(...)` + `MAX_SCHEMA_VERSION=18`.
4. Setup guard/service: `setupGuard` en `/login`→`/setup` si 0 usuarios; inverso en `/setup`.
5. Setup page: `SetupPage` standalone (molde login), form admin + `nombreComercio`; persiste en `config` + crea usuario.
6. Último admin activo: `UserService` consulta `COUNT(*) WHERE rol='admin' AND activo=1`; bloquea si count==1. `AdminPage` deshabilita botones.
7. Reset forzado legacy: en `AuthService._restoreSession`, verifica hash legacy → `/setup?mode=reset&userId=X`. Flag one-time.
8. Specs: invertir seed v2; mock environment; cubrir guard, service, page, regla, reset.

## Affected Areas
- `src/app/environments/*.ts` — quitar credenciales (3)
- `src/app/services/db-migrations.ts` — seed v2 + v18 config
- `electron/db.ts` — `MAX_SCHEMA_VERSION` 17→18
- `src/app/guards/setup.guard.ts` — CanActivateFn `/login` `/setup`
- `src/app/services/setup.service.ts` — SetupService
- `src/app/pages/setup/` — setup.page.*
- `src/app/services/user.service.ts` — regla "último admin activo"
- `src/app/pages/admin/admin.page.ts/.html` — quitar `seedAdminId`; disabled
- `src/app/services/auth.service.ts` — detección legacy + reset
- `src/app/app.routes.ts` — ruta `/setup` + guards

## Risks
- Editar v2 rompe congelación (Med): justificar en design.md; test fresh-install
- Regla "último admin" cambia UX (Baja): documentar release notes
- Reset forzado falso negativo (Med): fallback reset inline o recovery
- Ventana PR1→PR2 SHA-256 (Baja): transición corta; PR2 prioritario
- Flags en localStorage (Med): usar tabla `config` (v18)
- Test build rompe por shape (Baja): actualizar 3 env files atómicamente

## Rollback
Revertir: 3 env files, `db-migrations.ts` seed v2 + v18, `electron/db.ts` version, eliminar setup guard/service/page, restaurar `user.service.ts`/`admin.page.ts`/`auth.service.ts` protección legacy, revertir `app.routes.ts`, verificar tests + build.

## Dependencies
- Ninguna externa (bcryptjs/argon2id en PR2).
- Baseline: `openspec/specs/login/spec.md`.

## Success Criteria
- [ ] Build limpio (`production` + `test`).
- [ ] Suite PASS: `bunx vitest run` (web + electron).
- [ ] Fresh install: `/setup` → admin + `nombreComercio` → `/pos` autenticado.
- [ ] Install existente `e.z`/`softwarez`: login fuerza reset once.
- [ ] No desactivar/degradar último admin activo (service + UI).
- [ ] Env files sin credenciales; shapes `fileReplacements` intactos.
- [ ] `MAX_SCHEMA_VERSION=18`; backup/restore schema 18 válido.
- [ ] Lint 0 errores nuevos.

## Resolved Decisions (Binding)
1. Backdoor: runtime detection + forced reset (explore B1) — sin schema flag.
2. Admin protection: regla "último admin activo" — reemplaza nombre `e.z`.
3. Setup page: admin + `nombreComercio` mínimo — USER CHOSE.
4. "Cambiar mi contraseña" no-admin: OUT.
5. Split 2 changes: CONFIRMADO — PR1=este; PR2=`hashing-upgrade`.

## Follow-ups
- PR2 `hashing-upgrade`: bcryptjs + detección prefijo + rehash-on-login + fixtures ~5 specs.
- Wiring `nombreComercio` en títulos UI/Excel.
- Limpieza jornadas huérfanas (BACKLOG-13).