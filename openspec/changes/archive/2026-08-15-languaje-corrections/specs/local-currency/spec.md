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
