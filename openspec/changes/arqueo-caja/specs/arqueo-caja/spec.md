# Arqueo de Caja Specification

## Purpose

Bill counting physical count form at jornada close — denomination entry, real-time total calculation, optional $1/$3 denominations, and persistence of count data for Excel regeneration.

## Requirements

### Requirement: Denomination Constants

The system MUST export a constant array `DENOMINACIONES` with all bill denominations in descending order.

#### Scenario: Ordered denominations

- GIVEN the application initializes
- THEN `DENOMINACIONES` MUST equal `[5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1]`
- AND optional denominations (1, 3) MUST be identifiable via a separate constant `DENOMINACIONES_OPCIONALES = [3, 1]`

### Requirement: ArqueoCaja Interface

The system MUST provide an `ArqueoCaja` TypeScript interface.

#### Scenario: Interface shape

- GIVEN the `ArqueoCaja` type
- THEN it MUST contain: `id: number`, `jornada_id: number`, `denominacion: number`, `cantidad: number`, `created_at: string`

### Requirement: DB Migration v13

The system MUST create the `arqueo_caja` table via migration v13.

#### Scenario: Table creation

- GIVEN migration v13 executes
- THEN `CREATE TABLE arqueo_caja (id INTEGER PRIMARY KEY AUTOINCREMENT, jornada_id INTEGER NOT NULL REFERENCES jornadas(id), denominacion REAL NOT NULL, cantidad REAL NOT NULL, created_at TEXT NOT NULL)`
- AND `CREATE INDEX idx_arqueo_caja_jornada ON arqueo_caja(jornada_id)`
- AND schema_version updates to 13

### Requirement: Persist Arqueo on Close

When a jornada closes, the system MUST insert one `arqueo_caja` row per non-zero denomination entered.

#### Scenario: Insert all non-zero counts

- GIVEN admin enters cantidades = {5000: 2, 1000: 3, 200: 5, 50: 10}
- AND all other denominations are 0
- WHEN the jornada closes
- THEN 4 rows are inserted into `arqueo_caja` with the correct `jornada_id`, `denominacion`, and `cantidad`
- AND rows with cantidad=0 MUST NOT be inserted

#### Scenario: Persisted data survives page reload

- GIVEN arqueo data was saved for jornada #42
- WHEN the user views the jornada report after page reload
- THEN `_recolectarDatosJornada(42)` returns the arqueo rows in `arqueoCaja` field

### Requirement: Jornadas Without Arqueo

The system MUST handle jornadas closed before migration v13 (no arqueo data) gracefully.

#### Scenario: Null arqueo for old jornadas

- GIVEN a jornada closed before migration v13
- WHEN `_recolectarDatosJornada` fetches arqueo data
- THEN `arqueoCaja` is an empty array `[]`
- AND Excel generation does NOT render the arqueo section
