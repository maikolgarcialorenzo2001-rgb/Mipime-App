# TODO — Mipime-App (Mipime-Cuentas)

> POS local para pequeños comercios.
> Stack: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest (Strict TDD)
> Branch: `feature/auth-y-pages`
> Tests: **392 / 34 test files** (↑ desde 375)
> Última actualización: 2026-07-26

---

## ✅ Completado

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

## 🟡 Prioridad Media — Features a medio implementar

### B4. Reabrir jornada
**Contexto:** Si una jornada se cierra por error (o el `pending_close` la cierra sin querer), no hay forma de reabrirla.
**Posible approach:** Botón "Reabrir" en HistorialPage para jornadas del día actual, solo admin. `UPDATE estado = 'abierta'`, limpia `hora_cierre`, `saldo_real`, `user_cierre_id`.

### ~~B5. LoginPage sin tests~~ ✅
**Commit:** 2026-07-26
11 tests: render formulario, inputs, botón, credenciales válidas → navega /pos, credenciales inválidas → error, estado loading, limpieza de error.

### ~~B6. ProductosPage sin tests~~ ✅
**Commit:** 2026-07-26
16 tests: carga inicial, tabla, búsqueda con debounce, estados vacío/loading/error, recargar, cantidad singular/plural, precio y stock.

---

## ⏳ Por aprobar — Pendiente de decisión del cliente/empresa

### C7. Imprimir ticket / comprobante
**Contexto:** Después de cobrar, no se genera ningún comprobante.
**Posible approach:** Ventana de impresión con detalle de la venta.

---

## 🟢 Prioridad Baja — Pendientes otros

- **Push a origin** — main está 112 commits adelante de `origin/main`
- **Capacitor Fase 4** — Build APK + test en emulador (requiere Android Studio)

---

## Historial de cambios

| Fecha | Cambio | Commits |
|-------|--------|---------|
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
