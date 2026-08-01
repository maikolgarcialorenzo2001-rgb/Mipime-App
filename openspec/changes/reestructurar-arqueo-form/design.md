# Design: Reestructurar formulario de arqueo de caja

## Resumen Técnico

Reemplazar el estado del formulario de arqueo — actualmente un `signal<Record<number, number>>` manejado con eventos manuales (`(keydown)`, `(input)`, sanitización inline) — por un `FormGroup` de Angular ReactiveForms con un `FormControl` por denominación. Cada input se vincula vía `formControlName`, la sanitización se unifica en un solo método que limpia no-dígitos desde un `(input)` compartido, y se elimina `onDenomKeydown` por completo (redundante con la sanitización en input).

Se usa `toSignal(form.valueChanges)` como bridge para que los `computed` existentes (`arqueoTotal`, `diferencia`) sigan siendo reactivos sin cambiar la firma pública del componente. El comportamiento visible para el usuario no cambia.

## Arquitectura

### Estado Actual

```
signal<Record<number, number>>  ──►  arqueoTotal (computed)
         │                              diferencia (computed)
         │
         ├── Template: [value] + (keydown) + (input) por input
         │   ├── onDenomKeydown() — filtra teclas no-dígito (keydown)
         │   └── onDenomInput() — sanitiza y actualiza (input)
         │
         ├── abrirModalCierre(): arqueoForm.set({...}) — resetea todo
         └── confirmarCierre(): arqueoForm()[d] ?? 0 — lee señal
```

Problemas:
- **Dos puntos de sanitización**: `onDenomKeydown` bloquea teclas en keydown, `onDenomInput` vuelve a limpiar en input. El keydown no cubre paste con mouse.
- **Estado no tipado**: `Record<number, number>` permite cualquier key, no hay validación de controles individuales.
- **Muta el DOM directo**: `input.value = limpio` en el handler (anti-patrón Angular).

### Estado Propuesto

```
FormGroup ──► valueChanges ──► toSignal() ──► arqueoFormValues (signal)
  │                                              │
  │                    arqueoTotal (computed) ◄──┘
  │                    diferencia (computed) ◄──┘
  │
  ├── Template: [formControlName] + (input) unificado
  │   └── sanitizarInput() — único punto de sanitización
  │
  ├── abrirModalCierre(): arqueoFormGroup.reset({...})
  └── confirmarCierre(): arqueoFormGroup.getRawValue()
```

Beneficios:
- **Sanitización unificada**: un solo método `sanitizarInput()` que se dispara en `(input)`. Se elimina `onDenomKeydown`.
- **Estado tipado por control**: `FormControl<number>` con `nonNullable: true`.
- **Sin mutación directa del DOM**: Angular maneja el value del input vía `formControlName`.
- **Reset declarativo**: `formGroup.reset()` en vez de re-crear el objeto.

## Componentes

### Template (`jornada.page.html`)

Cambios localizados al bloque del `@for` de denominaciones (líneas 248-258 actuales):

```html
<!-- ANTES -->
<input
  type="text"
  inputmode="numeric"
  [value]="arqueoForm()[denom] || ''"
  (keydown)="onDenomKeydown($event)"
  (input)="onDenomInput(denom, $event)"
  class="flex-1 rounded-lg border ..."
/>

<!-- DESPUÉS -->
<input
  type="text"
  inputmode="numeric"
  [formControlName]="'denom_' + denom"
  (input)="sanitizarInput($event)"
  class="flex-1 rounded-lg border ..."
/>
```

Se elimina:
- `[value]="arqueoForm()[denom] || ''"` → Angular sincroniza desde el FormControl
- `(keydown)="onDenomKeydown($event)"` → se borra el método entero
- `(input)="onDenomInput(denom, $event)"` → reemplazado por `sanitizarInput($event)`

El subtotal calculado (`${{ denom * arqueoForm()[denom] }}`) cambia a leer del bridge:

```html
${{ ((denom * arqueoFormValues()[denom]).toLocaleString()) }}
```

**Import**: Se agrega `ReactiveFormsModule` al array de `imports` del decorador `@Component`:

```typescript
imports: [ErrorAlertComponent, EmptyStateComponent, JornadaSummaryCardComponent, DatePipe, ReactiveFormsModule],
```

### Componente (`jornada.page.ts`)

#### 1. Nuevos imports

```typescript
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
```

#### 2. Declaración del FormGroup

Reemplaza `signal<Record<number, number>>` (líneas 53-55):

```typescript
readonly arqueoFormGroup = new FormGroup({
  denom_5000: new FormControl(0, { nonNullable: true }),
  denom_2000: new FormControl(0, { nonNullable: true }),
  denom_1000: new FormControl(0, { nonNullable: true }),
  denom_500: new FormControl(0, { nonNullable: true }),
  denom_200: new FormControl(0, { nonNullable: true }),
  denom_100: new FormControl(0, { nonNullable: true }),
  denom_50: new FormControl(0, { nonNullable: true }),
  denom_20: new FormControl(0, { nonNullable: true }),
  denom_10: new FormControl(0, { nonNullable: true }),
  denom_5: new FormControl(0, { nonNullable: true }),
  denom_3: new FormControl(0, { nonNullable: true }),
  denom_1: new FormControl(0, { nonNullable: true }),
});
```

Se elimina la línea `readonly arqueoForm = signal<Record<number, number>>({...})`.

#### 3. Bridge signal para computed existentes

```typescript
private readonly _arqueoFormValues = toSignal(this.arqueoFormGroup.valueChanges, {
  initialValue: {
    denom_5000: 0, denom_2000: 0, denom_1000: 0,
    denom_500: 0, denom_200: 0, denom_100: 0,
    denom_50: 0, denom_20: 0, denom_10: 0,
    denom_5: 0, denom_3: 0, denom_1: 0,
  } satisfies Record<string, number>,
});
```

**Nota**: `valueChanges` emite `Partial<{...}>` — pero con `nonNullable: true` en cada FormControl, nunca emite `undefined`. Sin embargo, TypeScript no sabe eso. Usamos `satisfies` o un casteo para que los computeds downstream tengan types limpios.

#### 4. Computed puente para lectura en template

Para que el template pueda leer valores por denominación sin depender del `getRawValue()` o del nombre de control, se agrega un computed que transforma las keys del form al mismo formato de `Record<number, number>` que usaban los templates existentes:

```typescript
readonly arqueoFormValues = computed<Record<number, number>>(() => {
  const v = this._arqueoFormValues();
  return {
    5000: v.denom_5000 ?? 0,
    2000: v.denom_2000 ?? 0,
    1000: v.denom_1000 ?? 0,
    500: v.denom_500 ?? 0,
    200: v.denom_200 ?? 0,
    100: v.denom_100 ?? 0,
    50: v.denom_50 ?? 0,
    20: v.denom_20 ?? 0,
    10: v.denom_10 ?? 0,
    5: v.denom_5 ?? 0,
    3: v.denom_3 ?? 0,
    1: v.denom_1 ?? 0,
  };
});
```

#### 5. Computeds existentes (se actualizan para leer del bridge)

```typescript
readonly arqueoTotal = computed(() => {
  const f = this.arqueoFormValues();
  return this.denominacionesVisibles().reduce((sum, d) => sum + d * f[d], 0);
});

readonly diferencia = computed(() => {
  return this.totalEnCaja() - this.arqueoTotal();
});
```

`totalEnCaja` no cambia — no depende del form.

#### 6. Sanitización unificada (reemplaza `onDenomInput` y elimina `onDenomKeydown`)

```typescript
/** Unifica sanitización: filtra no-dígitos en el input y actualiza el FormControl */
sanitizarInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const limpio = input.value.replace(/[^0-9]/g, '');
  if (limpio !== input.value) {
    input.value = limpio;
  }
}
```

Esto funciona porque Angular sincroniza el value del input con el FormControl **después** del evento `(input)`. Al modificar `input.value` sincrónicamente, el FormControl recibe el valor limpio.

`onDenomKeydown` se elimina completamente. La sanitización en `(input)` cubre: tecleo, paste, drag&drop, autofill, etc.

`actualizarCantidad()` también se elimina — los FormControls se actualizan solos vía `formControlName`.

#### 7. `abrirModalCierre()` — reset con FormGroup

```typescript
abrirModalCierre(): void {
  this.cerrarError.set(null);
  this.arqueoFormGroup.reset({
    denom_5000: 0, denom_2000: 0, denom_1000: 0,
    denom_500: 0, denom_200: 0, denom_100: 0,
    denom_50: 0, denom_20: 0, denom_10: 0,
    denom_5: 0, denom_3: 0, denom_1: 0,
  });
  this.showOptionalDenoms.set(false);
  this.showCloseModal.set(true);
}
```

`reset()` pone cada FormControl a su valor, emite `valueChanges`, y el bridge propaga a los computeds.

#### 8. `confirmarCierre()` — leer del FormGroup

```typescript
confirmarCierre(): void {
  const j = this.jornadaService.jornadaAbierta();
  const uid = this.usuario()?.id;
  if (!j || uid === undefined) return;

  const raw = this.arqueoFormGroup.getRawValue();
  const denomMap: Record<number, string> = {
    5000: 'denom_5000', 2000: 'denom_2000', 1000: 'denom_1000',
    500: 'denom_500', 200: 'denom_200', 100: 'denom_100',
    50: 'denom_50', 20: 'denom_20', 10: 'denom_10',
    5: 'denom_5', 3: 'denom_3', 1: 'denom_1',
  };

  const entries: ArqueoCajaEntry[] = [];
  for (const d of this.denominacionesVisibles()) {
    const cantidad = raw[denomMap[d]] ?? 0;
    if (cantidad > 0) {
      entries.push({ denominacion: d, cantidad, subtotal: d * cantidad });
    }
  }

  if (entries.length === 0) {
    this.cerrarError.set('Ingresa la cantidad de al menos una denominación');
    return;
  }

  const saldoReal = this.arqueoTotal();
  this.cerrando.set(true);
  this.cerrarError.set(null);

  this.jornadaService.cerrar(j.id, saldoReal, uid, entries).subscribe({
    next: () => {
      this.showCloseModal.set(false);
      this.cerrando.set(false);
      this._descargarExcel(j.id);
    },
    error: (err: unknown) => {
      this.cerrarError.set(
        err instanceof Error ? err.message : 'Error al cerrar la jornada',
      );
      this.cerrando.set(false);
    },
  });
}
```

`getRawValue()` retorna los valores con nonNullable (nunca `null` ni `undefined`), lo que simplifica el mapeo.

### Tests (`jornada.page.spec.ts`)

Los tests de arqueo cambian en el **setup** (cómo se setean las cantidades) pero **no** en las aserciones de salida (valores de `arqueoTotal`, `diferencia`, llamados a `cerrar`, labels en DOM).

#### Patrón de reemplazo

```typescript
// ANTES
component.arqueoForm.update(f => ({ ...f, 5000: 2, 1000: 5 }));

// DESPUÉS
component.arqueoFormGroup.get('denom_5000')?.setValue(2);
component.arqueoFormGroup.get('denom_1000')?.setValue(5);
```

#### Mapa de tests a modificar

| Test actual | Ubicación (línea) | Cambio |
|---|---|---|
| `should compute saldoReal from arqueo form` | 551 | `arqueoForm.update` → `arqueoFormGroup.get(...).setValue(...)` |
| `arqueo: total is computed correctly` | 666 | idem |
| `arqueo: shows faltante label` | 686 | idem |
| `arqueo: shows sobrante label` | 698 | idem |
| `arqueo: shows cuadrado` | 710 | idem |
| `1.1 RED: totalEnCaja = monto_inicial...` | 825 | idem (setup con arqueoForm.update) |
| `1.2 RED: diferencia = totalEnCaja - arqueoTotal` (4 tests) | 848-906 | idem |

Se agrega test de sanitización:

```typescript
it('arqueo: sanitiza no-dígitos en input', () => {
  component.abrirModalCierre();
  const input = fixture.nativeElement.querySelector('[formcontrolname="denom_5000"]') as HTMLInputElement;
  input.value = '12abc34';
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  expect(component.arqueoFormGroup.get('denom_5000')?.value).toBe(1234);
});
```

#### Import a agregar

```typescript
import { ReactiveFormsModule } from '@angular/forms';
```

Y en la configuración de TestBed:

```typescript
// El componente importa ReactiveFormsModule, TestBed lo carga automáticamente
// al compilar JornadaPage con sus imports. No requiere providers extra.
```

## Flujo de Datos

```
Usuario escribe en input
       │
       ▼
  (input) event ──► sanitizarInput($event)
       │               └── limpia no-dígitos de input.value
       ▼
  Angular detecta change en input.value
       │
       ▼
  FormControl.setValue(limpio)  ← sincrónico, vía formControlName
       │
       ▼
  FormGroup.valueChanges emite nuevo Partial<{...}>
       │
       ▼
  toSignal() actualiza _arqueoFormValues (signal)
       │
       ▼
  arqueoFormValues (computed) ──► Record<number, number>
       │
       ├── arqueoTotal (computed) ──► reduce
       │                              │
       │                              ▼
       │                         totalEnCaja() - arqueoTotal()
       │                              │
       │                              ▼
       │                         diferencia (computed)
       │
       └── Template: subtotales por denominación
                       diferencia labels
```

## Migración

### Paso 1: Agregar imports y declarar FormGroup

En `jornada.page.ts`:
- Importar `FormGroup`, `FormControl`, `ReactiveFormsModule`
- Importar `toSignal` desde `@angular/core/rxjs-interop`
- Agregar `ReactiveFormsModule` al array `imports` del decorador
- Reemplazar `signal<Record<number, number>>` por `FormGroup` con 12 FormControls

### Paso 2: Bridge signal

Agregar `_arqueoFormValues = toSignal(...)` privado y `arqueoFormValues = computed(...)` público.

### Paso 3: Computeds

Actualizar `arqueoTotal` para que lea de `arqueoFormValues()` en vez de `arqueoForm()`.

### Paso 4: Template

En `jornada.page.html`:
- Reemplazar `[value]` + `(keydown)` + `(input)` con `[formControlName]="'denom_' + denom"` + `(input)="sanitizarInput($event)"`
- Actualizar referencias a `arqueoForm()` por `arqueoFormValues()`

### Paso 5: Métodos del componente

- Eliminar `actualizarCantidad()`
- Eliminar `onDenomKeydown()`
- Reemplazar `onDenomInput()` por `sanitizarInput()`
- Actualizar `abrirModalCierre()` para usar `arqueoFormGroup.reset()`
- Actualizar `confirmarCierre()` para usar `arqueoFormGroup.getRawValue()`

### Paso 6: Tests

- Reemplazar todos los `arqueoForm.update(...)` por `arqueoFormGroup.get('denom_X')?.setValue(N)`
- Agregar test de sanitización
- Verificar que ningún test rompa

### Paso 7: Smoke test

Compilar, abrir modal, verificar:
- Inputs renderizan valores correctos
- Escribir letras no persiste
- Totales se actualizan al escribir
- Confirmar cierre envía entries correctos

## Prerrequisitos

Nada. Todo el cambio es interno al componente `JornadaPage`. No requiere migración de DB, cambios en servicios, modelos, ni configuración. `toSignal` viene incluido en Angular 21.2 (proyecto usa `^21.2.0`).
