# Merma Tracking Specification

## Purpose

Define the behavior for registering product shrinkage/damage (merma) with FIFO costing, reflected in the daily jornada financials.

## Requirements

### Requirement: Register Merma

The system MUST allow registering merma (product damage/loss) with a mandatory motivo, consuming stock via FIFO from either shop or almacén location.

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

### Requirement: Merma Affects Jornada Financials

The system MUST include merma cost in the jornada's financial calculations.

#### Scenario: Saldo esperado includes merma

- GIVEN a jornada with monto_inicial=10000, total_ventas=5000, total_gastos=500
- WHEN merma of $300 is registered
- THEN saldo_esperado MUST be 10000 + 5000 - 500 - 300 = 14200
- AND total_merma = 300

#### Scenario: Multiple mermas accumulate

- GIVEN a jornada with total_merma = 0
- WHEN merma of $200 is registered
- AND merma of $150 is registered
- THEN total_merma MUST be 350
- AND saldo_esperado MUST reflect the total deduction

### Requirement: Merma Displayed in Jornada Summary

The system MUST show total_merma in the jornada summary card.

#### Scenario: Summary card shows merma

- GIVEN a jornada with total_merma = 300
- WHEN the jornada summary card renders
- THEN a "Mermas" field MUST display $300
- AND the value MUST be styled as a deduction (red/negative indicator)

### Requirement: Merma in Jornada Daily Table

The system MUST display merma entries in the JornadaPage daily table alongside sales and movements, including the ubicación column.

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

### Requirement: Merma in Excel Report

The system MUST include merma data in the Excel report generated at jornada closure.

#### Scenario: Excel includes merma sheet or section

- GIVEN a jornada with merma entries
- WHEN the jornada is closed
- THEN the Excel report MUST include merma data (product, quantity, cost)
- AND the merma total MUST be reflected in the financial summary

### Requirement: Merma Uses FIFO Costing

The system MUST calculate merma cost using FIFO from the oldest lots, not the current product price.

#### Scenario: FIFO cost differs from current price

- GIVEN a product with lot1 (qty=5, cost=$8) and lot2 (qty=10, cost=$10), current price=$12
- WHEN merma of 3 units is registered
- THEN the cost MUST be 3 × $8 = $24 (from lot1, the oldest)
- AND lot1 quantity MUST be reduced to 2

#### Scenario: Merma spans multiple lots

- GIVEN a product with lot1 (qty=2, cost=$8) and lot2 (qty=10, cost=$10)
- WHEN merma of 5 units is registered
- THEN lot1 is fully consumed (2 × $8 = $16)
- AND lot2 consumes 3 units (3 × $10 = $30)
- AND total cost = $46
