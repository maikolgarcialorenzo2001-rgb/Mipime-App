import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { StockBadgeComponent } from '../stock-badge/stock-badge.component';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';

const baseProducto: Producto = {
  id: 1,
  nombre: 'Test Producto',
  descripcion: null,
  precio_venta: 100,
  precio_costo: null,
  stock_almacen: 100,
  stock_shop: 50,
  unidad_medida: 'unidad',
  created_at: '',
  updated_at: '',
};

describe('ProductCardComponent — stock siempre visible con StockBadge', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductCardComponent, StockBadgeComponent, PesosPipe],
    });

    fixture = TestBed.createComponent(ProductCardComponent);
  });

  it('muestra <app-stock-badge> y "Stock:" en el DOM para stock alto (>10)', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_shop: 25 });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('app-stock-badge');
    expect(badge).toBeTruthy();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('25');
  });

  it('muestra <app-stock-badge> y "Stock:" en el DOM para stock bajo (1-10)', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_shop: 5 });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('app-stock-badge');
    expect(badge).toBeTruthy();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('5');
  });

  it('muestra <app-stock-badge> y "Stock:" en el DOM para stock = 0', () => {
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_shop: 0 });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('app-stock-badge');
    expect(badge).toBeTruthy();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Stock:');
    expect(texto).toContain('0');
  });
});

describe('ProductCardComponent — 1.1 RED: hover dark perceptible (regresión)', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductCardComponent, StockBadgeComponent, PesosPipe],
    });

    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('producto', { ...baseProducto, stock_shop: 25 });
    fixture.detectChanges();
  });

  it('el host declara sombra dark:hover gray-800/60 y borde dark:hover:border-gray-500', () => {
    const host = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(host).toBeTruthy();

    // La sombra base dark:hover:shadow-gray-900/50 es imperceptible sobre dark:bg-gray-900
    // (mismo color de fondo); se exige un tono perceptible: gray-800/60.
    expect(host?.classList.contains('dark:hover:shadow-gray-800/60')).toBe(true);
    // Borde de hover más claro que el base dark:border-gray-700, feedback visual claro.
    expect(host?.classList.contains('dark:hover:border-gray-500')).toBe(true);
  });
});
