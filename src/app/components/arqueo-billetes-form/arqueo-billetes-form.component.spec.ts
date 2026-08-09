import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArqueoBilletesFormComponent } from './arqueo-billetes-form.component';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';

describe('ArqueoBilletesFormComponent', () => {
  let fixture: ComponentFixture<ArqueoBilletesFormComponent>;
  let component: ArqueoBilletesFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ArqueoBilletesFormComponent] });
    fixture = TestBed.createComponent(ArqueoBilletesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('1.3 RED: checkbox toggle muestra/oculta las filas de $1 y $3', () => {
    const root = fixture.nativeElement as HTMLElement;

    // Por defecto, $1 y $3 NO son visibles
    expect(component.denominacionesVisibles()).not.toContain(1);
    expect(component.denominacionesVisibles()).not.toContain(3);
    expect(component.denominacionesVisibles().length).toBe(10);

    // Click en el checkbox para mostrar denominaciones opcionales
    const checkbox = root.querySelector('#show-optional-denoms') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.click();
    fixture.detectChanges();

    // Tras el click, $1 y $3 son visibles
    expect(component.denominacionesVisibles()).toContain(1);
    expect(component.denominacionesVisibles()).toContain(3);
    expect(component.denominacionesVisibles().length).toBe(12);

    // El DOM muestra las filas de $1 y $3
    expect(root.textContent).toContain('$1');
    expect(root.textContent).toContain('$3');
  });

  it('1.3 TRIANGULATE: desmarcar oculta $1 y $3 nuevamente', () => {
    component.showOptionalDenoms.set(true);
    fixture.detectChanges();

    expect(component.denominacionesVisibles().length).toBe(12);

    const checkbox = fixture.nativeElement.querySelector('#show-optional-denoms') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.click(); // desmarca
    fixture.detectChanges();

    expect(component.denominacionesVisibles()).not.toContain(1);
    expect(component.denominacionesVisibles()).not.toContain(3);
    expect(component.denominacionesVisibles().length).toBe(10);
  });

  it('debería calcular arqueoTotal como Σ denominación × cantidad', () => {
    component.actualizarCantidad(5000, 2);
    component.actualizarCantidad(1000, 3);
    expect(component.arqueoTotal()).toBe(13000);
  });

  it('TRIANGULATE: arqueoTotal con otras denominaciones (500×1 + 100×4)', () => {
    component.actualizarCantidad(500, 1);
    component.actualizarCantidad(100, 4);
    expect(component.arqueoTotal()).toBe(900);
  });

  it('debería emitir en arqueoChange solo entries con cantidad > 0', () => {
    const emitted: ArqueoCajaEntry[][] = [];
    component.arqueoChange.subscribe((entries) => emitted.push(entries));

    component.actualizarCantidad(5000, 1);
    component.actualizarCantidad(1000, 0); // cantidad 0 → excluida
    component.actualizarCantidad(100, 3);

    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[emitted.length - 1]).toEqual([
      { denominacion: 5000, cantidad: 1, subtotal: 5000 },
      { denominacion: 100, cantidad: 3, subtotal: 300 },
    ]);
  });

  it('TRIANGULATE: arqueoChange emite [] al poner todo en cero', () => {
    const emitted: ArqueoCajaEntry[][] = [];
    component.arqueoChange.subscribe((entries) => emitted.push(entries));

    component.actualizarCantidad(5000, 1);
    component.actualizarCantidad(5000, 0);

    expect(emitted[emitted.length - 1]).toEqual([]);
  });

  it('filtrarTecla bloquea teclas no numéricas y muestra el aviso', () => {
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(true);
    expect(component.soloNumeros()).toBe(true);
  });

  it('filtrarTecla permite teclas numéricas', () => {
    const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('filtrarTecla permite teclas de navegación', () => {
    const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
