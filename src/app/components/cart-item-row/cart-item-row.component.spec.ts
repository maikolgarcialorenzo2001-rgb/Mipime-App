import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CartItemRowComponent } from './cart-item-row.component';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { CartItem } from '../../services/cart.service';

describe('CartItemRowComponent', () => {
  let fixture: ComponentFixture<CartItemRowComponent>;

  const mockItem: CartItem = {
    producto: {
      id: 1,
      nombre: 'Café',
      precio_venta: 500,
      precio_costo: 300,
      stock_almacen: 10,
      stock_shop: 0,
      descripcion: null,
      created_at: '',
      updated_at: '',
    },
    cantidad: 3,
    subtotal: 1500,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CartItemRowComponent, PesosPipe],
    });
    fixture = TestBed.createComponent(CartItemRowComponent);
    fixture.componentRef.setInput('item', mockItem);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza el nombre del producto', () => {
    expect(fixture.nativeElement.textContent).toContain('Café');
  });

  it('renderiza el precio unitario', () => {
    expect(fixture.nativeElement.textContent).toContain('500');
  });

  it('renderiza la cantidad', () => {
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('renderiza el subtotal formateado como moneda', () => {
    expect(fixture.nativeElement.textContent).toContain('1,500');
  });

  it('emite cantidadReducir al hacer clic en el botón menos', () => {
    const spy = vi.fn();
    fixture.componentInstance.cantidadReducir.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('[aria-label="Reducir cantidad"]');
    btn.click();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('emite cantidadAumentar al hacer clic en el botón más', () => {
    const spy = vi.fn();
    fixture.componentInstance.cantidadAumentar.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('[aria-label="Aumentar cantidad"]');
    btn.click();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('emite quitar al hacer clic en el botón de cerrar', () => {
    const spy = vi.fn();
    fixture.componentInstance.quitar.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('[aria-label="Quitar del carrito"]');
    btn.click();

    expect(spy).toHaveBeenCalledOnce();
  });
});
