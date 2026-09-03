# Inventario Operaciones Specification

## Purpose

Product registration with per-product unit type (unidad vs gramaje), DB migration, and dynamic unit suffix display across all inventory UI points.

## Requirements

### Requirement: Database migration V19 — unidad_medida column

The system MUST add `unidad_medida TEXT NOT NULL DEFAULT 'unidad'` to the `productos` table via migration V19. All existing products MUST receive the default value `'unidad'` with no data loss.

> **Spec drift note**: Original proposal/spec said "V12", but `db-migrations.ts` was already at V18 and V12 is taken (`total_gastos → total_movimientos`). Canonical version is V19. See `design.md` § Correction to Proposal/Spec.

#### Scenario: New column exists after migration

- GIVEN the database is at version < V19
- WHEN migration V19 runs
- THEN `productos.unidad_medida` exists with type TEXT NOT NULL
- AND all existing rows have `unidad_medida = 'unidad'`

#### Scenario: New product stores unidad_medida

- GIVEN a user creates a product with `unidad_medida = 'gramaje'`
- WHEN the product is inserted into `productos`
- THEN the row stores `unidad_medida = 'gramaje'`

### Requirement: Producto interface — unidad_medida field

The `Producto` TypeScript interface MUST include `unidad_medida: 'unidad' | 'gramaje'`. All code reading product objects MUST have access to this field.

#### Scenario: Interface type narrowing

- GIVEN a `Producto` with `unidad_medida = 'gramaje'`
- WHEN TypeScript narrows the type
- THEN the value is assignable to the `'unidad' | 'gramaje'` union

### Requirement: Product registration — unit type selector

The inventario product form MUST render a unit type selector (radio or toggle) with two options: "Unidad" and "Gramaje". The selector MUST be required — form submission is blocked when no value is selected. Default value MUST be `'unidad'`.

#### Scenario: Create product with unidad

- GIVEN the user opens the product creation form
- WHEN they select "Unidad" and submit
- THEN the product is saved with `unidad_medida = 'unidad'`

#### Scenario: Create product with gramaje

- GIVEN the user opens the product creation form
- WHEN they select "Gramaje" and submit
- THEN the product is saved with `unidad_medida = 'gramaje'`

#### Scenario: Form validation — no selection

- GIVEN the user opens the product creation form
- WHEN they leave the unit type unselected and attempt to submit
- THEN the form is blocked with a validation error

### Requirement: Stock badge — dynamic unit suffix

The stock badge component MUST display `"u."` suffix for products with `unidad_medida = 'unidad'` and `"lb"` suffix for `unidad_medida = 'gramaje'`. The product's `unidad_medida` MUST be passed as an input property.

#### Scenario: Unidad product badge

- GIVEN a product with `unidad_medida = 'unidad'` and stock = 5
- WHEN the stock badge renders
- THEN the display shows "5 u."

#### Scenario: Gramaje product badge

- GIVEN a product with `unidad_medida = 'gramaje'` and stock = 2.5
- WHEN the stock badge renders
- THEN the display shows "2.5 lb"

### Requirement: Lot selectors — dynamic unit suffix

Inventario page lot selectors MUST display `"u"` suffix for unidad lots and `"lb"` for gramaje lots. The suffix MUST match the parent product's `unidad_medida`.

#### Scenario: Unidad lot selector

- GIVEN a lot with `cantidad = 10` for a unidad product
- WHEN the lot selector renders
- THEN the display shows "10u"

#### Scenario: Gramaje lot selector

- GIVEN a lot with `cantidad = 3.2` for a gramaje product
- WHEN the lot selector renders
- THEN the display shows "3.2lb"

### Requirement: Stock operation toast — dynamic unit suffix

Stock operation success toasts MUST display `" u"` suffix for unidad products and `" lb"` for gramaje products.

#### Scenario: Unidad toast

- GIVEN a stock operation on a unidad product with result quantity = 15
- WHEN the toast displays
- THEN the message shows "15 u"

#### Scenario: Gramaje toast

- GIVEN a stock operation on a gramaje product with result quantity = 4.7
- WHEN the toast displays
- THEN the message shows "4.7 lb"
