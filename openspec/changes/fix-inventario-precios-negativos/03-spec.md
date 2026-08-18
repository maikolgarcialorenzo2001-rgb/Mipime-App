# Spec: fix-inventario-precios-negativos (F4)

## NEW Capability: `inventario`

### Purpose

Non-negative product pricing: every price/cost write path MUST reject values `< 0` (and NaN) before touching the DB, with early feedback in the inventory UI. `0` and `null` remain valid. This prevents negative investment (`obtenerInversionGlobal`) and contaminated COGS/ganancia via `venta_lotes` and merma.

### Requirement: R1 — `registrarEntrada` rejects negative or NaN `precioCosto` (service)

`StockMovimientoService.registrarEntrada` MUST validate `precioCosto` (alongside the existing quantity guard, after `_checkAdmin`, before any SQL) and MUST throw when `precioCosto < 0` or NaN. `precioCosto = 0` MUST remain accepted.

- **Código**: `src/app/services/stock-movimiento.service.ts` (~214) · **Tests**: `src/app/services/stock-movimiento.service.spec.ts` (describe 'guards de cantidad', espejo S-05) · **Mensaje**: `'El costo no puede ser negativo'`

#### Scenario: Negative cost rejected without touching the DB (testable)

- GIVEN an admin user and `registrarEntrada(productoId, 5, -5, ...)`
- WHEN the method runs
- THEN it rejects with `'El costo no puede ser negativo'`
- AND `mockDb.sql` is NOT called (no INSERT movimiento/lote, no UPDATE)

#### Scenario: NaN cost rejected (testable)

- GIVEN `registrarEntrada(productoId, 5, NaN, ...)`
- WHEN the method runs
- THEN it rejects with `'El costo no puede ser negativo'` and the DB is not touched

#### Scenario: Zero cost accepted (happy path) (testable)

- GIVEN an admin user and `registrarEntrada(productoId, 5, 0, 'Repo')`
- WHEN the method runs
- THEN it resolves and the entrada + lote with `precio_costo = 0` are persisted

### Requirement: R2 — `registrarEditar` rejects negative or NaN `precioVenta`/`precioCosto` (service)

`StockMovimientoService.registrarEditar` MUST validate both `precioVenta` and `precioCosto` (after the existing motivo/nombre/cantidad guards, before any SQL) and MUST throw when either is `< 0` or NaN. Both `0` values MUST remain accepted.

- **Código**: `src/app/services/stock-movimiento.service.ts` (~526) · **Tests**: `stock-movimiento.service.spec.ts` (espejo S-05) · **Mensaje**: `'El precio de venta no puede ser negativo'` / `'El costo no puede ser negativo'`

#### Scenario: Negative sale price rejected without touching the DB (testable)

- GIVEN an admin user and `registrarEditar(...)` with `precioVenta = -5`
- WHEN the method runs
- THEN it rejects with `'El precio de venta no puede ser negativo'`
- AND `mockDb.sql` is NOT called (no UPDATE productos/lote)

#### Scenario: Negative cost rejected without touching the DB (testable)

- GIVEN an admin user and `registrarEditar(...)` with `precioCosto = -5`
- WHEN the method runs
- THEN it rejects with `'El costo no puede ser negativo'` and the DB is not touched

#### Scenario: NaN in either price rejected (testable)

- GIVEN `precioVenta = NaN` or `precioCosto = NaN`
- WHEN the method runs
- THEN it rejects with the matching message and the DB is not touched

#### Scenario: Zero sale price and zero cost accepted (happy path) (testable)

- GIVEN an admin user and `registrarEditar(...)` with `precioVenta = 0`, `precioCosto = 0`
- WHEN the method runs
- THEN it resolves and the product/lote updates are persisted

### Requirement: R3 — `producto.crear`/`actualizar` reject negative or NaN prices (service)

`ProductoService.crear` and `ProductoService.actualizar` MUST validate `precio_costo` and `precio_venta` BEFORE executing their INSERT/UPDATE and MUST fail (error emitted to the observable caller) when either is `< 0` or NaN, leaving the DB untouched. Zero prices MUST remain accepted.

- **Código**: `src/app/services/producto.service.ts` `crear` (~44) y `actualizar` (~76) · **Tests**: `src/app/services/producto.service.spec.ts` (describes 'crear'/'actualizar') · **Mensaje**: `'El costo no puede ser negativo'` / `'El precio de venta no puede ser negativo'`

#### Scenario: crear with negative cost rejected before INSERT (testable)

- GIVEN `crear({ nombre, precio_costo: -5, precio_venta: 100, stock_almacen: 0 })`
- WHEN the observable is subscribed
- THEN it errors with `'El costo no puede ser negativo'`
- AND no INSERT into `productos` runs

#### Scenario: crear with negative sale price rejected (testable)

- GIVEN `crear({ ..., precio_venta: -100, ... })`
- WHEN the observable is subscribed
- THEN it errors with `'El precio de venta no puede ser negativo'` and no INSERT runs

#### Scenario: actualizar with negative price rejected before UPDATE (testable)

- GIVEN `actualizar(1, { nombre, precio_costo: 10, precio_venta: -1 })`
- WHEN the observable is subscribed
- THEN it errors with `'El precio de venta no puede ser negativo'` and no UPDATE runs

#### Scenario: NaN rejected in either method (testable)

- GIVEN `precio_costo = NaN` or `precio_venta = NaN` in `crear` or `actualizar`
- WHEN the observable is subscribed
- THEN it errors with the matching message and the DB is not touched

#### Scenario: Zero prices accepted (happy path) (testable)

- GIVEN `crear({ nombre, precio_costo: 0, precio_venta: 0, stock_almacen: 0 })`
- WHEN the observable is subscribed
- THEN it resolves with the created product and the INSERT persists

### Requirement: R4 — `guardarProducto` blocks negative prices with `formError` (page)

`InventarioPage.guardarProducto` MUST check `formCosto()` and `formPrecioVenta()` for `< 0` (NaN-safe, alongside the existing `=== null` checks) and MUST set `formError` and return BEFORE calling `ProductoService.crear` when either is negative. Zero MUST pass.

- **Código**: `src/app/pages/inventario/inventario.page.ts` `guardarProducto` (~413) · **Tests**: `src/app/pages/inventario/inventario.page.spec.ts` (describe guardarProducto) · **Mensaje**: `'El costo no puede ser negativo'` / `'El precio de venta no puede ser negativo'`

#### Scenario: Negative cost shows formError and never calls crear (testable)

- GIVEN the modal open with `formCosto() = -5` and all other fields valid
- WHEN `guardarProducto()` runs
- THEN `formError()` is `'El costo no puede ser negativo'`
- AND `productoService.crear` is NOT called

#### Scenario: Negative sale price shows formError and never calls crear (testable)

- GIVEN the modal open with `formPrecioVenta() = -5`
- WHEN `guardarProducto()` runs
- THEN `formError()` is `'El precio de venta no puede ser negativo'` and `crear` is NOT called

#### Scenario: Zero prices proceed to crear (happy path) (testable)

- GIVEN `formCosto() = 0` and `formPrecioVenta() = 0`
- WHEN `guardarProducto()` runs
- THEN `crear` IS called with those values

### Requirement: R5 — inline 'editar' blocks negative prices with `error` (page)

The `case 'editar'` in `onSubmitMovimiento` MUST check `editarPrecioVenta()`/`editarPrecioCosto()` for `< 0` (after the existing `=== null` checks) and MUST set `error` and return BEFORE calling `StockMovimientoService.registrarEditar` when either is negative. Zero MUST pass.

- **Código**: `src/app/pages/inventario/inventario.page.ts` case `'editar'` (~218) · **Tests**: `inventario.page.spec.ts` (describe editar inline) · **Mensaje**: `'El precio de venta no puede ser negativo'` / `'El costo no puede ser negativo'`

#### Scenario: Negative sale price shows error and never calls registrarEditar (testable)

- GIVEN the inline editar form with `editarPrecioVenta() = -5` and a selected lote
- WHEN `onSubmitMovimiento()` runs with action `'editar'`
- THEN `error()` is `'El precio de venta no puede ser negativo'`
- AND `mockStockService.registrarEditar` is NOT called

#### Scenario: Negative cost shows error and never calls registrarEditar (testable)

- GIVEN the inline editar form with `editarPrecioCosto() = -5`
- WHEN `onSubmitMovimiento()` runs with action `'editar'`
- THEN `error()` is `'El costo no puede ser negativo'` and `registrarEditar` is NOT called

#### Scenario: Zero prices proceed (happy path) (testable)

- GIVEN `editarPrecioVenta() = 0` and `editarPrecioCosto() = 0` with a selected lote
- WHEN `onSubmitMovimiento()` runs with action `'editar'`
- THEN `registrarEditar` IS called with those values

### Requirement: R6 — inline 'entrada' blocks negative cost with `error` (page)

The `case 'entrada'` in `onSubmitMovimiento` MUST check the movement cost for `< 0` (NaN-safe) and MUST set `error` and return BEFORE calling `StockMovimientoService.registrarEntrada` when negative. Empty cost (`null`) keeps mapping to `0` and MUST pass.

- **Código**: `src/app/pages/inventario/inventario.page.ts` case `'entrada'` (~149) · **Tests**: `inventario.page.spec.ts` (describe entrada) · **Mensaje**: `'El costo no puede ser negativo'`

#### Scenario: Negative cost shows error and never calls registrarEntrada (testable)

- GIVEN the entrada form with `movimientoCosto() = -5`
- WHEN `onSubmitMovimiento()` runs with action `'entrada'`
- THEN `error()` is `'El costo no puede ser negativo'`
- AND `mockStockService.registrarEntrada` is NOT called

#### Scenario: Empty cost maps to zero and proceeds (happy path) (testable)

- GIVEN the entrada form with `movimientoCosto() = null`
- WHEN `onSubmitMovimiento()` runs with action `'entrada'`
- THEN `registrarEntrada` IS called with cost `0`

### Requirement: R7 — `0` and `null` remain valid everywhere the model allows

All guards MUST reject only `< 0` / NaN. `0` MUST be accepted by every validated entry (R1–R6). `null` MUST remain accepted where the model allows it: nullable legacy `precio_costo` in the DB is never blocked by the service guards, and empty cost in the UI entrada path maps to `0`.

- **Código**: guards `!(v >= 0)` en servicios y página · **Tests**: happy paths de R1–R6 + specs existentes verdes (null `precio_costo`) · **Mensaje**: n/a (sin error)

#### Scenario: Zero cost product still creatable (testable)

- GIVEN `precio_costo = 0` in any write path (entrada, editar, crear, actualizar)
- WHEN the operation runs
- THEN it is accepted and persisted

#### Scenario: Null cost not blocked by service guards (testable)

- GIVEN a write path receiving a `null` `precio_costo` (nullable legacy column)
- WHEN the operation runs
- THEN the guard does NOT reject it (only `< 0` / NaN throw)

## Fuera de alcance

- Legacy negative rows are NOT sanitized (only new entries blocked; editing a contaminated product forces the fix).
- DB CHECK constraint (`>= 0`) — requires migration v18 (F2 already touches versioning).
- F1–F3, F5–F9 of `docs/Fix-Inventario-Bugs.md`.
- `_syncPrecioCosto`/`_consumirFIFO`/`registrarAjuste`/`registrarAjusteLote` propagation (no price input); `registrarEntradaAlmacen` inherits the guard as it delegates to `registrarEntrada`.
- POS / checkout-modal / cobro-pendiente flows (they only READ prices).
