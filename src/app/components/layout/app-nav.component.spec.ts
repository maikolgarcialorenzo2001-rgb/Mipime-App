import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { AppNavComponent } from './app-nav.component';
import { AuthService } from '../../services/auth.service';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada } from '../../models';
import type { UsuarioPublico } from '../../models';

const mockJornadaAbierta: Jornada = {
  id: 1,
  fecha: '2026-06-05',
  hora_apertura: '09:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 15000,
  total_movimientos: 2000,
  saldo_esperado: 18000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-05T09:00:00Z',
  updated_at: '2026-06-05T09:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornadaAbierta,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 18000,
  user_cierre_id: 1,
};

const mockAdmin: UsuarioPublico = {
  id: 1,
  nombre: 'Admin',
  rol: 'admin',
  activo: 1,
  created_at: '',
  updated_at: '',
};

interface MockAuthService {
  usuario: Signal<UsuarioPublico | null>;
  isLoggedIn: ReturnType<typeof vi.fn>;
  hasRole: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

function createMockAuth(user: UsuarioPublico | null): MockAuthService {
  const userSignal = signal<UsuarioPublico | null>(user);
  return {
    usuario: userSignal.asReadonly(),
    isLoggedIn: vi.fn().mockReturnValue(user !== null),
    hasRole: vi.fn().mockImplementation((role: string) => user?.rol === role),
    logout: vi.fn(),
  };
}

interface MockJornadaService {
  jornadaAbierta: WritableSignal<Jornada | null>;
  jornadaCargando: WritableSignal<boolean>;
  cerrar: ReturnType<typeof vi.fn>;
  obtenerReporte: ReturnType<typeof vi.fn>;
}

function createMockJornadaService(): MockJornadaService {
  return {
    jornadaAbierta: signal<Jornada | null>(mockJornadaAbierta),
    jornadaCargando: signal(false),
    cerrar: vi.fn().mockReturnValue(of(mockJornadaCerrada)),
    obtenerReporte: vi.fn().mockReturnValue(of(null)),
  };
}

describe('AppNavComponent - cierre modal auto-calc', () => {
  let fixture: ComponentFixture<AppNavComponent>;
  let component: AppNavComponent;
  let mockJornadaSvc: MockJornadaService;
  let mockAuth: MockAuthService;

  beforeEach(() => {
    mockJornadaSvc = createMockJornadaService();
    mockAuth = createMockAuth(mockAdmin);

    TestBed.configureTestingModule({
      imports: [AppNavComponent],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: mockAuth },
        { provide: JornadaService, useValue: mockJornadaSvc },
      ],
    });

    fixture = TestBed.createComponent(AppNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('5.1 RED: modal de cierre debería mostrar saldo_esperado como read-only sin input de saldoReal', () => {
    // Abrir modal de cierre
    component.abrirModalCierre();
    fixture.detectChanges();

    const modalEl: HTMLElement = fixture.nativeElement;

    // NO debe haber un input con id "saldo-real-nav"
    const input = modalEl.querySelector('#saldo-real-nav');
    expect(input).toBeNull();

    // Debe mostrar el saldo_esperado en el modal
    const modalText = modalEl.querySelector('[role="dialog"]')?.textContent ?? '';
    expect(modalText).toContain('18,000'); // saldo_esperado del mock
    expect(modalText).toContain('Saldo esperado');
  });

  it('debería renderizar el botón de cambio de tema y alternar clase dark', () => {
    const el = fixture.nativeElement as HTMLElement;
    const themeBtn = el.querySelector('button[aria-label="Cambiar tema"]');
    expect(themeBtn).toBeTruthy();

    // Inicialmente en modo claro → ícono dark_mode
    const icon = themeBtn!.querySelector('.material-symbols-outlined');
    expect(icon?.textContent?.trim()).toBe('dark_mode');

    // Click → modo oscuro
    (themeBtn as HTMLElement).click();
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const iconDark = themeBtn!.querySelector('.material-symbols-outlined');
    expect(iconDark?.textContent?.trim()).toBe('light_mode');
  });

  it('5.2 RED: confirmarCierre debería pasar saldo_esperado como saldoReal a cerrar()', () => {
    component.abrirModalCierre();
    fixture.detectChanges();

    // No hay input de saldoReal, así que se usa saldo_esperado automáticamente
    component.confirmarCierre();

    expect(mockJornadaSvc.cerrar).toHaveBeenCalledWith(1, 18000, 1);
  });
});
