# Local Currency Specification

## Purpose

Definir cómo la app muestra montos monetarios como moneda local genérica («pesos»), sin exponer identificadores regionales (ARS, CUP) ni etiquetas como «pesos cubanos», para cualquier hispanohablante.

## Requirements

### Requirement: Moneda local = pesos genérico

La app DEBE formatear todo monto monetario de la UI como «pesos» genérico con símbolo `$`, sin exponer códigos de país (ARS, CUP) ni «pesos cubanos». La moneda local DEBE definirse en una única constante `MONEDA_LOCAL` en `src/app/core/constants.ts`, con símbolo `$`.

El sistema DEBE proveer un pipe único `pesos` que envuelva el formateo de moneda usando `MONEDA_LOCAL`. Los templates `*.html` DEBEN usar el pipe `pesos` en todo monto monetario.

#### Scenario: Monto formateado como pesos genérico

- GIVEN un monto de 1950
- WHEN se renderiza con el pipe `pesos`
- THEN se muestra con símbolo `$` y sin sufijo "ARS"

#### Scenario: Sin código ARS en templates

- GIVEN el código fuente de los templates `*.html` en `src/`
- WHEN se busca `currency:'ARS'`
- THEN no hay coincidencias y el pipe `pesos` se usa en su lugar

#### Scenario: Sin CUP ni «pesos cubanos» en la UI

- GIVEN la UI renderizada
- WHEN un usuario inspecciona cualquier etiqueta de dinero
- THEN nunca contiene "CUP", "ARS" ni "pesos cubanos"

### Requirement R1: Money formatting unification (MUST)

(Del delta `premium-frontend-p0-p1` — capability local-currency MODIFIED, archivado 2026-09-12. Trazabilidad: engram `sdd/premium-frontend-p0-p1/archive-report`.)

All money figures MUST render through the `pesos` pipe: `pesos:'1.2-2'` for amounts with decimals, `pesos:'1.0-0'` for round summaries. Raw `toLocaleString`/`toFixed(2)` MUST NOT remain in templates (jornada, inventario, app-nav, jornada-summary-card). Existing specs asserting old strings MUST be updated to pesos.pipe.spec.ts references.
(Previously: 4 formats — pipe in pos/historial/productos, toLocaleString in jornada+app-nav, toFixed(2) in inventario, bare numbers in jornada-summary-card.)

#### Scenario: Decimal amount in inventario

- GIVEN inventario list with unit price 1500
- WHEN the page renders
- THEN figure shows `$1,500.00` and no `toFixed(2)` output remains

#### Scenario: Round summary in jornada

- GIVEN jornada total 150000
- WHEN jornada-summary-card renders
- THEN total shows `$150,000` (grouped, no decimals)

### Requirement R2: tabular-nums on every money figure (MUST)

(Del delta `premium-frontend-p0-p1`, archivado 2026-09-12.)

Every money figure MUST apply `tabular-nums`: POS total, checkout/cobro totals, jornada-summary-card dd, app-nav total. Non-money text MUST NOT be affected.

#### Scenario: POS total alignment

- GIVEN cart total updates across transactions
- WHEN digits change
- THEN columns do not shift (tabular-nums on total)

#### Scenario: All four surfaces

- GIVEN money figures on POS, checkout, jornada-summary-card, nav
- WHEN markup is inspected
- THEN each carries tabular-nums and only money elements do
