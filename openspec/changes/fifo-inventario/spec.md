# FIFO Inventario — Specification

## Domain: lotes_stock (NEW)

### Purpose
Track stock batches with individual cost basis for FIFO consumption.

### Requirements

#### R1: Lot creation on stock entry
When stock enters the system (via inventario entry, purchase, or any entry), a new `lotes_stock` record MUST be created with:
- `producto_id`: the product
- `cantidad`: number of units entering
- `precio_costo`: cost per unit for this batch
- `fecha_ingreso`: timestamp of entry

#### R2: Lot consumption on sale (FIFO)
When a sale is processed, stock MUST be consumed from the oldest lot first (ORDER BY fecha_ingreso ASC, then id ASC). If the oldest lot doesn't cover the full quantity, consume from the next lot, and so on.

#### R3: venta_lotes recording
For each lot consumed during a sale, a `venta_lotes` record MUST be created with:
- `venta_id`: the sale
- `lote_id`: which lot was consumed
- `producto_id`: the product
- `cantidad`: how many units from this lot
- `precio_costo_real`: the actual cost from this lot

#### R4: Stock total calculation
`productos.stock_actual` MUST equal `SUM(lotes_stock.cantidad)` for all lots of that product where `cantidad > 0`.

### Scenarios

**Given** a product "Café" with no lots
**When** 10 units enter at $5.00/unit
**Then** one lot exists: {cantidad: 10, precio_costo: 5.00}
**And** product stock_actual = 10

**Given** a product "Café" with one lot of 10 at $5.00
**When** 5 more units enter at $7.00/unit
**Then** two lots exist: [{10, $5}, {5, $7}]
**And** product stock_actual = 15

**Given** a product "Café" with lots [{10, $5}, {10, $8}]
**When** a sale of 11 units is processed
**Then** lot 1 is consumed entirely (cantidad = 0)
**And** lot 2 has 9 units remaining
**And** venta_lotes contains [{cantidad: 10, precio_costo_real: 5}, {cantidad: 1, precio_costo_real: 8}]
**And** product stock_actual = 9

**Given** a product "Café" with lots [{5, $5}]
**When** a sale of 6 units is attempted
**Then** the sale FAILS with insufficient stock error

**Given** a product "Café" with lots [{10, $5}, {10, $8}]
**When** a stock adjustment sets stock to 12
**Then** all existing lots are removed
**And** one new lot is created with cantidad = 12 and precio_costo = weighted average of removed lots

## Domain: venta.service (MODIFIED)

### Requirements

#### R5: FIFO consumption during sale
VentaService.registrar() MUST consume stock via FIFO lot consumption instead of direct stock_actual UPDATE.

#### R6: Transaction atomicity
FIFO consumption and venta_lotes inserts MUST happen within the same database transaction as the sale.

### Scenarios

**Given** product "Café" with lots [{10, $5}, {10, $8}] and price $12
**When** a sale of 11 units is registered
**Then** venta_lotes has 2 records
**And** product stock_actual = 9
**And** sale total = $132
**And** gross cost = $58 (10×5 + 1×8)

## Domain: jornada.service (MODIFIED)

### Requirements

#### R7: Gross income from venta_lotes
JornadaService._recolectarDatosJornada() MUST calculate totalCosto from venta_lotes.precio_costo_real instead of product.precio_costo.

### Scenarios

**Given** a jornada with sales consuming lots at $5 and $8
**When** the jornada report is generated
**Then** totalCosto = sum of (venta_lotes.cantidad × venta_lotes.precio_costo_real)
**And** gross income = total_ventas - totalCosto

## Domain: inventario.page (MODIFIED)

### Requirements

#### R8: Entry form requires precio_costo
The stock entry form MUST include a required `precio_costo` field.

#### R9: Product display with lots
The inventory page MUST display products grouped by name with lot details expandable.

### Scenarios

**Given** the inventory page
**When** adding stock to a product
**Then** a precio_costo field is required
**And** a new lot is created

**Given** a product with 3 lots
**When** viewing the inventory page
**Then** the product shows total stock (sum of all lots)
**And** expanding shows individual lots with quantity and cost

## Domain: migration v8 (NEW)

### Requirements

#### R10: Backfill existing products
Migration v8 MUST create one initial lot for each existing product with stock_actual > 0.

### Scenarios

**Given** a product with stock_actual = 20 and precio_costo = 5
**When** migration v8 runs
**Then** one lot is created: {producto_id, cantidad: 20, precio_costo: 5}
**And** product stock_actual remains 20

**Given** a product with stock_actual = 15 and precio_costo = null
**When** migration v8 runs
**Then** one lot is created: {producto_id, cantidad: 15, precio_costo: 0}
**And** a warning is logged