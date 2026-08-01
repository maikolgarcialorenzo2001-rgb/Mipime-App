# Delta for merma-tracking

## MODIFIED Requirements

### Requirement: Register Merma

The system MUST allow registering merma (product damage/loss) with a mandatory motivo, consuming stock via FIFO from either shop or almacén location.

(Previously: motivo optional, only shop location, no UI pre-submit validation or confirmation)

#### Scenario: Register merma for a product (updated)

- GIVEN a product with stock > 0 in InventarioPage
- WHEN the user clicks "Merma", enters quantity and a non-empty motivo
- THEN stock MUST be reduced via FIFO (oldest lots consumed first)
- AND a `stock_movimientos` record with `tipo = 'merma'` is created
- AND `costo_total` equals the sum of FIFO consumption costs
- AND the product stock badge updates immediately

#### Scenario: Merma with empty motivo

- GIVEN any product with stock > 0
- WHEN motivo is empty or whitespace-only
- THEN the service MUST throw "Motivo es obligatorio"
- AND no stock or movement is modified

#### Scenario: Register merma in almacén

- GIVEN a product with ubicación = 'almacén' and stock > 0
- WHEN the user registers merma with a valid motivo
- THEN stock MUST be reduced from almacén lots via FIFO
- AND the movement `ubicacion` = 'almacén'

#### Scenario: Merma exceeds available stock

- GIVEN a product with stock = 3
- WHEN the user tries to register merma of 5 units
- THEN the system MUST show an error "Stock insuficiente"
- AND no stock or movement is modified

#### Scenario: Merma with zero stock

- GIVEN a product with stock = 0
- WHEN the user clicks "Merma"
- THEN the button MUST be disabled or the form MUST show an error

#### Scenario: UI blocks merma when cantidad > stock

- GIVEN visible stock = 10 on the producto page
- WHEN the user enters cantidad = 15
- THEN the submit button MUST be disabled
- AND a stock-warning message MUST be visible
- AND the service is NOT called

#### Scenario: Confirmation modal before registro

- GIVEN valid cantidad (≤ stock) and non-empty motivo
- WHEN the user clicks "Registrar merma"
- THEN a confirmation modal MUST display: producto, cantidad, costo total estimado, motivo, ubicación
- AND clicking "Confirmar" calls `registrarMerma()`
- AND clicking "Cancelar" or pressing Escape dismisses without action

### Requirement: Merma in Jornada Daily Table

The system MUST display merma entries in the JornadaPage daily table alongside sales and movements, including the ubicación column.

(Previously: entries showed product name, quantity, cost, timestamp — no ubicación)

#### Scenario: Daily table includes merma section (updated)

- GIVEN a jornada with 2 merma entries (one shop, one almacén)
- WHEN the JornadaPage renders
- THEN a "Mermas" section MUST appear in the daily table
- AND each merma entry shows: product name, quantity, cost, timestamp, ubicación
- AND the total merma amount is displayed

#### Scenario: Daily table empty when no mermas

- GIVEN a jornada with 0 merma entries
- WHEN the JornadaPage renders
- THEN the "Mermas" section MUST show "No hay mermas registradas"
