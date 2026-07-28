# Delta for Excel Reportes

## ADDED Requirements

### Requirement: JornadaReportData.arqueoCaja Field

The `JornadaReportData` interface MUST include an optional `arqueoCaja` array.

#### Scenario: Interface includes arqueo data

- GIVEN `JornadaReportData` is defined
- THEN it MUST have `arqueoCaja?: ArqueoCaja[]`
- AND `_recolectarDatosJornada` MUST LEFT JOIN `arqueo_caja` and populate the field
- AND monthly/range exports MUST include arqueo data for each jornada

### Requirement: Arqueo Section in Resumen Sheet

The individual jornada Excel MUST include an "Arqueo de Caja" section in the Resumen sheet.

#### Scenario: Full arqueo breakdown

- GIVEN a jornada with arqueo rows: 5000×2, 1000×3, 200×0, 50×10
- WHEN `_agregarResumen` renders
- THEN the sheet contains a header "Arqueo de Caja"
- AND rows for each non-zero denomination: denomination label + cant + subtotal
- AND a "Total en caja" row = 5000×2 + 1000×3 + 50×10 = 13,500
- AND zero-quantity denominations are omitted

#### Scenario: Sobrante section

- GIVEN arqueo total_en_caja=14000 > saldo_esperado=13500
- WHEN the Resumen sheet is generated
- THEN a "Sobrante" section shows difference = 500
- AND "Diferencia" row reflects sobrante

#### Scenario: Faltante section

- GIVEN arqueo total_en_caja=13000 < saldo_esperado=13500
- WHEN the Resumen sheet is generated
- THEN a "Faltante" section shows difference = -500
- AND "Diferencia" row reflects faltante

#### Scenario: No arqueo (legacy jornada)

- GIVEN a jornada with arqueoCaja = []
- WHEN `_agregarResumen` renders
- THEN no "Arqueo de Caja" section appears
- AND existing "Saldo real" and "Diferencia" rows still render if saldo_real is set

### Requirement: Arqueo in Monthly/Range Excel

The monthly and range Excel exports MUST include the arqueo breakdown for each individual jornada sheet.

#### Scenario: Monthly sheet has arqueo

- GIVEN a monthly export with 3 jornadas, each with arqueo data
- WHEN `_agregarJornadaSheet` renders for each
- THEN each jornada's sheet includes the "Arqueo de Caja" section
- AND the "Resumen del Mes" sheet DOES NOT consolidate arqueo data (per-jornada only)
