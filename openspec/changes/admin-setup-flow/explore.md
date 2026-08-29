# Exploración: admin-setup-flow (S1-2 / BACKLOG-15, con análisis de S1-1 / BACKLOG-14)

> Fase SDD: explore · Cambio: `admin-setup-flow` · Fecha: 2026-08-23
> Problema: credenciales admin hardcodeadas en los 3 environment files, expuestas en el binario Electron (`resources/app.asar` trivialmente desempaquetable) y en el repo. Issue compuesta: hashing SHA-256 single-iteration.

## Estado actual

### Flujo de autenticación (pregunta 1)
- `LoginPage` (`src/app/pages/login/login.page.ts`) llama `AuthService.login(username, password)` → `_loginAsync` (`src/app/services/auth.service.ts:64-110`): busca por `LOWER(nombre)`, itera TODAS las filas homónimas (no hay UNIQUE en `nombre`), verifica `hashPassword(password, user.salt) === user.password_hash`; persiste sesión en `localStorage` con heartbeat en `sessionStorage`. `authGuard` redirige no autenticados a `/login`; `adminGuard` protege `/admin` por rol.
- Alta/gestión de usuarios: `UserService` (`list/create/toggleActivo/updateRol/updatePassword`). **Ya existe UI de cambio de contraseña**: reset inline en `AdminPage` (`startResetPass/onResetPass`, admin.page.ts:123-141), solo accesible a admin logueado. No existe "cambiar mi propia contraseña" ni flujo para usuarios sin admin disponible.
- Usuario admin seed: la migración v2 (`db-migrations.ts:204-219`) inserta un admin si no existe usuario con `environment.adminUser`, hasheando `environment.adminPassword`. Solo corre en DBs con `schema_version < 2`; todas las DBs reales ya están en ≥17, por lo que hoy el seed solo dispara en instalaciones frescas.
- Protección del admin seed: **por NOMBRE**, vía `environment.adminUser` en `user.service.ts:63-70` (no desactivar) y `:83-90` (no cambiar rol), y `admin.page.ts:45-50` (`seedAdminId` computed que deshabilita botones en `admin.page.html:95-137`).

### Viabilidad del setup de primer arranque (pregunta 2)
- Detección de instalación fresca: `SELECT COUNT(*) FROM usuarios` == 0. Es portable: vive en la DB misma, sirve para SQLocal (web/OPFS) y better-sqlite3 (Electron IPC).
- Puntos de enganche existentes:
  - `APP_INITIALIZER` ya se usa dos veces: `provideDatabase()` registra `db.initialize()` (`services/database.ts:35-46`) y `ttlCheckInitializer` condicional por `environment.testMode` (`app.config.ts:21-23`).
  - Patrón testeable a espejar: factory con slice de config inyectable por parámetro (`initializers/ttl-check.ts:14-16`), evita mockear el módulo environment.
  - Precedente de UI bloqueante: `components/ttl-expired/ttl-expired.component.ts`.
- Enrutado: instalación fresca sin sesión aterriza en `/login` (ruta `''` → redirect `/pos` → authGuard → `/login`). Un guard sobre `/login` que consulte el conteo de usuarios puede redirigir a `/setup` cuando sea 0.
- UI reutilizable: el markup de `login.page.html` (card centrada Tailwind + form ngModel signals + `app-error-alert`) es el molde natural para una página `setup.page`.

### Opciones de hashing (pregunta 3)
API actual (`hash-password.ts`): `generateSalt(): string` (hex 16 bytes, WebCrypto random) + `hashPassword(password, salt): Promise<string>` (SHA-256 hex). Todos los callers hacen `await` — una sustitución async-compatible no rompe firmas.

| Opción | Pros | Contras | Complejidad |
|---|---|---|---|
| **bcryptjs** (JS puro) | Funciona igual en navegador, renderer Electron y Vitest/jsdom; NO requiere WebCrypto (elimina los mocks de `crypto.subtle` de varios specs); API promise; ~20 KB | Más lento que WASM/nativo (cost factor 10 ≈ decenas de ms en JS puro, aceptable en login) | Baja |
| **hash-wasm argon2id** (WASM) | Algoritmo moderno recomendado; rápido; wasm por-algoritmo pequeño (~40 KB) | Carga WASM asíncrona; verificar comportamiento bajo jsdom/vitest (probable OK, Node soporta WASM); bundle glue extra | Media |
| Nativo (argon2/bcrypt node) vía IPC main | Máxima velocidad | Diverge web/desktop, agranda superficie IPC; rompe el build web — **descartado** | Alta |

Callers de `hashPassword`: `auth.service.ts:92`, `user.service.ts:30,37,105`, `db-migrations.ts:213` + specs que construyen fixtures hasheando de verdad: `app.spec.ts`, `auth.guard.spec.ts`, `auth.service.spec.ts`, `user.service.spec.ts` (usan `'admin123'` literal propio, independiente del environment).

### Migración de DBs existentes (pregunta 4)
- Máximo actual: **v17** (`db-migrations.ts:100-102`); runner compartido web/native con `FakeExecutor` en specs.
- Restricción documentada: si se agrega v18 hay que subir `MAX_SCHEMA_VERSION` en `electron/db.ts:22` (hoy 17; la nota de todo-mipime.md que dice 16 está desactualizada) o los backups con schema nuevo serían rechazados al restaurar.
- Rehash-on-login es viable SIN tocar schema: detectar formato del hash almacenado — legacy = hex plano de 64 chars; bcrypt `$2a$/$2b$…`; argon2 `$argon2id$…`. Tras verificar con el algoritmo legacy, recalcular con el nuevo y hacer UPDATE de `password_hash`+`salt`. No hay forma de rehashear fuera del login (no hay plaintext).

### Radio de blasto de quitar las credenciales (pregunta 5)
Consumidores de `adminUser`/`adminPassword`:
1. `environments/environment.ts|.prod.ts|.test.ts` — eliminar ambas claves (los 3 archivos deben mantener shapes alineados por fileReplacements de angular.json:55-84).
2. `db-migrations.ts:204-219` — seed v2. **Debe editarse sí o sí**: una instalación fresca correría v2 con credenciales inexistentes. Quitar DBs reales del riesgo es seguro: ninguna DB despachada re-ejecuta v2 (todas ≥17). La edición debe quedar documentada como excepción justificada a la congelación histórica de migraciones.
3. `user.service.ts:65,85` — protección por nombre del seed admin; reemplazar por regla estructural (p.ej. "no desactivar/degradar al último admin activo").
4. `admin.page.ts:45-50` + `admin.page.html:95-137` — `seedAdminId` y disabled states; misma sustitución semántica.
5. Specs: `db-migrations.spec.ts:151-161` (esperanza "inserts the admin seed" debe invertirse), `sqlite.service.spec.ts:20-23` (mock usa `environment.adminUser`) y `:218-229` ("debería insertar seed admin"), `admin.page.spec.ts` (comportamiento seedAdmin).
6. `app.spec.ts` y `auth.guard.spec.ts` usan `'admin123'` como fixture propio — no dependen del environment, pero conviene revisarlos al cambiar el dev default.

DBs ya despachadas quedan con el admin seed 'e.z'/'softwarez' conocido públicamente: mitigación necesaria (ver Recomendación).

## Enfoques

### A. Enganche del setup flow
1. **Guard de ruta + SetupService** (recomendado)
   - Pros: idiomático Angular standalone; cero costo en bootstrap; testeable como `authGuard`/`adminGuard`; el estado "sin usuarios" vive en la DB.
   - Contras: cubrir rutas de entrada (`/login`, `/setup` auto-protegida inversa).
   - Effort: Bajo-Medio.
2. **APP_INITIALIZER bloqueante** (espejo ttl-check)
   - Pros: único punto de control; patrón ya existente.
   - Contras: retrasa bootstrap con una query extra; mezcla UI con init; menos testeable.
   - Effort: Medio.

### B. Admin seed comprometido en DBs existentes
1. **Detección runtime + reset forzado** (recomendado): al iniciar, si existe un usuario admin cuyo hash coincide con alguno de los plaintexts comprometidos conocidos ('softwarez', 'admin123') verificado con el algoritmo legacy, exigir seteo de nueva contraseña una vez (pantalla tipo setup). Sin cambio de schema.
   - Pros: cierra el backdoor conocido en installs reales; sin MAX_SCHEMA_VERSION bump.
   - Contras: lógica de verificación one-time que debe retirarse a futuro (flag en DB o derivable).
   - Effort: Medio.
2. **Migración v18 con flag `must_change_password`**: la migración computa los hashes conocidos contra cada salt y marca la fila.
   - Pros: explícito y auditable en schema_version.
   - Contras: obliga bump de `MAX_SCHEMA_VERSION` (electron/db.ts), toca validación de backups/restauración.
   - Effort: Medio-Alto.
3. **No hacer nada para installs existentes**: inaceptable dada severidad HIGH y builds instalados en clientes.

### C. Alcance (pregunta 6)
Recomendación: **dividir en 2 cambios encadenados** (budget de review 400 líneas por PR):
- **PR1 — admin-setup-flow (este cambio)**: quitar credenciales de environments; ruta `/setup` + guard + SetupService; página de setup (crear admin inicial); regla "último admin activo" en UserService/AdminPage; reset forzado del seed legacy (opción B1); edición del seed v2; flips de specs afectados. Estimado ~400-450 líneas sumando tests — justo en/ligeramente sobre budget; sdd-tasks debería pronosticar `400-line budget risk: Medium` y evaluar partir el reset-forzado si excede.
- **PR2 — hashing-upgrade (cambio separado)**: bcryptjs (default recomendado por simplicidad de test y portabilidad) + detección por prefijo + rehash-on-login + actualización de fixtures en ~5 spec files. Estimado ~300-380 líneas.
Orden sugerido PR1→PR2: la exposición mayor es la contraseña pública; el swap criptográfico es ortogonal. Interinamente las contraseñas nuevas de PR1 siguen SHA-256 hasta que PR2 aterrice (aceptable, transición corta).

## Restricciones encontradas en docs/openspec (pregunta 7)
- `todo-mipime.md:174-182`: BACKLOG-14 y BACKLOG-15 registrados como ALTO; fix sugerido coincide con este cambio.
- `todo-mipime.md:148` (actualizar): cualquier migración nueva obliga a subir `MAX_SCHEMA_VERSION` en electron/db.ts (hoy 17, doc desactualizado a 16). Preferir enfoques sin schema change.
- Convenciones vigentes: commits convencionales, ESLint `no-explicit-any: error`, Prettier 100 chars, pages `*.page.ts`, DB access solo vía services con token `DATABASE`, TDD estricto en apply, budget de review 400 líneas con PRs encadenados cuando excede (precedentes de changes encadenados en openspec/changes/archive). Versionado: `bun run version:bump` (scripts/bump-version.mjs), actual 0.1.16-beta.
- `docs/exploration-issues-2026-08-18.md:199-200` lista S1-1 y S1-2 como prioridades 1 y 2 de seguridad crítica.

## Recomendación
Proceder con PR1 según enfoque A1 + B1 + C: setup flow por guard/ruta, detección de estado desde la propia DB (portable web/desktop), regla estructural "último admin activo" en lugar de protección por nombre, reset forzado del admin seed comprometido sin tocar schema, y edición justificada del seed v2. Dejar bcryptjs/rehash-on-login para PR2 (cambio separado `hashing-upgrade`).

## Riesgos
- Editar el cuerpo histórico de la migración v2 rompe la invariant de congelación de migraciones — seguro en la práctica (ninguna DB real re-ejecutará v2), pero debe quedar justificado en design.md y cubierto por test de fresh-install. Severidad: MEDIA (proceso/documentación).
- Regla "último admin activo" cambia semántica visible (antes se protegía UN usuario por nombre; ahora la regla es estructural): puede sorprender a usuarios con múltiples admins. Severidad: BAJA.
- Reset forzado del seed legacy: si la verificación one-time da falso negativo (hash corrupto, salt anómalo), el admin queda bloqueado fuera; prever fallback (cualquier admin activo puede usar el reset existente de AdminPage; si no hay admins activos, pantalla de recovery). Severidad: MEDIA.
- Ventana intermedia PR1→PR2 con contraseñas nuevas en SHA-256. Severidad: BAJA (transición corta, riesgo cubierto por PR2 planificado).
- localStorage no es fuente de verdad portable (roundtrip OPFS→native importa la DB pero no localStorage): cualquier flag de setup/reset debe vivir en la DB, no en localStorage. Severidad: MEDIA si se ignora.
- Test build (`environment.test.ts`, TTL/testMode) depende del shape del environment: actualizar los 3 archivos juntos. Severidad: BAJA.

## Ready for Proposal
Sí. El orquestador puede comunicar: cambio viable sin schema migration; dividido en PR1 (setup flow, este change) y PR2 (hashing, change futuro); decisión pendiente para proposal: aceptar enfoque B1 (reset forzado runtime) vs B2 (v18 con flag) — B1 recomendado.
