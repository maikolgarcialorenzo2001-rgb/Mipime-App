# TODO — Mipime-App (Mipime-Cuentas)

> POS local para pequeños comercios.
> Stack: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest (Strict TDD)
> Branch: `feature/auth-y-pages`
> Tests: **244 / 23 test files** (↑ desde 209)
> Última actualización: 2026-07-23

---

## ✅ Completado

### ~~A1. ErrorAlert en POS — `_buscar()` traga errores~~ ✅
**Commit:** `f8e72e8`
Se agregó `searchError` signal + `ErrorAlertComponent` en el template. Si falla la búsqueda, el usuario ve el error.

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

### ~~BUG: Transacción no atómica en ventas~~ ✅
**Commit:** `db2fc91`
`_validarStock()` upfront + BEGIN/COMMIT/ROLLBACK en todas las escrituras.

### ~~A2. HistorialPage — handlers vacíos~~ ✅
**Commit:** `3bf7bb3`
Implementados `descargarExcel()`, `verPreview()` con modal completo (productos + movimientos), `cerrarPreview()` por botón/Escape/backdrop, fix sheet name collision.

### ~~C9. Exportación de datos histórica~~ ✅
**Commit:** `3bf7bb3`
Botón "Exportar mes" en HistorialPage con `generarExcelMensual()` multi-hoja, `jornadasDelMes()` en JornadaService, resumen del mes + hoja por jornada.

---

## 🔴 Prioridad Alta — Funcionalidades rotas / incompletas

### A2. HistorialPage — handlers vacíos
**Archivo:** `src/app/pages/historial/historial.page.ts` (líneas 145-152)
**Problema:** Al clickear un día con jornada cerrada, los botones **"Descargar Excel"** y **"Vista previa"** no hacen nada:
```typescript
descargarExcel(_jornada: Jornada): void {
  // TODO: 4.3 — JornadaService.cerrar() guarda el Excel,
  // acá lo recuperamos de jornada_reportes y lo descargamos
}
verPreview(_jornada: Jornada): void {
  // TODO: 4.3 — Mostrar el Excel in-app (tabla readonly)
}
```
**Fix Descargar:** Usar `JornadaService.obtenerReporte(j.id)` → `_descargarExcel(base64)` (el mismo patrón que ya funciona en `app-nav.component.ts` y `jornada.page.ts`).
**Fix Vista previa:** Mostrar un modal con tabla readonly con los datos de la jornada (reusar lógica de ExcelService).

### A3. Editar / eliminar movimientos
**Contexto:** Hoy los movimientos (gastos/ingresos_extra) solo se pueden registrar, no modificar ni eliminar.
**Posible approach:** Botones editar/eliminar en cada fila del formulario de movimientos en JornadaPage.

### A4. CRUD completo de productos desde la UI
**Contexto:** `ProductosPage` solo lista y busca. `AdminPage` solo maneja usuarios. No hay forma de crear, editar o eliminar productos desde la app; solo existen los 50 productos del seed en `sqlite.service.ts`.
**Posible approach:** Formulario de alta/edición en AdminPage o ProductosPage. Confirmación para baja.

---

## 🟡 Prioridad Media — Features a medio implementar

### B4. Reabrir jornada
**Contexto:** Si una jornada se cierra por error (o el `pending_close` la cierra sin querer), no hay forma de reabrirla.
**Posible approach:** Botón "Reabrir" en HistorialPage para jornadas del día actual, solo admin. `UPDATE estado = 'abierta'`, limpia `hora_cierre`, `saldo_real`, `user_cierre_id`.

### B5. LoginPage sin tests
**Archivo:** `src/app/pages/login/login.page.ts` — **no tiene spec**
**Contexto:** La página de login es crítica (auth) y no tiene cobertura de tests.
**Posible approach:** Testear flujo login exitoso, error de credenciales, redirect a POS.

### B6. ProductosPage sin tests
**Archivo:** `src/app/pages/productos/producto.page.ts` — **no tiene spec**
**Contexto:** Página de listado/búsqueda de productos sin cobertura.

---

## ⏳ Por aprobar — Pendiente de decisión del cliente/empresa

### C7. Imprimir ticket / comprobante
**Contexto:** Después de cobrar, no se genera ningún comprobante.
**Posible approach:** Ventana de impresión con detalle de la venta.

---

## 🟢 Prioridad Baja — Features nuevas / deuda técnica

### C5. Componentes sin tests (8)
**Archivos:**
- `src/app/components/cart-item-row/cart-item-row.component` — sin spec
- `src/app/components/empty-state/empty-state.component` — sin spec
- `src/app/components/error-alert/error-alert.component` — sin spec
- `src/app/components/estado-badge/estado-badge.component` — sin spec
- `src/app/components/jornada-summary-card/jornada-summary-card.component` — sin spec
- `src/app/components/loading-spinner/loading-spinner.component` — sin spec
- `src/app/components/quantity-input/quantity-input.component` — sin spec
- `src/app/components/stock-badge/stock-badge.component` — sin spec

### ~~C8. Stock mínimo / alertas~~ ✅
**Commit:** `30d6931`
**Hecho:** Thresholds unificados entre StockBadgeComponent y ProductCardComponent. StockBadge usa computed signal (`>10` green, `>=1` yellow, `≤0` red). ProductCard ahora reusa `<app-stock-badge>`. Tests: 8 tests (5 nuevos + 3 migrados).

### ~~C10. Modo oscuro + Material Icons~~ ✅
**PRs:** `40d7e84` (infra), `f5e026a` (icons), `0f7c2ad` (dark nav+shared), `d31f1f1` (dark pages)
Material Symbols icons en toda la UI (nav, botones, SVGs reemplazados) + modo oscuro con persistencia en localStorage vía Tailwind 4 `@custom-variant dark`. 30 archivos, 4 PRs encadenados.

---

## Historial de cambios

| Fecha | Cambio | Commits |
|-------|--------|---------|
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
