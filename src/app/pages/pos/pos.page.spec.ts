import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, of, throwError } from 'rxjs';
import { PosPage } from './pos.page';
import { PesosPipe } from '../../pipes/pesos.pipe';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import { JornadaService } from '../../services/jornada.service';
import { VentaService } from '../../services/venta.service';
import { ToastService } from '../../services/toast.service';
import { CuentaCosasService } from '../../services/cuenta-cosa.service';
import { AuthService } from '../../services/auth.service';
import { CobroPendienteService, type PendienteItem } from '../../services/cobro-pendiente.service';
import { CobroPendienteModalComponent } from '../../components/cobro-pendiente-modal/cobro-pendiente-modal.component';
import type { Jornada, Producto } from '../../models';
import type { CheckoutPayload } from '../../components/checkout-modal/checkout-modal.component';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-05',
  hora_apertura: '09:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_movimientos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_apertura_id: null,
  total_merma: 0,
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

const productoB: Producto = {
  id: 2,
  nombre: 'Test Producto B',
  descripcion: null,
  precio_venta: 200,
  precio_costo: null,
  stock_almacen: 100,
  stock_shop: 50,
  created_at: '',
  updated_at: '',
};

describe('PosPage — toast de éxito', () => {
  let fixture: ComponentFixture<PosPage>;
  let component: PosPage;
  let mockVentaService: { registrar: ReturnType<typeof vi.fn> };
  let mockCuentaCosasService: {
    registrar: ReturnType<typeof vi.fn>;
    registrarLote: ReturnType<typeof vi.fn>;
  };
  let mockCobroService: { listarPendientes: ReturnType<typeof vi.fn>; registrarCobroPendiente: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockVentaService = {
      registrar: vi.fn(),
    };
    mockCuentaCosasService = {
      registrar: vi.fn().mockResolvedValue(undefined),
      registrarLote: vi.fn().mockResolvedValue(undefined),
    };
    mockCobroService = {
      listarPendientes: vi.fn().mockResolvedValue([]),
      registrarCobroPendiente: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [PosPage, PesosPipe],
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
            totalEnCaja: vi.fn().mockReturnValue(5000),
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
        {
          provide: CobroPendienteService,
          useValue: mockCobroService,
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

    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.some((t) => t.mensaje.includes('Venta registrada con éxito'))).toBe(
      true,
    );
  });

  it('debería auto-ocultar el toast después de 2 segundos', () => {
    vi.useFakeTimers();
    const toastService = TestBed.inject(ToastService);
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 100 } as never));

    component.confirmarVenta({ formaPago: 'efectivo' });
    fixture.detectChanges();

    expect(
      toastService.toasts().some((t) => t.mensaje.includes('Venta registrada con éxito')),
    ).toBe(true);

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(toastService.toasts()).toHaveLength(0);

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

    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    expect(component.ventaError()).toBe('Error de prueba');
  });

  // ─── R3: guard de doble submit (procesandoVenta) ───────────────

  it('R3: no registra dos ventas si se confirma dos veces mientras la primera está pendiente', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    let resolver!: (v: unknown) => void;
    mockVentaService.registrar.mockReturnValue(
      new Observable<unknown>((subscriber) => {
        resolver = (value: unknown) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    component.confirmarVenta({ formaPago: 'efectivo' });
    component.confirmarVenta({ formaPago: 'efectivo' });

    expect(mockVentaService.registrar).toHaveBeenCalledTimes(1);
    expect(component.procesandoVenta()).toBe(true);

    resolver({ id: 1, total: 100 });
    fixture.detectChanges();

    expect(component.procesandoVenta()).toBe(false);
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.some((t) => t.mensaje.includes('Venta registrada con éxito'))).toBe(
      true,
    );
  });

  it('R3: limpia procesandoVenta ante error para permitir reintentar', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto);

    mockVentaService.registrar.mockReturnValue(
      throwError(() => new Error('Error de prueba')),
    );

    component.confirmarVenta({ formaPago: 'efectivo' });

    expect(component.procesandoVenta()).toBe(false);
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

    mockVentaService.registrar.mockReturnValue(of({ id: 1, total: 3500 } as never));

    const payload: CheckoutPayload = {
      formaPago: 'divisas',
      divisaTipo: 'USD',
      billeteRecibido: 5,
      tasaCambio: 700,
    };

    component.confirmarVenta(payload);

    expect(mockVentaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 5,
        tasaCambio: 700,
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

  it('2.11 RED: debería llamar a CuentaCosasService.registrarLote con un item por producto', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto, 2);
    cart.agregar(productoB, 3);

    const payload: CheckoutPayload = {
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
      descripcion: 'Retiro familiar',
    };

    component.confirmarVenta(payload);

    expect(mockCuentaCosasService.registrarLote).toHaveBeenCalledWith(
      1,                                                       // jornadaId
      [
        { productoId: 1, cantidad: 2 },                        // primer producto
        { productoId: 2, cantidad: 3 },                        // segundo producto
      ],
      'Retiro familiar',                                       // descripcion
      'María',                                                 // autorizadoPor
    );
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
    expect(mockVentaService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: producto único en carrito debería llamar a registrarLote con batch de 1', () => {
    const cart = TestBed.inject(CartService);
    cart.agregar(producto, 2);

    mockCuentaCosasService.registrarLote.mockResolvedValue(undefined);

    const payload: CheckoutPayload = {
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
    };

    component.confirmarVenta(payload);

    expect(mockCuentaCosasService.registrarLote).toHaveBeenCalledWith(
      1,
      [{ productoId: 1, cantidad: 2 }],
      null,
      'María',
    );
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
  });

  it('2.11 RED: carrito vacío no debería llamar a ningún servicio', () => {
    const payload: CheckoutPayload = {
      formaPago: 'cuenta_cosas',
      autorizadoPor: 'María',
    };

    component.confirmarVenta(payload);

    expect(mockCuentaCosasService.registrarLote).not.toHaveBeenCalled();
    expect(mockCuentaCosasService.registrar).not.toHaveBeenCalled();
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

  // ─── 3.4 RED: botones Pendientes en POS ────────────────────────────

  function textoDeBotones(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b) => (b as HTMLButtonElement).textContent?.trim() ?? '');
  }

  it('3.4 RED: botones Cobrar Pendiente y Ver Pendientes siempre visibles (aunque el carrito esté vacío)', () => {
    const textos = textoDeBotones();
    expect(textos.some((t) => t.includes('Cobrar Pendiente'))).toBe(true);
    expect(textos.some((t) => t.includes('Ver Pendientes'))).toBe(true);
  });

  it('3.4 RED: ambos botones están deshabilitados sin jornada abierta', () => {
    const jornadaService = TestBed.inject(JornadaService);
    vi.mocked(jornadaService.jornadaAbierta).mockReturnValue(null);

    // Destruir el fixture del beforeEach y recrear: el mock ya devuelve null
    // ANTES del primer render, evita el ExpressionChangedAfterItHasBeenCheckedError.
    fixture.destroy();
    fixture = TestBed.createComponent(PosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const cobrar = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((b) => (b as HTMLButtonElement).textContent?.includes('Cobrar Pendiente')) as HTMLButtonElement;
    const ver = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((b) => (b as HTMLButtonElement).textContent?.includes('Ver Pendientes')) as HTMLButtonElement;

    expect(cobrar.disabled).toBe(true);
    expect(ver.disabled).toBe(true);
  });

  it('REQ neutro: sin jornada abierta muestra el aviso "No hay jornada abierta. Inicie el día en Jornada."', () => {
    const jornadaService = TestBed.inject(JornadaService);
    vi.mocked(jornadaService.jornadaAbierta).mockReturnValue(null);

    fixture.destroy();
    fixture = TestBed.createComponent(PosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.sinJornada).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'No hay jornada abierta. Inicie el día en Jornada.',
    );
  });

  it('FR-1/AC7: con jornada abierta de un día anterior, sinJornada=false y botones habilitados', () => {
    // Regresión fix-reanudar-jornada-acceso: obtenerAbierta() ya no filtra
    // fecha=hoy, por lo que jornadaAbierta puede contener una jornada de días
    // previos y el POS debe tratarla como jornada activa.
    const jornadaPrevia: Jornada = { ...mockJornada, fecha: '2026-08-07' };
    const jornadaService = TestBed.inject(JornadaService);
    vi.mocked(jornadaService.jornadaAbierta).mockReturnValue(jornadaPrevia);

    fixture.destroy();
    fixture = TestBed.createComponent(PosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.sinJornada).toBe(false);

    const cobrar = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((b) => (b as HTMLButtonElement).textContent?.includes('Cobrar Pendiente')) as HTMLButtonElement;
    const ver = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((b) => (b as HTMLButtonElement).textContent?.includes('Ver Pendientes')) as HTMLButtonElement;

    expect(cobrar.disabled).toBe(false);
    expect(ver.disabled).toBe(false);
  });

  it('3.4 RED: abrirCobroPendiente carga pendientes y abre el modal en modo cobrar', async () => {
    const pendiente: PendienteItem = {
      id: 1,
      compradorNombre: 'Carlos',
      fechaHora: '2026-08-05T10:00:00Z',
      total: 1000,
      jornadaId: 1,
    };
    mockCobroService.listarPendientes.mockResolvedValue([pendiente]);

    component.abrirCobroPendiente();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockCobroService.listarPendientes).toHaveBeenCalled();
    expect(component.modoPendientes()).toBe('cobrar');
    expect(component.showPendienteModal()).toBe(true);
    expect(component.pendientes()).toEqual([pendiente]);
  });

  it('3.4 RED: abrirVerPendientes abre el modal en modo soloLectura', () => {
    component.abrirVerPendientes();

    expect(component.modoPendientes()).toBe('ver');
    expect(component.showPendienteModal()).toBe(true);
  });

  it('3.4 RED: el modal pendiente se monta con soloLectura cuando el modo es ver', () => {
    component.modoPendientes.set('ver');
    component.showPendienteModal.set(true);
    fixture.detectChanges();

    // Angular 21 no emite ng-reflect-* para signal inputs; verificamos el
    // componente hijo directamente.
    const modalDebug = fixture.debugElement.query(By.directive(CobroPendienteModalComponent));
    expect(modalDebug).toBeTruthy();
    expect(modalDebug.componentInstance.soloLectura()).toBe(true);
  });

  it('3.4 RED: cobroCompletado cierra el modal y refresca la jornada', async () => {
    const jornadaService = TestBed.inject(JornadaService);
    component.abrirCobroPendiente();
    await fixture.whenStable();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('app-cobro-pendiente-modal') as HTMLElement;
    expect(modal).toBeTruthy();
    modal.dispatchEvent(new CustomEvent('cobroCompletado'));
    fixture.detectChanges();

    expect(component.showPendienteModal()).toBe(false);
    expect(jornadaService.refreshJornadaAbierta).toHaveBeenCalled();
  });

  it('3.4 RED: cancelar cierra el modal de pendientes', () => {
    component.showPendienteModal.set(true);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('app-cobro-pendiente-modal') as HTMLElement;
    modal.dispatchEvent(new CustomEvent('cancelar'));
    fixture.detectChanges();

    expect(component.showPendienteModal()).toBe(false);
  });

  // ─── R9: skeleton en la primera búsqueda; re-búsqueda mantiene el grid ─────

  it('R9: primera búsqueda (sin resultados) muestra skeleton grid en vez de spinner', () => {
    component.buscando.set(true);
    component.resultados.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-skeleton')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(0);
  });

  it('R9: re-búsqueda con resultados montados mantiene el grid (sin destello de skeleton)', () => {
    component.resultados.set([producto]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-product-card')).toHaveLength(1);

    component.buscando.set(true);
    component.resultados.set([producto, { ...producto, id: 2, nombre: 'Otro' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-skeleton')).toBeFalsy();
    const cards = fixture.nativeElement.querySelectorAll('app-product-card');
    expect(cards.length).toBe(2);
    expect(cards[1].textContent).toContain('Otro');
  });
});
