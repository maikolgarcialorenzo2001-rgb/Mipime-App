# Accessibility Specification — lint-corrections delta

> Delta from change `lint-corrections` (BACKLOG-11): domain nuevo — los únicos
> cambios DOM del refactor son atributos a11y que la suite de tests no cubre.
> Estas requirements son el contrato de verificación visual de ese cambio.

## Purpose

Garantías de accesibilidad de los templates (`src/**/*.html`): labels asociados
a sus controles, operabilidad por teclado, focusabilidad e ids únicos en listas
dinámicas. Aplica a checkout-modal, inventario, producto, cobro-pendiente-modal,
quantity-input y app-nav.

## Requirements

### Requirement: Labels asociados a controles

Todo `label` DEBE estar asociado a su control mediante `for` + `id` (o anidamiento). En plantillas `@for`, los `id` DEBEN ser únicos por iteración usando `[attr.id]` con el id del item. Los labels display-only (sin control, ej. app-nav) DEBEN evitar asociaciones espurias sin romper layout.

#### Scenario: Label estático asociado

- GIVEN un `<label>` sin `for` (checkout-modal, inventario, producto, app-nav)
- WHEN se agrega `for` + `id` al control correspondiente
- THEN el label queda asociado a su input/select

#### Scenario: Ids únicos en @for

- GIVEN el edit-form de inventario y el form de merma de producto dentro de `@for`
- WHEN se agregan ids dinámicos
- THEN cada iteración tiene un id único basado en el id del item (sin colisiones)

### Requirement: Operabilidad por teclado

Todo elemento interactivo con handler `(click)` DEBE ser focusable (`tabindex`) y operable por teclado (`(keydown)`, típicamente Enter/Escape), replicando el patrón `checkout-modal` (`role="dialog"` + `tabindex` + `(keydown)`). Aplica a quantity-input (backdrop/stopPropagation), inventario (modal producto) y cobro-pendiente (fila clickeable en `@for`).

#### Scenario: Modal operable por teclado

- GIVEN el modal producto de inventario / quantity-input con `(click)` en backdrop
- WHEN se agrega `tabindex` + `(keydown)` (Enter/Escape)
- THEN se puede abrir/cerrar por teclado y el elemento es focusable

#### Scenario: Fila clickeable operable por teclado

- GIVEN una fila de cobro-pendiente con `(click)`
- WHEN se agrega `tabindex` + `(keydown)`
- THEN la fila es focusable y la misma acción se dispara por teclado
