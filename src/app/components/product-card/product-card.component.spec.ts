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
