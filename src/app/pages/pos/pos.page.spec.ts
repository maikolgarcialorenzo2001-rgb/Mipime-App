import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PosPage } from './pos.page';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import { JornadaService } from '../../services/jornada.service';
import { VentaService } from '../../services/venta.service';
import { CuentaCosasService } from '../../services/cuenta-cosa.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import type { Jornada, Producto } from '../../models';
import type { CheckoutPayload } from '../../components/checkout-modal/checkout-modal.component';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-05',
  hora_apertura: '09:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_gastos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-05T09:00:00Z',
  updated_at: '2026-06-05T09:00:00Z',
};

const producto: Producto = {
  id: 1,
  nombre: 'Test Producto',
  descripcion: null,
  precio_venta: 100,
  precio_costo: null,
  stock_almacen: 100,
  stock_shop: 50,
  created_at: '',
  updated_at: '',
};

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PosPage — toast de éxito', () => {
  let fixture: ComponentFixture<PosPage>;
  let component: PosPage;
  let mockVentaService: { registrar: ReturnType<typeof vi.fn> };
  let mockCuentaCosasService: { registrar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockVentaService = {
      registrar: vi.fn(),
    };
    mockCuentaCosasService = {
      registrar: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [PosPage],
      providers: [
        CartService,
        {
          provide: ProductoService,
          useValue: {
            listar: vi.fn().mockReturnValue(of([])),
            buscar: vi.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: JornadaService,
          useValue: {
            jornadaAbierta: vi.fn().mockReturnValue(mockJornada),
            jornadaCargando: vi.fn().mockReturnValue(false),
            refreshJornadaAbierta: vi.fn(),
          },
        },
        {
          provide: VentaService,
          useValue: mockVentaService,
        },
        {
          provide: CuentaCosasService,
          useValue: mockCuentaCosasService,
        },
        {
          provide: AuthService,
          useValue: {
            usuario: vi.fn().mockReturnValue({ id: 1 }),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería mostrar toast de éxito después de confirmar venta exitosa', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));

    component.confirmarVenta({ formaPago: 'efectivo' });
    fixture.detectChanges();

    const toastEl = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastEl).toBeTruthy();
    expect(toastEl!.textContent).toContain('Venta registrada con éxito');
  });

  it('debería auto-ocultar el toast después de 3 segundos', () => {
    vi.useFakeTimers();
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));

    component.confirmarVenta({ formaPago: 'efectivo' });
    fixture.detectChanges();

    const toastEl = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastEl).toBeTruthy();

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    const toastAfter = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastAfter).toBeFalsy();
    expect(component.successMessage()).toBeNull();

    vi.useRealTimers();
  });

  it('NO debería mostrar toast si la venta falla', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(
      throwError(() => new Error('Error de prueba')),
    );

    component.confirmarVenta({ formaPago: 'efectivo' });
    fixture.detectChanges();

    const toastEl = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastEl).toBeFalsy();
    expect(component.ventaError()).toBe('Error de prueba');
  });

  // ─── 2.11 RED: routing cuenta_cosas a CuentaCosasService ──────────

  it('2.11 RED: debería llamar a VentaService.registrar cuando formaPago=efectivo', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));

    component.confirmarVenta({ formaPago: 'efectivo' });

    expect(mockVentaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ formaPago: 'efectivo' }),
    );
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: debería llamar a VentaService.registrar cuando formaPago=divisas con todos los campos', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 1950 } as never));

    const payload: CheckoutPayload = {
      formaPago: 'divisas',
      divisaTipo: 'USD',
      montoDivisa: 3,
      tasaCambio: 650,
    };

    component.confirmarVenta(payload);

    expect(mockVentaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        formaPago: 'divisas',
        divisaTipo: 'USD',
        montoDivisa: 3,
        tasaCambio: 650,
      }),
    );
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: debería llamar a VentaService.registrar cuando formaPago=pendiente', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));

    const payload: CheckoutPayload = {
      formaPago: 'pendiente',
      compradorNombre: 'Carlos',
      autorizadoPor: 'María',
    };

    component.confirmarVenta(payload);

    expect(mockVentaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        formaPago: 'pendiente',
        compradorNombre: 'Carlos',
        autorizadoPor: 'María',
      }),
    );
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: debería llamar a CuentaCosasService.registrar cuando formaPago=cuenta_cosas', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    const payload: CheckoutPayload = {
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
      descripcion: 'Retiro familiar',
    };

    component.confirmarVenta(payload);

    expect(mockCuentaCosasService.registrar).toHaveBeenCalled();
    expect(mockVentaService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: debería llamar a CuentaCosasService.registrar con jornadaId, productoId y cantidad', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockCuentaCosasService.registrar.mockResolvedValue(undefined);

    const payload: CheckoutPayload = {
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
    };

    component.confirmarVenta(payload);

    expect(mockCuentaCosasService.registrar).toHaveBeenCalledWith(
      1,                       // jornadaId
      1,                       // productoId (first item)
      1,                       // cantidad (total items qty)
      null,                    // descripcion
      'María',                 // autorizadoPor
    );
    expect(mockVentaService.registrar).not.toHaveBeenCalled();
  });

  // ─── Jornada refresh after sale ──────────────────────────────────

  it('debería llamar refreshJornadaAbierta después de una venta exitosa', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));
    const jornadaService = TestBed.inject(JornadaService);

    component.confirmarVenta({ formaPago: 'efectivo' });

    expect(jornadaService.refreshJornadaAbierta).toHaveBeenCalled();
  });

  it('NO debería llamar refreshJornadaAbierta si la venta falla', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(
      throwError(() => new Error('Error de prueba')),
    );
    const jornadaService = TestBed.inject(JornadaService);
    vi.mocked(jornadaService.refreshJornadaAbierta).mockClear();

    component.confirmarVenta({ formaPago: 'efectivo' });

    expect(jornadaService.refreshJornadaAbierta).not.toHaveBeenCalled();
  });
});
