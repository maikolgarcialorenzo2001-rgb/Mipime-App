import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import type { Producto } from '../../models';

const baseProducto: Producto = {
  id: 1,
  nombre: 'Test Producto',
  descripcion: null,
  precio_venta: 100,
  precio_costo: null,
  stock_actual: 50,
  created_at: '',
  updated_at: '',
};

describe('ProductCardComponent — getStockColor', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let component: ProductCardComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductCardComponent],
    });

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
  });

  it('devuelve text-green-400 para stock > 10', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 25 });
    expect(component.getStockColor()).toBe('text-green-400');
  });

  it('devuelve text-orange-400 para stock entre 1 y 10', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 5 });
    expect(component.getStockColor()).toBe('text-orange-400');
  });

  it('devuelve text-orange-400 para stock = 1', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 1 });
    expect(component.getStockColor()).toBe('text-orange-400');
  });

  it('devuelve text-red-500 para stock = 0', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 0 });
    expect(component.getStockColor()).toBe('text-red-500');
  });
});

describe('ProductCardComponent — stock always visible', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductCardComponent],
    });

    fixture = TestBed.createComponent(ProductCardComponent);
  });

  it('muestra "Stock:" en el DOM para stock alto (>10)', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 25 });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('25');
  });

  it('muestra "Stock:" en el DOM para stock bajo (1-10)', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 5 });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('5');
  });

  it('muestra "Stock:" en el DOM para stock = 0', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_actual: 0 });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('0');
  });
});
