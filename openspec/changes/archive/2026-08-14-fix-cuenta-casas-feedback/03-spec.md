# Spec: fix-cuenta-casas-feedback

## NEW Capability: `cuenta-cosas`

### Purpose

Register product withdrawals charged to the owners ("cuenta casas") without mediating a sale. Each withdrawal decrements stock and appears as a negative value in the jornada Excel. Cuenta casas MUST NOT affect cash register totals (`total_ventas`, `saldo_esperado`).

### Requirement: Batch registration — `registrarLote(jornadaId, items[], descripcion, autorizadoPor)`

`CuentaCosasService.registrarLote` MUST insert exactly one `cuenta_cosas` row per item, each row carrying that item's own `cantidad`; MUST validate stock for ALL items BEFORE inserting any row; and MUST wrap stock validation + all inserts + all stock salidas in a single transaction (BEGIN/COMMIT/ROLLBACK). If any item fails, the system MUST persist NOTHING and surface the error. The system MUST record one stock salida per item with that item's own `cantidad` and MUST apply the batch `descripcion` and `autorizadoPor` to every row.

#### Scenario: Multi-product sale registers N rows and N salidas (testable)

- GIVEN a cart with product A×2 and product B×3 and sufficient stock for both
- WHEN `registrarLote(jId, [{A,2},{B,3}], "Retiro familiar", "María")` runs
- THEN exactly 2 `cuenta_cosas` rows are inserted (A=2, B=3)
- AND exactly 2 stock salidas are recorded (A−2, B−3)
- AND both rows carry `descripcion = "Retiro familiar"` and `autorizado_por = "María"`

#### Scenario: Partial failure persists nothing (testable)

- GIVEN A×2 with stock 10 and B×3 with stock 2
- WHEN `registrarLote` runs
- THEN stock validation fails for B before any insert, the transaction ROLLBACKs
- AND zero `cuenta_cosas` rows persist and zero salidas are recorded
- AND an error is surfaced to the caller

#### Scenario: Single item with insufficient stock (testable)

- GIVEN product C×5 with `stock_actual = 3`
- WHEN `registrarLote` runs
- THEN the operation is rejected with a "Stock insuficiente" error
- AND no row is inserted and no salida is recorded

#### Scenario: Empty items array (testable)

- GIVEN `items` is an empty array
- WHEN `registrarLote` runs
- THEN nothing is persisted and the method completes without error

### Requirement: List by jornada — `listarPorJornada(jornadaId): Promise<CuentaCosa[]>`

`CuentaCosasService.listarPorJornada` MUST return all `cuenta_cosas` rows for the given jornada ordered by `created_at` ASC, and MUST return an empty array when the jornada has no rows.

#### Scenario: Rows returned in chronological order (testable)

- GIVEN a jornada with 3 rows created at 08:00, 09:30 and 09:00
- WHEN `listarPorJornada(jId)` is called
- THEN rows are returned ordered by `created_at` ASC (08:00 first, 09:30 last)

#### Scenario: Jornada without rows (testable)

- GIVEN a jornada with zero `cuenta_cosas` rows
- WHEN `listarPorJornada(jId)` is called
- THEN the result is an empty array

### Requirement: Single-item registration retained — `registrar(...)`

`CuentaCosasService.registrar` MUST keep its existing semantics (one row + one stock salida) and MAY delegate to `registrarLote` as an implementation detail.

#### Scenario: Single product registration unchanged (testable)

- GIVEN product X, cantidad 2, autorizado por "Juan"
- WHEN `registrar(jId, X, 2, null, "Juan")` is called
- THEN one `cuenta_cosas` row is inserted and one salida (X−2) is recorded

## MODIFIED Capability: `checkout` (delta)

### ADDED Requirements

### Requirement: Cuenta Cosas path registers per-product rows

`confirmarVenta` with `formaPago = 'cuenta_cosas'` MUST call `registrarLote` with one item per cart product, each carrying its own `cantidad` (no collapse to `items[0]`), and MUST apply `payload.descripcion` and `payload.autorizadoPor` to the whole batch. When the cart is empty, `confirmarVenta` MUST return early without calling any service.

(Added: no existing checkout requirement covered this path; replaces the buggy collapse-to-first-product behavior in `pos.page.ts`.)

#### Scenario: Multi-product cart calls registrarLote per product (testable)

- GIVEN a cart with A×2 and B×3 and `formaPago = 'cuenta_cosas'`
- WHEN `confirmarVenta` runs
- THEN `registrarLote` is called with `[{A,2},{B,3}]`
- AND the single-item `registrar` is NOT called

#### Scenario: Empty cart guard (testable)

- GIVEN an empty cart and `formaPago = 'cuenta_cosas'`
- WHEN `confirmarVenta` runs
- THEN the method returns early and no service call is made

#### Scenario: Sale metadata applies to the whole batch (testable)

- GIVEN `payload.descripcion = "Retiro familiar"` and `payload.autorizadoPor = "María"`
- WHEN `confirmarVenta` runs
- THEN `registrarLote` receives those `descripcion` and `autorizadoPor` values for the batch

## MODIFIED Capability: `jornada-lifecycle` (delta)

### ADDED Requirements

### Requirement: Cuenta Casas del día feedback block

The "ventas del día" card MUST render a "Cuenta Casas del día" block when the open jornada has ≥1 `cuenta_cosas` row. Each row MUST show: Producto (name resolved via `productosMap`), Cantidad, Descripción, Autorizado por, and Hora (`created_at | date:'short'`). Rows MUST be fetched via `listarPorJornada(jornadaId)` as part of `_cargarDatosDiarios`, ordered by `created_at` ASC. When there is no open jornada or the load fails, the list MUST be cleared. Cash register totals MUST NOT be affected.

#### Scenario: Jornada with rows shows the block (testable)

- GIVEN an open jornada with 2 rows created at 08:00 and 09:00
- WHEN `_cargarDatosDiarios` completes
- THEN the "Cuenta Casas del día" block renders 2 rows with Producto, Cantidad, Descripción, Autorizado por and Hora, in chronological order

#### Scenario: Jornada without rows hides the block (testable)

- GIVEN an open jornada with zero `cuenta_cosas` rows
- WHEN `_cargarDatosDiarios` completes
- THEN the "Cuenta Casas del día" block is NOT rendered

#### Scenario: Product name resolved via productosMap (testable)

- GIVEN a row with `producto_id = P`
- WHEN the block renders
- THEN the Producto column shows the product name from `productosMap` (same mechanism as the ventas/movimientos blocks)

#### Scenario: No open jornada or load failure clears the list (testable)

- GIVEN no open jornada, or `_cargarDatosDiarios` throws
- WHEN the daily data resets
- THEN `cuentasCosasDelDia` is empty and the block is hidden
