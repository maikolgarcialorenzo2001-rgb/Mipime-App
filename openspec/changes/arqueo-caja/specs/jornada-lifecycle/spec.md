# Delta for Jornada Lifecycle

## ADDED Requirements

### Requirement: Arqueo Form Validation

The close-jornada form MUST require at least one non-zero denomination quantity before allowing closure.

#### Scenario: Close blocked with all zeroes

- GIVEN the confirm-close modal is open
- AND all denomination inputs are 0 or empty
- WHEN the admin clicks "Cerrar y descargar"
- THEN the button MUST be disabled
- AND no close operation is initiated

#### Scenario: Close enabled with one non-zero

- GIVEN the confirm-close modal is open
- WHEN the admin enters cantidad=1 for any denomination
- THEN the "Cerrar y descargar" button becomes enabled

### Requirement: saldo_real from Physical Count

The system MUST use `total_en_caja` (sum of denomination quantities × values) as `saldo_real`, replacing the auto-calculated value.

#### Scenario: Physical count overrides auto-calc

- GIVEN a jornada with monto_inicial=10000, total_ventas_efectivo=8000, total_movimientos=500
- AND auto-calculated saldo_real = 17500
- WHEN admin enters denominations totaling total_en_caja=17000
- THEN saldo_real in the jornadas UPDATE = 17000
- AND the old auto-calc value (17500) is ignored

### Requirement: Admin-Only Closure

The system MUST enforce that only users with role `admin` can close a jornada.

#### Scenario: Non-admin cannot close

- GIVEN a user with role `trabajador`
- AND an open jornada exists
- WHEN they try to open the close modal
- THEN the "Cerrar jornada" button MUST NOT be rendered
- AND `confirmarCierre()` MUST NOT be callable

## MODIFIED Requirements

### Requirement: Jornada Closure

The system MUST close a jornada with complete financial data, including arqueo physical count data, and generate an Excel report.

(Previously: Close without arqueo; saldo_real was auto-calculated)

#### Scenario: Close jornada with arqueo generates Excel

- GIVEN an open jornada with sales, movements, mermas, and pending arqueo data
- WHEN the admin confirms closure with total_en_caja=17000
- THEN estado changes to 'cerrada'
- AND hora_cierre, saldo_real=17000, user_cierre_id are set
- AND arqueo_caja rows are persisted
- AND Excel report is generated including arqueo denomination table
- AND jornadaAbierta signal is set to null
