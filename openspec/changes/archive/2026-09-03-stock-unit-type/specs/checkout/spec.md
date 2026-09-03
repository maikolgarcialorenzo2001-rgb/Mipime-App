# Delta for Checkout — stock-unit-type

## MODIFIED Requirements

### Requirement: Quantity input — conditional decimal behavior

The quantity-input component MUST accept a `unidad` input property of type `'unidad' | 'gramaje'`. When `unidad = 'unidad'`: inputmode is `"numeric"`, keystroke filter allows digits only, increment/decrement step is 1. When `unidad = 'gramaje'`: inputmode is `"decimal"`, keystroke filter allows digits and one decimal point, increment/decrement step is 0.1, max 2 decimal places enforced.

(Previously: input was always integer-only with `inputmode="numeric"`, digits-only filter, and ±1 step.)

#### Scenario: Unidad product — integer input enforced

- GIVEN a quantity-input with `unidad = 'unidad'`
- WHEN the user types "5.3"
- THEN the input shows "53" (decimal point filtered out)
- AND inputmode is "numeric"

#### Scenario: Gramaje product — decimal input allowed

- GIVEN a quantity-input with `unidad = 'gramaje'`
- WHEN the user types "2.5"
- THEN the input shows "2.5"
- AND inputmode is "decimal"

#### Scenario: Gramaje product — max 2 decimal places

- GIVEN a quantity-input with `unidad = 'gramaje'` and current value "1.2"
- WHEN the user types a third decimal digit (e.g. "5")
- THEN the input rejects the keystroke and shows "1.2"

#### Scenario: Gramaje product — increment by 0.1

- GIVEN a quantity-input with `unidad = 'gramaje'` and value "2.0"
- WHEN the user taps the increment button
- THEN the value becomes "2.1"

#### Scenario: Unidad product — increment by 1

- GIVEN a quantity-input with `unidad = 'unidad'` and value "3"
- WHEN the user taps the increment button
- THEN the value becomes "4"

## ADDED Requirements

### Requirement: POS keyboard shortcuts — gramaje step

POS page keyboard shortcuts for quantity increment/decrement MUST use step 0.1 for gramaje products and step 1 for unidad products. The `unidad_medida` of the selected product MUST determine the step at shortcut time.

#### Scenario: Gramaje keyboard shortcut

- GIVEN a gramaje product selected in POS with cantidad = 2.0
- WHEN the user presses the increment keyboard shortcut
- THEN cantidad becomes 2.1

#### Scenario: Unidad keyboard shortcut

- GIVEN a unidad product selected in POS with cantidad = 3
- WHEN the user presses the decrement keyboard shortcut
- THEN cantidad becomes 2
