# Tasks: Reestructurar formulario de arqueo de caja

## Review Workload Forecast

- **Estimated changed lines**: ~120-160 (TS: 50, HTML: 30, Tests: 60)
- **Chained PRs recommended**: No
- **400-line budget risk**: Low
- **Decision needed before apply**: No — cabe en un solo commit

## Task List

### Task 1: Migrar arqueoForm a FormGroup en el componente

**Archivos**: `src/app/pages/jornada/jornada.page.ts`
**Dependencias**: ninguna
**Esfuerzo**: medio
**Verificación**: `ng test --include=jornada.page.spec.ts` pasa

#### Pasos
1. Importar `FormGroup`, `FormControl`, `toSignal` desde Angular forms/rxjs-interop
2. Declarar `arqueoFormGroup` como `FormGroup` con 12 FormControls (`denom_5000`...`denom_1`)
3. Crear `_arqueoFormValues` como `toSignal(valueChanges)` con `initialValue`
4. Reemplazar `arqueoForm` signal por `computed(() => this._arqueoFormValues())`
5. Actualizar `abrirModalCierre()`: usar `arqueoFormGroup.reset()` en vez de asignar nuevo objeto
6. Actualizar `confirmarCierre()`: leer con `getRawValue()` en vez de `arqueoForm()`
7. Eliminar `actualizarCantidad()`, `onDenomKeydown()`, `onDenomInput()`
8. Agregar `sanitizarInput(event: Event)` que reemplaza `onDenomInput`
9. Mantener `denominacionesVisibles`, `arqueoTotal`, `diferencia`, `totalEnCaja` sin cambios

### Task 2: Actualizar template a formControlName

**Archivos**: `src/app/pages/jornada/jornada.page.html`
**Dependencias**: Task 1
**Esfuerzo**: bajo
**Verificación**: el modal renderiza correctamente y los inputs funcionan

#### Pasos
1. Reemplazar `[value]="arqueoForm()[denom] || ''"` por `[formControlName]="'denom_' + denom"`
2. Reemplazar `(keydown)="onDenomKeydown($event)" (input)="onDenomInput(denom, $event)"` por `(input)="sanitizarInput($event)"`

### Task 3: Actualizar tests

**Archivos**: `src/app/pages/jornada/jornada.page.spec.ts`
**Dependencias**: Task 1
**Esfuerzo**: medio
**Verificación**: todos los tests pasan

#### Pasos
1. Cambiar setup de valores del arqueo: `arqueoForm().update(...)` → `arqueoFormGroup.get('denom_X')?.setValue(N)`
2. Disparar `detectChanges()` + `valueChanges` donde sea necesario
3. Eliminar referencias a `onDenomKeydown`/`onDenomInput` si existen
4. Agregar test para `sanitizarInput()`: verificar que filtra letras y mantiene dígitos
5. Ejecutar suite completa y verificar 0 fallos
