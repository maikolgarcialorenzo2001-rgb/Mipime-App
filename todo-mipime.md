# TODO — Mipime-App (Mipime-Cuentas)

> POS local para pequeños comercios.
> Stack: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest (Strict TDD)
> Branch: `feature/auth-y-pages`
> Tests: **205 / 21 test files** (↑ desde 178)
> Última actualización: 2026-06-05

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

---

## 🔴 Pendiente — Prioridad Alta

### A2. Editar / eliminar movimientos
**Contexto:** Hoy los movimientos (gastos/ingresos_extra) solo se pueden registrar, no modificar ni eliminar. Si el admin se equivoca, no hay forma de corregirlo.
**Posible approach:** Agregar botones editar/eliminar en la lista de movimientos del Excel o en una nueva sección en JornadaPage.

### A3. Gestión de productos desde Admin
**Contexto:** `ProductosPage` solo lista y busca. No hay alta, baja ni modificación de productos desde la UI. Los productos se seedean desde `sqlite.service.ts` únicamente.
**Posible approach:** CRUD completo en AdminPage (o una página separada) con formulario de creación/edición + confirmación de eliminación.

---

## 🟡 Pendiente — Prioridad Media

### B4. Reabrir jornada
**Contexto:** Si una jornada se cierra por error (o el pending_close la cierra sin querer), no hay forma de reabrirla. El admin debería poder reabrir una jornada cerrada del día actual.
**Posible approach:** Botón "Reabrir" en HistorialPage para jornadas del día, solo admin. Vale `estado = 'abierta'`, limpia `hora_cierre` y `saldo_real`.

### B5. Stock mínimo / alertas
**Contexto:** No hay notificación cuando un producto tiene stock bajo. El admin tiene que ir a Inventario a mirar.
**Posible approach:** Señal de `stock_bajo` en Nav o badge rojo en inventario cuando `stock_actual < umbral` (ej: 5 unidades).

---

## 🟢 Pendiente — Prioridad Baja

### C5. Dashboard / página de inicio
**Contexto:** `/` redirige a `/pos`. No hay un dashboard con KPIs del día (ventas del día, jornada abierta/cerrada, productos más vendidos, ganancia del día, etc.).
**Posible approach:** Página separada o sección en POS con tarjetas de resumen.

### C6. Imprimir ticket / comprobante
**Contexto:** Después de cobrar, no se genera ningún comprobante para el cliente. Solo queda el registro en DB.
**Posible approach:** Ventana de impresión con detalle de la venta (productos, cantidades, total, forma de pago).

### C7. Exportación de datos histórica
**Contexto:** Solo se puede exportar el Excel de la jornada actual al cerrarla. No hay exportación de históricos (ej: todas las ventas del mes).
**Posible approach:** Botón "Exportar mes" en HistorialPage que genera un Excel con todas las jornadas del mes seleccionado.

### C8. Modo oscuro
**Contexto:** Toda la UI es modo claro. No hay toggle para modo oscuro.
**Posible approach:** Clase `.dark` en `document.documentElement` + persistencia en localStorage. Tailwind 4 tiene soporte nativo.

---

## Historial de cambios

| Fecha | Cambio | Commits |
|-------|--------|---------|
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
