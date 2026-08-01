# Proposal: Reestructurar formulario de arqueo de caja

## Intent

Reemplazar el manejo de inputs de denominaciones con un `signal<Record<number, number>>` por un `FormGroup` real de Angular ReactiveForms. Simplificar la sanitización eliminando `onDenomKeydown` (redundante con el sanitizador en input) y haciendo el estado del formulario más mantenible.

## Scope

### In Scope
- Reemplazar `arqueoForm` signal por `FormGroup` con un `FormControl` por denominación
- Template: cambiar `[value]` + `(keydown)` + `(input)` por `formControlName`
- Eliminar `onDenomKeydown()` (duplicación con el sanitizador en input)
- Unificar sanitización: un único método que limpia no-dígitos desde el FormControl
- Bridge form → signals con `toSignal(form.valueChanges)` para que `arqueoTotal` y `diferencia` sigan siendo reactivos
- Actualizar tests: cambiar `arqueoForm.update()` por manipulación de FormControls

### Out of Scope
- DB (tabla `arqueo_caja` no se toca)
- Modelo `ArqueoCajaEntry`
- Reporte Excel
- Flujo de cierre en `jornada.service.ts`
- Bug de `saldo_real` ignorado (ya documentado)
- Comportamiento visible para el usuario (debe ser idéntico)

## Capabilities

### New Capabilities
None — refactor puramente interno, sin nuevos features.

### Modified Capabilities
None — no hay cambios en requerimientos a nivel spec. El comportamiento observable es el mismo.

## Approach

1. **FormGroup**: Crear `arqueoFormGroup = new FormGroup({ denom_5000: new FormControl(0, { nonNullable: true }), ... })` con las 12 denominaciones. Importar `ReactiveFormsModule` en el componente.
2. **Template**: Cada input usa `[formControlName]="'denom_' + denom"` en lugar de `[value]` + eventos. Un solo `(input)="sanitizarInput($event, 'denom_' + denom)"` que limpia no-dígitos.
3. **Sanitización unificada**: Eliminar `onDenomKeydown()`. `onDenomInput()` se simplifica a `sanitizarInput()` que actualiza el FormControl.
4. **Bridge signals**: `arqueoFormValues = toSignal(this.arqueoFormGroup.valueChanges, { initialValue: ... })`. `arqueoTotal` y `diferencia` se quedan como `computed` que leen de `arqueoFormValues()`.
5. **confirmarCierre**: Lee de `arqueoFormGroup.getRawValue()` en vez de `arqueoForm()`.
6. **Tests**: `component.arqueoForm.update(...)` → `component.arqueoFormGroup.get('denom_5000')?.setValue(2)`. Agregar test de validación del FormControl.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/pages/jornada/jornada.page.ts` | Modified | Reemplazar signal por FormGroup, bridge signals, unificar sanitización |
| `src/app/pages/jornada/jornada.page.html` | Modified | Inputs con `formControlName`, eliminar `(keydown)`, un solo `(input)` |
| `src/app/pages/jornada/jornada.page.spec.ts` | Modified | Tests usan FormControls, agregar test de validación numérica |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `toSignal` no dispare correctamente el computed | Low | Test existente de `arqueoTotal` y `diferencia` validan reactividad |
| Migración de tests se salte algún caso | Low | Todos los tests actuales pasan contra el form. Se agrega test específico de validación |
| Breaking change si otro código lee `arqueoForm` | Low | `arqueoForm` es solo interno del componente. Ningún consumer externo |

## Rollback Plan

1. Revertir `jornada.page.ts` y `jornada.page.html` al estado anterior
2. Revertir tests
3. Solo 3 archivos tocados — rollback trivial con `git checkout`

## Success Criteria

- [ ] Tests existentes pasan sin modificar su lógica de aserción (solo cambia el setup)
- [ ] FormGroup reemplaza completamente al signal para estado del arqueo
- [ ] `onDenomKeydown` eliminado, sanitización unificada en un solo método
- [ ] `arqueoTotal` y `diferencia` son igual de reactivos que antes
- [ ] No hay cambios visibles en el modal — inputs funcionan igual que antes
