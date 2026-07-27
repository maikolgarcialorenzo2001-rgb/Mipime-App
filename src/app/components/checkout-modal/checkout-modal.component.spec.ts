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
  stock_almacen: 50,
  stock_shop: 0,
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

  // ─── 2.1 RED: 5 botones + sub-formularios condicionales ─────────────

  it('2.1 RED: debería renderizar 5 botones de forma de pago', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    const textos = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');

    expect(textos.find((t) => t.includes('Efectivo'))).toBeTruthy();
    expect(textos.find((t) => t.includes('Transferencia'))).toBeTruthy();
    expect(textos.find((t) => t.includes('Divisas'))).toBeTruthy();
    expect(textos.find((t) => t.includes('Pendiente'))).toBeTruthy();
    expect(textos.find((t) => t.includes('Cuenta Casas'))).toBeTruthy();
  });

  it('2.1 RED: debería mostrar sub-formulario de divisas al seleccionar Divisas', () => {
    component.seleccionarFormaPago('divisas');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Divisas sub-form: select para tipo, inputs numéricos para tasa y billete
    const selects = el.querySelectorAll('select');
    const numberInputs = el.querySelectorAll('input[type="number"]');

    expect(selects.length).toBeGreaterThanOrEqual(1);
    expect(numberInputs.length).toBeGreaterThanOrEqual(2);
    // divisa_tipo (select) + tasaCambio (number) + billeteRecibido (number)
    expect(selects.length + numberInputs.length).toBeGreaterThanOrEqual(3);
  });

  it('2.1 RED: debería mostrar sub-formulario de pendiente al seleccionar Pendiente', () => {
    component.seleccionarFormaPago('pendiente');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll('input');
    const textareas = el.querySelectorAll('textarea');

    // compradorNombre + autorizadoPor (inputs) + descripcion (textarea opcional)
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(textareas.length).toBeGreaterThanOrEqual(1);
  });

  it('2.1 RED: debería mostrar sub-formulario de cuenta_cosas al seleccionar Cuenta Casas', () => {
    component.seleccionarFormaPago('cuenta_cosas');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll('input');
    const textareas = el.querySelectorAll('textarea');

    // autorizadoPor (input) + descripcion (textarea opcional)
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(textareas.length).toBeGreaterThanOrEqual(1);
  });

  it('2.1 RED: NO debería mostrar sub-formulario para efectivo o transferencia', () => {
    // Default is efectivo
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll('input');
    const textareas = el.querySelectorAll('textarea');
    expect(inputs.length).toBe(0);
    expect(textareas.length).toBe(0);
  });

  // ─── 2.4 RED: CheckoutPayload emitido con campos correctos ─────────

  it('2.4 RED: debería emitir payload con divisaTipo, billeteRecibido y tasaCambio cuando formaPago=divisas', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.seleccionarFormaPago('divisas');
    component.divisaTipo.set('USD');
    component.tasaCambio.set(700);
    component.billeteRecibido.set(5);
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({
      formaPago: 'divisas',
      divisaTipo: 'USD',
      billeteRecibido: 5,
      tasaCambio: 700,
    });
  });

  it('2.4 RED: debería emitir payload con compradorNombre, autorizadoPor y descripcion cuando formaPago=pendiente', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.seleccionarFormaPago('pendiente');
    component.compradorNombre.set('Carlos');
    component.autorizadoPor.set('María');
    component.descripcion.set('Pago quincenal');
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({
      formaPago: 'pendiente',
      compradorNombre: 'Carlos',
      autorizadoPor: 'María',
      descripcion: 'Pago quincenal',
    });
  });

  it('2.4 RED: debería emitir payload con autorizadoPor y descripcion cuando formaPago=cuenta_cosas', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.seleccionarFormaPago('cuenta_cosas');
    component.autorizadoPor.set('María');
    component.descripcion.set('Retiro familiar');
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
      descripcion: 'Retiro familiar',
    });
  });

  it('2.4 RED: debería emitir payload sin campos extra cuando formaPago=efectivo', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.seleccionarFormaPago('efectivo');
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({ formaPago: 'efectivo' });
  });

  it('2.4 RED: debería emitir payload sin campos extra cuando formaPago=transferencia', () => {
    const spy = vi.fn();
    component.confirmar.subscribe(spy);

    component.seleccionarFormaPago('transferencia');
    component['onConfirmar']();

    expect(spy).toHaveBeenCalledWith({ formaPago: 'transferencia' });
  });

  // ─── Divisas — billeteRecibido y vuelto ──────────────────────────

  it('5.4 RED: vuelto debe ser computed como billete * tasa - total', () => {
    component.tasaCambio.set(700);
    component.billeteRecibido.set(5);
    // total is 1700 (set in beforeEach)
    // vuelto = 5 * 700 - 1700 = 1800
    expect(component.vuelto()).toBe(1800);
  });

  it('5.4 RED: vuelto debe ser negativo cuando el billete no alcanza', () => {
    component.tasaCambio.set(700);
    component.billeteRecibido.set(2);
    // vuelto = 2 * 700 - 1700 = -300
    expect(component.vuelto()).toBe(-300);
  });

  it('5.4 RED: vuelto debe ser null cuando billeteRecibido es null', () => {
    component.tasaCambio.set(700);
    expect(component.vuelto()).toBeNull();
  });

  it('5.4 RED: vuelto debe ser null cuando tasaCambio es null o <= 0', () => {
    component.billeteRecibido.set(5);
    expect(component.vuelto()).toBeNull();
    component.tasaCambio.set(0);
    expect(component.vuelto()).toBeNull();
  });

  it('5.4 RED: vuelto debe ser null cuando billeteRecibido <= 0', () => {
    component.tasaCambio.set(700);
    component.billeteRecibido.set(0);
    expect(component.vuelto()).toBeNull();
  });
});
