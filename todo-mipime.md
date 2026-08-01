# TODO — Mipime-App (Mipime-Cuentas)

> POS local para pequeños comercios.
> Stack: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest (Strict TDD)
> Branch: `main`
> Tests: **689 / 43 test files** (web) + **136 / 4** (electron)
> Última actualización: 2026-07-31

---

## 🔴 Alta Prioridad — Backlog SDD `native-db-resilience` (post-merge)

> Trabajo pendiente registrado al cerrar el SDD native-db-resilience (merge a main `94bc153`).
> Foco actual: **DESKTOP primero**, después web, build/tooling, y el botón de exportar al final.

### BACKLOG-1. Título app desync (DESKTOP)
**Contexto:** `src/index.html:5` muestra `0.0.4-beta.test` pero la versión real es `0.1.9-beta` (el instalador dice 0.1.9-beta, la ventana/tab dice la vieja).
**Fix:** sincronizar el title con la versión real (package.json).

### BACKLOG-2. Colisión same-minute HHmm snapshots (DESKTOP)
**Contexto:** backups nativos con nombre `HHmm` pueden colisionar si dos snapshots caen en el mismo minuto → se saltea un backup puntual.
**Fix:** resolución de colisión (sufijo/secuencia) en el nombre del snapshot.

### BACKLOG-3. Cascade fatal stage siempre 'open' (DESKTOP)
**Contexto:** en la cascada de recuperación, el stage del diagnóstico fatal siempre reporta 'open' aunque el fallo ocurra en otra etapa.
**Fix:** reportar el stage real de la cascada en los diagnósticos.

### BACKLOG-4. postinstall electron-builder install-app-deps (DESKTOP)
**Contexto:** el build desktop depende de `@electron/rebuild` manual; falta el `postinstall` para automatizar la reinstalación de deps nativas.
**Fix:** agregar script `postinstall: electron-builder install-app-deps`.

### BACKLOG-5. revokeObjectURL timing (WEB)
**Contexto:** en el export web, `URL.revokeObjectURL` se llama síncronamente después de `a.click()` — frágil en Safari viejo.
**Fix:** `setTimeout(0)` antes de revocar.

### BACKLOG-6. Duplicación formato `tienda_export_` (WEB/DESKTOP)
**Contexto:** el nombre de export está duplicado entre `main.ts:55` y `backup.service._webExportName` (drift risk).
**Fix:** fuente única para el nombre de export.

### BACKLOG-7. Web fail-loud parity SqliteService (WEB)
**Contexto:** SqliteService (web/OPFS) aún cae a `:memory:` silenciosamente ante fallo de apertura; el desktop ya es fail-loud.
**Fix:** parity de comportamiento fail-loud en la versión web.

### BACKLOG-8. Bundle budget 696kB vs 500kB (BUILD)
**Contexto:** el bundle excede el budget de 500kB configurado (696kB actual).
**Fix:** decisión: subir el budget o reducir el bundle.

### BACKLOG-9. CI de PRs (TOOLING)
**Contexto:** no hay CI que corra tests en los PRs.
**Fix:** GitHub Actions con vitest (web) + test:electron.

### BACKLOG-10. ng test roto TS2532 venta.service.spec (TOOLING)
**Contexto:** `ng test` falla con TS2532 en venta.service.spec.
**Fix:** arreglar el spec.

### BACKLOG-11. 110 lint errors (TOOLING)
**Contexto:** hay ~110 errores de eslint pendientes.
**Fix:** limpiar o configurar excepciones.

### BACKLOG-12. ~~Botón UI exportarRespaldo~~ (FINAL — bien lejitos)
**Contexto:** la función `exportarRespaldo()` existe y está testeada, pero NO tiene caller en la UI.
**Fix:** agregar el botón en HistorialPage. **Dejado al final del flujo a pedido del usuario.**

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

- **Push a origin** — main está 112 commits adelante de `origin/main` ~~(resuelto: merge a `94bc153`)~~
- **Capacitor Fase 4** — Build APK + test en emulador (requiere Android Studio)

---

## ⏳ Por aprobar — Pendiente de decisión del cliente/empresa

### C7. Imprimir ticket / comprobante
**Contexto:** Después de cobrar, no se genera ningún comprobante.
**Posible approach:** Ventana de impresión con detalle de la venta.

---

## Historial de cambios

| Fecha | Cambio | Commits |
|-------|--------|---------|
| 2026-07-31 | B4 reabrir jornada marcado ✅ (c41032b, a8c9010); backlog post-native-db-resilience agregado como Alta Prioridad; C7 al final, Pendientes otros encima | — |
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
