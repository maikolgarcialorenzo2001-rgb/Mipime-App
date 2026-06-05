import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PosPage } from './pos.page';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import { JornadaService } from '../../services/jornada.service';
import { VentaService } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';
import { CurrencyPipe } from '@angular/common';
import type { Jornada, Producto } from '../../models';

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
  stock_actual: 50,
  created_at: '',
  updated_at: '',
};

describe('PosPage — toast de éxito', () => {
  let fixture: ComponentFixture<PosPage>;
  let component: PosPage;
  let mockVentaService: { registrar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockVentaService = {
      registrar: vi.fn(),
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
          },
        },
        {
          provide: VentaService,
          useValue: mockVentaService,
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

    component.confirmarVenta();
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

    component.confirmarVenta();
    fixture.detectChanges();

    const toastEl = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastEl).toBeTruthy();

    // Avanzar 2 segundos
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

    component.confirmarVenta();
    fixture.detectChanges();

    const toastEl = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Venta registrada con éxito'),
    );
    expect(toastEl).toBeFalsy();
    expect(component.ventaError()).toBe('Error de prueba');
  });
});
