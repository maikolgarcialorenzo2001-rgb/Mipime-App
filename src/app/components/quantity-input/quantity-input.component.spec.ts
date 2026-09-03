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
