# TODO — Mipime-App (Mipime-Cuentas)

> POS local para pequeños comercios.
> Stack: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest (Strict TDD)
> Branch: `main` (única rama — local y remota, tras limpieza 2026-08-05)
> Tests: **Electron 141** / **web 768** (verificación SDD fix-reanudar-jornada-acceso 2026-08-08; `ng test` destrabado `b21ff36`)
> Última actualización: 2026-08-08

---

## 🔴 Alta Prioridad — Backlog SDD `native-db-resilience` (post-merge)

> Trabajo pendiente registrado al cerrar el SDD native-db-resilience (merge a main `94bc153`).
> Foco actual: **build/tooling (BACKLOG-8/9/11)** → Capacitor Fase 4 → botón de exportar (BACKLOG-12) al final. Bloque DESKTOP ✅ y bloque WEB ✅ cerrados (2026-08-05).

### ~~BACKLOG-1. Título app desync (DESKTOP)~~ ✅
**Contexto:** `src/index.html:5` mostraba `0.0.4-beta.test` pero la versión real es `0.1.9-beta` (el instalador dice 0.1.9-beta, la ventana/tab dice la vieja).
**Fix:** sincronizar el title con la versión real (package.json).
**Resuelto en dos pasos:** `b19cb21` (bump manual a 0.1.10-beta) + **branch `version-sync-feature` (0.1.12-beta)**: sistema de sync automático — `package.json#version` es fuente única; `scripts/sync-version.mjs` genera `src/app/version.ts` y actualiza el `<title>`, `src/main.ts` setea `document.title` en runtime, badge `vX.Y.Z-beta` en el nav. Ya no se edita el title a mano. Ver `VERSIONING.md`.

### ~~BACKLOG-1b. `ng test` roto por TS2532 (TOOLING)~~ ✅
**Contexto:** `ng test` falla a nivel build con TS2532 en `venta.service.spec.ts` (`updateJornada![1]` bajo `noUncheckedIndexedAccess`, commit `f52caf5`).
**Fix:** destrabado en `b21ff36` (Angular 21 unit-test runner) + fix non-null `![1]![0]` integrado a main vía merge del seed (`85601a7`). Verificado en main 2026-08-05.

### ~~BACKLOG-2. Colisión same-minute HHmm snapshots (DESKTOP)~~ ✅
**Contexto:** snapshots nativos con nombre `HHmm` pueden colisionar si dos snapshots caen en el mismo minuto → se saltea un backup puntual.
**Fix:** `timestampedSnapshotPath(dir, d)` (loop `-<n>` mientras `existsSync`) + widening `TIMESTAMPED_RE`/`whenFromName` a `(?:-\d+)?` (parsable + prunable + restorable). ✅ **Merged a main `7e78d67` + archivado (`d4e15f2`).** Electron 141 / web 695 GREEN.
**Commit:** `7e78d67` (original `118b224` en branch).

### ~~BACKLOG-3. Cascade fatal stage siempre 'open' (DESKTOP)~~ ✅
**Contexto:** en la cascada de recuperación, el stage del diagnóstico fatal siempre reporta 'open' aunque el fallo ocurra en otra etapa.
**Fix:** `let currentStage` module-scope + `getStartupStage()` en db.ts; ambos fatales (`db.ts`, `main.ts:initialize`) leen de la misma fuente. ✅ **Merged a main `d115588` + archivado (`d4e15f2`).**
**Commit:** `d115588` (original `70d4532` en branch).

### ~~BACKLOG-4. postinstall electron-builder install-app-deps (DESKTOP)~~ ✅
**Contexto:** el build desktop depende de `@electron/rebuild` manual; falta el `postinstall`.
**Fix:** `"postinstall": "electron-builder install-app-deps"` en package.json (electron:rebuild intacto). ✅ **Merged a main `78806f7` + archivado (`d4e15f2`).**
**Commit:** `78806f7` (original `b8005e5` en branch).

### ~~BACKLOG-5. revokeObjectURL timing (WEB)~~ ✅
**Contexto:** en el export web, `URL.revokeObjectURL` se llama síncronamente después de `a.click()` — frágil en Safari viejo.
**Fix:** `49b5889` difiere el revoke con `setTimeout(0)` pasado el click (SDD web-export-refactor, merged + archivado `c4fd2c3`). Verificado PASS 6/6.

### ~~BACKLOG-6. Duplicación formato `tienda_export_` (WEB/DESKTOP)~~ ✅
**Contexto:** el nombre de export está duplicado entre `main.ts:55` y `backup.service._webExportName` (drift risk).
**Fix:** `5f78cc8` fuente única vía `electron/export-name.ts` (SDD web-export-refactor, merged + archivado `c4fd2c3`). Verificado PASS 6/6.

### ~~BACKLOG-7. Web fail-loud parity SqliteService (WEB)~~ ✅
**Contexto:** SqliteService (web/OPFS) aún cae a `:memory:` silenciosamente ante fallo de apertura; el desktop ya es fail-loud.
**Fix:** aplicado en `18533f1` (fail-loud native migrations) — ya no existe fallback a `:memory:` en `sqlite.service.ts`; `_getClient()` lanza fuera de browser y `createSqlocalClient()` propaga fallos (verificado 2026-08-01).

### BACKLOG-8. Bundle budget 696kB vs 500kB (BUILD)
**Contexto:** el bundle excede el budget de 500kB configurado (696kB actual).
**Fix:** decisión: subir el budget o reducir el bundle.
**Approach sugerido (análisis 2026-08-05):** **A+C** — lazy-load de `xlsx` (SheetJS) + subir budget a ~550-600 kB.

**Datos del diagnóstico (build fresco main `a00bac9`, 2026-08-05):**
- Initial real: **696.90 kB raw / 183.02 kB transfer** → warning excedido por 196.91 kB (el error es 1MB, el build pasa).
- Composición: `XLKRRLYA` 318.71 kB (**SQLocal + xlsx**), `FJ6CPVPZ` 170.63 kB (Angular core), `BB6UMBDU` 87.79 kB, `main` 53.40 kB, `styles` 53.97 kB.
- Las rutas YA son 100% lazy (`loadComponent` en las 7 páginas) — no hay ganancia por ahí.
- **Causa raíz:** cadena eager `app-nav` → `JornadaService` → `ExcelService` → `import * as XLSX from 'xlsx'` (SheetJS 0.18.5, xlsx.js 815 kB sin minificar). El POS solo exporta a Excel desde Historial/Jornada, pero arrastra la librería al boot.

**Superficie de cambio (para cuando se implemente):**
- `excel.service.ts` (840 líneas): `import * as XLSX` → `import type * as XLSX` + `await import('xlsx')` cacheado; 2 métodos públicos pasan a `Promise<string>` (los ~12 privados no se tocan — patrón shadowing).
- `jornada.service.ts` (3 call sites): L344 `await`; **L602/L877 `map` → `switchMap` + `from`** (si se olvida, el subscribe recibe Promise y rompe en runtime).
- `excel.service.spec.ts`: ~80 call sites pasan a `await` + callbacks `async` (cuidado con assertions laxas tipo `toBeDefined` que dan falso verde).
- Redes de seguridad: TS compila con error si un caller no espera la Promise; vitest (strict TDD RED→GREEN) atrapa el resto.

**Riesgos conocidos:** (1) los `map` RxJS si no se convierten; (2) churn de tests; (3) **riesgo NUEVO:** fallo de carga del chunk lazy si la app web se usa offline sin el chunk cacheado — hoy xlsx ya está en memoria y eso no puede fallar.

**Decisión (2026-08-05):** NO implementado — se difiere a pedido del usuario. Pendiente de retomar; revisar primero si la web se usa offline (condiciona A puro vs C).

### BACKLOG-9. CI de PRs (TOOLING)
**Contexto:** no hay CI que corra tests en los PRs.
**Fix:** GitHub Actions con vitest (web) + test:electron.

### ~~BACKLOG-10. ng test roto TS2532 venta.service.spec (TOOLING)~~ ✅
**Contexto:** `ng test` falla con TS2532 en venta.service.spec.
**Fix:** non-null assertions completas (`updateJornada![1]![0]`, `ca76a83`) — **integrado a main vía merge del seed (`85601a7`)** + ng test destrabado (`b21ff36`). Verificado en main 2026-08-05.

### BACKLOG-11. 110 lint errors (TOOLING)
**Contexto:** hay ~110 errores de eslint pendientes.
**Fix:** limpiar o configurar excepciones.
**Approach sugerido (análisis 2026-08-05):** **Camino A (pragmático, ~2-3 h)** — override de `no-explicit-any` solo en specs (`**/*.spec.ts`) vía config + fixes reales. Camino B (~4-5 h) si se tipan también los 23 `any` de specs.

**Datos del diagnóstico (lint fresco main `a00bac9`, 2026-08-05):** 110 errores / 0 warnings, 21 archivos, solo 3 auto-fixables con `--fix`.
- `no-explicit-any` **48** — 25 producción en `excel.service.ts` (casts `(v as any).divisa_tipo` en desglose divisas) + 23 en specs.
- `label-has-associated-control` **28** — templates: checkout-modal (9), inventario (12), producto.page (4), app-nav (2).
- `no-unused-vars` **19** — imports/vars en specs + `auth.service.ts` (`map`), `user.service.ts` (`Database`).
- a11y click/focus **8** — `quantity-input.component.html` (4) + `inventario.page.html` (4).
- `no-empty-function` **3** — incluye **disable comment roto** en `historial.page.spec.ts:555` (el `— intencional...` del comentario rompe la referencia de regla).
- Misc **5** — triple-slash (electron-file.service.ts), type→interface, generic-constructors, `Array<T>`→`T[]`, `!=`→`!==` (producto.page.html:89).

**💡 Hallazgos extra:** `login.page.spec.ts:260` `navigateSpy` asignado y nunca usado → probable **assertion faltante** (test con hueco); mismo patrón en `admin.page.spec:25` y `pos.page.spec` (3 vars).

**Riesgos conocidos:** (1) labels a11y cambian DOM/CSS — selectores hermano-adyacente (radio/checkbox custom) y colisión de `id` en `*ngFor`; **no lo atrapa la suite**, requiere verificación visual; (2) `!=`→`!==` es semántico — difiere con `undefined`/`null`, verificar la línea antes de tocar; (3) unused vars en specs destapan assertions faltantes → si el comportamiento no existe, el test se pone rojo (scope creep: lint → feature); (4) triple-slash→`import type` puede romper compilación de electron-file.service si no resuelve (probe web→electron fue GREEN).

**Nota:** el archivo `excel.service.ts` solapa con BACKLOG-8 (mismo archivo, cambios independientes — tipar `any`s no toca el import de xlsx).

**Decisión (2026-08-05):** NO implementado — se difiere a pedido del usuario. Al retomar: decidir primero Camino A vs B para los `any` de specs.

### BACKLOG-12. ~~Botón UI exportarRespaldo~~ (FINAL — bien lejitos)
**Contexto:** la función `exportarRespaldo()` existe y está testeada, pero NO tiene caller en la UI.
**Fix:** agregar el botón en HistorialPage. **Dejado al final del flujo a pedido del usuario.**

### BACKLOG-13. Limpieza de jornadas 'abierta' huérfanas (DATOS)
**Contexto:** el bug histórico de `obtenerAbierta()` (filtrar `fecha = hoy`) permitía abrir una jornada NUEVA dejando la anterior con `estado='abierta'` sin cerrar. Fix del flujo aplicado en `fix-reanudar-jornada-acceso` (merged a main 2026-08-08, PRs #6-#10) — de ahora en más el sistema detecta la última abierta sin importar la fecha y la reanuda/cierra. PERO las BD vivas pueden tener **múltiples filas `estado='abierta'` huérfanas** (legacy).

**Exploración SDD completa (2026-08-08, Engram `sdd/limpieza-jornadas-huerfanas/explore` #499):**

**Esquema real de `jornadas`:** la columna NO es `fecha_cierre` como decía este item — es **`hora_cierre`** (TEXT nullable) + `saldo_real` (REAL nullable). Abierta = `estado='abierta'` AND `hora_cierre IS NULL` AND `saldo_real IS NULL`. Columnas: id, fecha, hora_apertura, monto_inicial, hora_cierre, total_ventas, total_movimientos (ex total_gastos v12), saldo_esperado, saldo_real, estado (CHECK abierta/cerrada), user_apertura_id, user_cierre_id, total_merma, total_usd, total_eur, created_at, updated_at.

**Escenarios calculados donde puede existir una huérfana:**
1. **Histórico (causa raíz, pre-fix)**: día X abrís y no cerrás → día X+1 `obtenerAbierta()` filtra `fecha=hoy` → no detecta la de ayer → login deja abrir NUEVA → la anterior queda 'abierta' para siempre. Multiplicable por días → N huérfanas. También el auto-cierre "otro usuario" usaba la misma query de hoy → jornadas abiertas de días previos de OTRO user tampoco se auto-cerraban.
2. **Restauración de backup viejo**: un backup restaurable con jornadas abiertas reintroduce huérfanas.
3. **AGUJERO POST-FIX (sigue activo)**: `abrir()` (jornada.service.ts:194) hace INSERT **sin guard en la DB** — no valida si ya existe otra `'abierta'`. El único caller (app-nav `confirmarApertura`) depende de la señal `jornadaAbierta` vía `puedeAbrir` (app-nav.component.ts:63-65). Si `refreshJornadaAbierta()` falla o tarda (jornada.service.ts:144), la señal queda `null` → UI habilita "Iniciar" → se crea una NUEVA huérfana. El modal de login solo ofrece "Reaibir" o "Cerrar y guardar" — no crea huérfanas.
4. Múltiples abiertas previas: el `ORDER BY fecha DESC, id DESC LIMIT 1` hace invisible a las anteriores → muertas para el sistema.

**Casos que NO generan huérfanas** (verificado): modal login (solo reabrir/cerrar); `cerrar()` hace UPDATE atómico a 'cerrada' antes de generar Excel → un fallo de Excel no deja abierta; `cerrarYGuardar` cierra la activa.

**Hallazgos de arquitectura relacionados:**
- **NO existe ningún `DELETE FROM` en todo el repo** ni FKs con `ON DELETE CASCADE` (ventas, movimientos, stock_movimientos, arqueo_caja, jornada_reportes, cuenta_cosas) — no hay precedente de borrado de datos.
- `cerrar(id, userId, arqueo?)` (jornada.service.ts:220) es PÚBLICO y capaz de cerrar una jornada vieja por id (UPDATE → arqueo → Excel → jornada_reportes → backup 'jornada-close').
- Migraciones: runner compartido `runMigrations(exec, {seedEnabled})` hasta v17; precedente de backfill v8 (lotes_stock). Tests con `FakeExecutor` (db-migrations.spec.ts).
- ⚠️ **`electron/db.ts:22` tiene `MAX_SCHEMA_VERSION = 16` mientras las migraciones ya van a v17** — cualquier cambio de schema (v18) obliga a actualizarlo (un backup con schema 17 sería rechazado en restauración).
- BD reales: web = `tienda-app.db` en OPFS (no visible para scripts); desktop = `<userData>/tienda-app.db` + rodante `<documents>/Tienda - App/DataBase/tienda-app.db` + backups timestamped. No hay herramientas de inspección en el repo.

**Opciones evaluadas (con tradeoffs):**
- (a) Migración automática self-healing v18 — un solo código cubre web+desktop, patrón probado; CON: no hay decisión humana y riesgo alto de cerrar la jornada legítima.
- (b) Script manual con better-sqlite3 — control total, cumple el literal del backlog; CON: **solo llega a la BD desktop**, OPFS web inaccessible, duplica lógica del service, desacoplado de la arquitectura.
- **(c) RECOMENDADA — utilidad admin en la app** (sección "Jornadas sin cerrar" en Admin): reusa `cerrar()`/`_ejecutarCierre` con cierre real + backup, funciona en web (OPFS) Y desktop, el usuario decide sobre datos reales, `adminGuard` ya existe, testeable con specs existentes. + **guard en `abrir()`** (si ya existe `'abierta'` en la DB → abortar) — defensa en profundidad para que el agujero post-fix no cree nuevas.

**Riesgos:**
- Pérdida de datos: sin ON DELETE CASCADE y sin precedente de borrado; "descartar" borra historial fiscal. Criterio propuesto: **cerrar SIEMPRE** (no borrar) — "descartar" solo para vueltas vacías y aún así marcarlas 'cerrada'.
- Jornada activa: nunca incluir la devuelta por `obtenerAbierta()` en la limpieza.
- Excel retroactivo: cerrar jornada vieja la suma al export mensual de SU mes → cambia reportes pasados. Decidir cómo exponerlo (cierre con marca "cerrada por admin" + fecha hoy).
- `MAX_SCHEMA_VERSION=16` vs v17 real (electron/db.ts) — subir si se toca schema.
- OPFS: scripts manuales nunca ven la BD web.

**Próximo paso cuando se retome:** SDD con fase 0 de inspección read-only de las BD reales (desktop userData + rodante) para dimensionar volumen y si hay ventas/movimientos involucrados, luego proposal con opción C + regla "cerrar siempre, descartar solo vacías" y guard en `abrir()`. Decisión de negocio pendiente: ¿vuísas CON datos pueden DESCARTARSE o solo CERRARSE? (recomendación: cerrar siempre).

**Decisión (2026-08-08):** exploración completada y registrada; **solución DIFERIDA** a pedido del usuario ("le daremos solución más adelante"). Pendiente de retomar con SDD. Volumen real desconocido: la fase 0 de inspección queda como primer paso obligatorio.

---

## ✅ Completado

### ~~B4. Reabrir jornada~~ ✅
**Commits:** `c41032b`, `a8c9010`
Modal de reapertura de jornada para el mismo usuario con opción de cerrar (implementado en jornada lifecycle).

### ~~A1. ErrorAlert en POS — `_buscar()` traga errores~~ ✅
**Commit:** `f8e72e8`
Se agregó `searchError` signal + `ErrorAlertComponent` en el template. Si falla la búsqueda, el usuario ve el error.

### ~~A2. HistorialPage — handlers vacíos~~ ✅
**Commit:** `3bf7bb3`
Implementados `descargarExcel()`, `verPreview()` con modal completo (productos + movimientos), `cerrarPreview()` por botón/Escape/backdrop, fix sheet name collision.

### ~~B1. `_debounceId` sin cleanup~~ ✅
**Commit:** `0f1e3f5`
`DestroyRef.onDestroy()` limpia el timeout del debounce si el componente se destruye.

### ~~B2. `_columnCount` recalcula en cada CD~~ ✅
**Commit:** `0f1e3f5`
`_columnCount` ahora es una propiedad cacheadas, calculada una vez en el constructor.

### ~~B3. `as unknown as T[]` en SqliteService~~ ✅
**Commit:** `0f1e3f5`
Cast aislado en `_mapRows<T>()` con comentario explicativo.

### ~~C1. Environments~~ ✅
**Commit:** `c15ded8`
`src/app/environments/environment.ts` con `{ dbName: 'mipime-cuentas.db' }`.

### ~~C2. Ganancia bruta en Excel~~ ✅
**Commit:** `1b02050`
Ganancia bruta = total_ventas - total_costo (JOIN detalle_ventas → productos.precio_costo).

### ~~C3. Movimientos UI~~ ✅
**Commit:** `1b02050`
Formulario inline en JornadaPage (admin-only) para registrar gastos/ingresos_extra.

### ~~C4. Forma de pago + usuario en ventas~~ ✅
**Commit:** `db2fc91`
Selector efectivo/transferencia en checkout, desglose en Excel, migración v5.

### ~~C5. Componentes sin tests — todos completados~~ ✅
**Commit:** 2026-07-26
Tests para cart-item-row (8 tests), empty-state (4), error-alert (4), estado-badge (7). Los demás ya tenían spec: stock-badge, quantity-input, checkout-modal, product-card, app-nav.

### ~~C8. Stock mínimo / alertas~~ ✅
**Commit:** `30d6931`
Thresholds unificados entre StockBadgeComponent y ProductCardComponent. StockBadge usa computed signal (`>10` green, `>=1` yellow, `≤0` red). ProductCard ahora reusa `<app-stock-badge>`. Tests: 8 tests (5 nuevos + 3 migrados).

### ~~C9. Exportación de datos histórica~~ ✅
**Commit:** `3bf7bb3`
Botón "Exportar mes" en HistorialPage con `generarExcelMensual()` multi-hoja, `jornadasDelMes()` en JornadaService, resumen del mes + hoja por jornada.

### ~~C10. Modo oscuro + Material Icons~~ ✅
**PRs:** `40d7e84` (infra), `f5e026a` (icons), `0f7c2ad` (dark nav+shared), `d31f1f1` (dark pages)
Material Symbols icons en toda la UI (nav, botones, SVGs reemplazados) + modo oscuro con persistencia en localStorage vía Tailwind 4 `@custom-variant dark`. 30 archivos, 4 PRs encadenados.

### ~~P1. Jornada refresh post-venta~~ ✅
**Commit:** 2026-07-26
`pos.page.ts` — `confirmarVenta()` ahora llama `refreshJornadaAbierta()` después de venta exitosa. Totales de jornada se reflejan sin recarga manual. 2 tests nuevos en `pos.page.spec.ts`.

### ~~P2. Dark mode jornada numbers~~ ✅
**Commit:** 2026-07-26
`jornada-summary-card.component.html` — `text-gray-900 dark:text-gray-100` en los 4 `<dd>` (monto_inicial, total_ventas, total_gastos, saldo_esperado).

### ~~P3. Test environment con TTL 7 días~~ ✅
**Commit:** 2026-07-26
`bun ng build --configuration=test` activa TTL de 7 días. Componentes nuevos:
- `environment.test.ts` (clone de prod + `ttlDays:7, testMode:true`)
- `initializers/ttl-check.ts` — APP_INITIALIZER que guarda `mipime_first_launch` en localStorage
- `ttl-expired.component.ts` — overlay full-screen con Material Symbols `timer_off`
- `app.config.ts` — registro condicional del initializer
- `app.ts` + `app.html` — `ttlExpired` signal + `@if` condicional
- 5 tests en `ttl-check.spec.ts`, 8 tests en `ttl-expired.component.spec.ts`, 2 tests en `app.spec.ts`

### ~~P4. Limpieza A3/A4 del TODO~~ ✅
**Commit:** 2026-07-26
A3 (editar/eliminar movimientos) y A4 (CRUD productos) removidos de `todo-mipime.md`. Métodos de `ProductoService` se mantienen (no se borran).

### ~~BUG: Transacción no atómica en ventas~~ ✅
**Commit:** `db2fc91`
`_validarStock()` upfront + BEGIN/COMMIT/ROLLBACK en todas las escrituras.

---

## 🟢 Prioridad Baja — Pendientes otros

- ✅ **Sync con origin/main** — `main` == `origin/main` (`c6cba24`, 0 adelante / 0 atrás), verificado 2026-08-05
- ✅ **feat/seed-productos-reales MERGED** — seed 74 productos reales + fix TS2532 venta spec + migración specs + skip native rebuild integrados a main en `85601a7` (catch-up con token canónico SQLOCAL_CLIENT). Branch eliminada en limpieza 2026-08-05 (solo queda `main`).
- **Capacitor Fase 4** — Build APK + test en emulador (requiere Android Studio). Setup presente: `capacitor.config.ts` + deps `@capacitor/*@8.4.2` + scripts `cap:*`

---

## ⏳ Por aprobar — Pendiente de decisión del cliente/empresa

### C7. Imprimir ticket / comprobante
**Contexto:** Después de cobrar, no se genera ningún comprobante.
**Posible approach:** Ventana de impresión con detalle de la venta.

---

## Historial de cambios

| Fecha | Cambio | Commits |
|-------|--------|---------|
| 2026-08-08 | SDD `fix-reanudar-jornada-acceso` COMPLETE: reanudar jornada para cualquier user autenticado con jornada sin cerrar (hoy o anterior) — query última abierta sin fecha, elimina auto-cierre por otro user, cierre con uid autenticado, Excel "Abierta por/Cerrada por". 4 PRs encadenados + tracker→main (#6-#10). Suite web 768. BACKLOG-13 (limpieza huérfanas) agregado, out of scope del fix | merged `main` |
| 2026-08-05 | TODO sync vs remote (post-crash VS Code): BACKLOG-1b/5/6/10 ✅, BACKLOG-2/3/4 ✅ merged+archivados, seed-productos-reales MERGED, limpieza de ramas (solo `main`), bump `0.1.13-beta`. BACKLOG-8: diagnóstico bundle real (696.90 kB) + approach A+C documentado en el item, **no implementado** (decisión usuario). BACKLOG-11: diagnóstico lint 110 errores + approach Camino A documentado en el item, **no implementado** (decisión usuario) | `c6cba24` |
| 2026-08-02 | SDD `desktop-resilience-backlogs`: BACKLOG-2/3/4 **implementados** en `fix/desktop-resilience-backlog` (colisión snapshot + parser `(?:-\d+)?`, stage fatal real, postinstall install-app-deps). Electron 141 / web 695 GREEN. **⏳ PRs NO abiertos (decisión sesión 2026-08-02).** | `b8005e5`, `70d4532`, `118b224` |
| 2026-08-01 | Limpieza de ramas: 11 remotes + 7 locales obsoletas eliminadas (todo contenido ya en main); `feat/seed-productos-reales` traída a local con tracking; ruta auto-save Excel unificada a `Documents/Tienda - App/Tienda IPVE` | `e6243a8`, `189e951` |
| 2026-08-01 | TODO sync vs remote: BACKLOG-7 ✅, BACKLOG-10 revertido a pendiente (fix solo en branch); main == origin/main (0/0); ramas betatest-features (behind 4) y electron/auto-save-excel (ahead 4) anotadas; Capacitor setup documentado | — |
| 2026-07-31 | B4 reabrir jornada marcado ✅ (c41032b, a8c9010); backlog post-native-db-resilience agregado como Alta Prioridad; C7 al final, Pendientes otros encima | — |
| 2026-07-31 | BACKLOG-1 (título desync) ✅ con bump a 0.1.10-beta (`b19cb21`) | `b19cb21` |
| 2026-07-26 | P1-P4: prod-improvements-julio-2026 — jornada refresh, dark mode numbers, TTL 7d, limpieza TODO (17 tests nuevos) | — |
| 2026-07-26 | C5: Tests de 4 componentes + B5: LoginPage tests + B6: ProductosPage tests (50 tests nuevos) | — |
| 2026-06-24 | C10: Modo oscuro + Material Icons — 4 PRs (infra/icons/dark-nav/dark-pages) | `40d7e84`, `f5e026a`, `0f7c2ad`, `d31f1f1` |
| 2026-06-08 | A2+C9: HistorialPage handlers + Exportación mensual | `3bf7bb3` |
| 2026-06-08 | C8: Stock thresholds unificados — StockBadge computed signal + ProductCard reuse | `30d6931` |
| 2026-06-05 | A1: ErrorAlert en POS `_buscar()` | `f8e72e8` |
| 2026-06-05 | B1-B3: cleanup debounce, cache columnCount, sql cast | `0f1e3f5` |
| 2026-06-05 | Excel: protección hojas + Precio base columna + Total gastos siempre visible | `a87a0a5`, `8447b1f` |
| 2026-06-05 | gastos-y-ganancia: movimientos UI, total_costo, Excel detallado | `1b02050` |
| 2026-06-05 | forma-pago-ventas: transacción, migración v5, forma_pago, usuario_id, Excel | `db2fc91` |
| 2026-06-05 | graceful-close: heartbeat, pending close, auto-calc cierre, Excel fixes | `a56a293` |
| 2026-06-05 | pos-enhancements: toast éxito + stock colores | `bf9a38f`, `87f424f` |
| 2026-06-05 | environments-config: dbName a environment.ts | `c15ded8` |
| 2026-06-05 | Botones jornada en Nav, checkout fix, logout redirect (Maikol) | `d5926b5`–`c21ba94` |
| 2026-06-04 | InventarioPage, StockMovimientoService, tests (Enjin2310) | `3bab6f4`–`8e69807` |
| 2026-06-04 | HistorialPage calendario, ExcelService, modal cierre (Maikol) | `e734148`–`b6e63eb` |
| 2026-06-04 | AdminPage CRUD usuarios + UserService | `04fe08b`, `1ee0868` |
| 2026-06-04 | POS navegación teclado, carrito, pos-enhancements base (Maikol + Enjin2310) | `1dc2e97`–`a8fd529` |
