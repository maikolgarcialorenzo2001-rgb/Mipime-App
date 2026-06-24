import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckoutModalComponent } from './checkout-modal.component';
import type { CartItem } from '../../services/cart.service';
import type { Producto } from '../../models';

const mockProducto: Producto = {
  id: 1,
  nombre: 'Test',
  descripcion: null,
  precio_venta: 850,
  precio_costo: null,
  stock_actual: 50,
  created_at: '',
  updated_at: '',
};

const mockItems: CartItem[] = [
  { producto: mockProducto, cantidad: 2, subtotal: 1700 },
];

describe('CheckoutModalComponent', () => {
  let fixture: ComponentFixture<CheckoutModalComponent>;
  let component: CheckoutModalComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CheckoutModalComponent],
    });

    fixture = TestBed.createComponent(CheckoutModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', mockItems);
    fixture.componentRef.setInput('total', 1700);
    fixture.detectChanges();
  });

  it('3.1 RED: debería tener formaPago con default efectivo', () => {
    expect(component.formaPago()).toBe('efectivo');
  });

  it('3.1 RED: debería renderizar botones de efectivo y transferencia', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    const textos = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');

    const efectivoBtn = textos.find((t) => t.includes('Efectivo'));
    const transferenciaBtn = textos.find((t) => t.includes('Transferencia'));

    expect(efectivoBtn).toBeTruthy();
    expect(transferenciaBtn).toBeTruthy();
  });

  it('3.1 RED: debería tener efectivo como seleccionado por defecto', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    const efectivoBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim().includes('Efectivo'),
    );
    expect(efectivoBtn).toBeTruthy();
    // El botón efectivo debería tener clase activa/selected (con dark: companion)
    expect(efectivoBtn!.className).toContain('bg-blue');
    expect(efectivoBtn!.className).toContain('dark:bg-blue');
  });

  it('3.1 RED: debería emitir formaPago al confirmar', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.formaPago.set('transferencia');
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({ formaPago: 'transferencia' });
  });
});
