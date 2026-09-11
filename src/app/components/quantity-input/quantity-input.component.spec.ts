import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuantityInputComponent } from './quantity-input.component';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';

function makeProducto(unidad_medida: 'unidad' | 'gramaje'): Producto {
  return {
    id: 1,
    nombre: 'Producto',
    descripcion: null,
    precio_venta: 100,
    precio_costo: 50,
    stock_almacen: 100,
    stock_shop: 50,
    unidad_medida,
    created_at: '',
    updated_at: '',
  };
}

describe('QuantityInputComponent — decimal por unidad de medida', () => {
  let fixture: ComponentFixture<QuantityInputComponent>;
  let component: QuantityInputComponent;

  function create(unidad: 'unidad' | 'gramaje'): void {
    TestBed.configureTestingModule({
      imports: [QuantityInputComponent, PesosPipe],
    });
    fixture = TestBed.createComponent(QuantityInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('producto', makeProducto(unidad));
    fixture.detectChanges();
  }

  it('unidad: inputmode es numeric', () => {
    create('unidad');
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('gramaje: inputmode es decimal', () => {
    create('gramaje');
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('unidad: onInputKeydown filtra el punto decimal (event.preventDefault llamado)', () => {
    create('unidad');
    const event = new KeyboardEvent('keydown', { key: '.', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('gramaje: onInputKeydown permite el punto decimal (sin preventDefault)', () => {
    create('gramaje');
    const event = new KeyboardEvent('keydown', { key: '.', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('unidad: onInputKeydown filtra una letra', () => {
    create('unidad');
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('gramaje: onInputKeydown filtra una letra', () => {
    create('gramaje');
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('gramaje: tercer decimal bloqueado (max 2 lugares) cuando valor actual = 1.25', () => {
    create('gramaje');
    component.cantidad.set(1.25);
    const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('gramaje: segundo decimal permitido cuando valor actual = 1.2', () => {
    create('gramaje');
    component.cantidad.set(1.2);
    const event = new KeyboardEvent('keydown', { key: '3', cancelable: true });
    component.onInputKeydown(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('gramaje: muestra la etiqueta "por lb" en vez de "c/u"', () => {
    create('gramaje');
    expect(fixture.nativeElement.textContent).toContain('por lb');
    expect(fixture.nativeElement.textContent).not.toContain('c/u');
  });

  it('unidad: muestra la etiqueta "c/u"', () => {
    create('unidad');
    expect(fixture.nativeElement.textContent).toContain('c/u');
  });
});

describe('QuantityInputComponent — onInput: parseo con Number.isFinite y buffer rawText', () => {
  let fixture: ComponentFixture<QuantityInputComponent>;
  let component: QuantityInputComponent;

  function create(unidad: 'unidad' | 'gramaje'): void {
    TestBed.configureTestingModule({
      imports: [QuantityInputComponent, PesosPipe],
    });
    fixture = TestBed.createComponent(QuantityInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('producto', makeProducto(unidad));
    fixture.detectChanges();
  }

  it('1. gramaje: onInput("0.6") → cantidad = 0.6', () => {
    create('gramaje');
    component.onInput('0.6');
    expect(component.cantidad()).toBe(0.6);
  });

  it('2. gramaje: onInput("0") → cantidad = 0 (0 no se convierte en 1)', () => {
    create('gramaje');
    component.onInput('0');
    expect(component.cantidad()).toBe(0);
    expect(component.rawText()).toBe('0');
  });

  it('3. gramaje: onInput("05") → rawText crudo "05", cantidad = 5', () => {
    create('gramaje');
    component.onInput('05');
    expect(component.rawText()).toBe('05');
    expect(component.cantidad()).toBe(5);
  });

  it('4. gramaje: onInput("") preserva el último valor válido', () => {
    create('gramaje');
    component.onInput('0.6');
    component.onInput('');
    expect(component.cantidad()).toBe(0.6);
    expect(component.rawText()).toBe('');
  });

  it('4b. gramaje: onInput(".") preserva el último valor válido', () => {
    create('gramaje');
    component.onInput('0.6');
    component.onInput('.');
    expect(component.cantidad()).toBe(0.6);
  });

  it('4c. unidad: onInput("-") preserva el último valor válido', () => {
    create('unidad');
    component.onInput('2');
    component.onInput('-');
    expect(component.cantidad()).toBe(2);
  });

  it('5. gramaje: onInput("2.555") clamp a 2 decimales', () => {
    create('gramaje');
    component.onInput('2.555');
    expect(component.cantidad()).toBe(2.55);
    expect(component.rawText()).toBe('2.55');
  });

  it('6. gramaje: onInput("abc") rechazado, preserva valor y muestra soloNumeros', () => {
    create('gramaje');
    component.onInput('0.6');
    component.onInput('abc');
    expect(component.cantidad()).toBe(0.6);
    expect(component.soloNumeros()).toBe(true);
  });
});
