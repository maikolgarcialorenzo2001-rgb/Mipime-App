# Delta for Excel Reportes

## ADDED Requirements

### Requirement: Abierta por / Cerrada por when opener differs from closer

The `JornadaReportData` MUST carry an optional additive field `userAperturaNombre: string | null` resolved from `user_apertura_id` (JOIN `usuarios`) at the same points where `userCierreNombre` is resolved today. In `_agregarResumen` and `_agregarJornadaSheet`, when BOTH `userAperturaNombre` and `userCierreNombre` exist AND differ, the sheet MUST write two rows `['Abierta por', userAperturaNombre]` and `['Cerrada por', userCierreNombre]`.

(Previously: only `['Firmado por', userCierreNombre]` was written; there was no opener name in the report data.)

#### Scenario: Resumen sheet shows opener and closer

- GIVEN a jornada opened by "Ana" (`user_apertura_id` names "Ana") and closed by "Beto"
- WHEN the Resumen sheet is generated
- THEN rows read "Abierta por Ana" and "Cerrada por Beto"

#### Scenario: JornadaSheet shows opener and closer

- **GIVEN the same jornada with different opener/closer**
- **WHEN the JornadaSheet is generated**
- **THEN it also includes "Abierta por Ana" and "Cerrada por Beto"**

### Requirement: Back-compat "Firmado por" when same user or legacy

When `userAperturaNombre` is null (legacy jornada without opener) OR opener and closer are the same user, the report MUST keep the current single row `['Firmado por', userCierreNombre]`. If `userCierreNombre` is also null, neither row is written (current behavior preserved).

#### Scenario: Same user opened and closed

- **GIVEN `userAperturaNombre` equals `userCierreNombre` ("Ana")**
- **WHEN the report is generated**
- **THEN the single row "Firmado por Ana" is written**

#### Scenario: Legacy jornada without opener name

- GIVEN `userAperturaNombre = null` and `userCierreNombre = "Beto"`
- WHEN the report is generated
- THEN the single row "Firmado por Beto" is written (no "Abierta por")

#### Scenario: Existing reports untouched

- GIVEN previously saved Excel reports
- WHEN the app is upgraded
- THEN stored `jornada_reportes` base64 content is never regenerated or altered