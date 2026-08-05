import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { AppNavComponent } from './app-nav.component';
import { AuthService } from '../../services/auth.service';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada } from '../../models';
import type { UsuarioPublico } from '../../models';
import { APP_VERSION } from '../../version';

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
  user_apertura_id: null,
  total_merma: 0,
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
  totalEnCaja: WritableSignal<number>;
  cerrar: ReturnType<typeof vi.fn>;
  obtenerReporte: ReturnType<typeof vi.fn>;
}

function createMockJornadaService(): MockJornadaService {
  return {
    jornadaAbierta: signal<Jornada | null>(mockJornadaAbierta),
    jornadaCargando: signal(false),
    totalEnCaja: signal(18000),
    cerrar: vi.fn().mockReturnValue(of(mockJornadaCerrada)),
    obtenerReporte: vi.fn().mockReturnValue(of(null)),
  };
}

describe('AppNavComponent - cierre modal auto-calc', () => {
  let fixture: ComponentFixture<AppNavComponent>;
  let component: AppNavComponent;
  let mockJornadaSvc: MockJornadaService;
  let mockAuth: MockAuthService;
  let mockElectronFileSvc: {
    isElectronPackaged: boolean;
    saveIndividual: ReturnType<typeof vi.fn>;
    downloadBlob: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockJornadaSvc = createMockJornadaService();
    mockAuth = createMockAuth(mockAdmin);
    mockElectronFileSvc = {
      isElectronPackaged: false,
      saveIndividual: vi.fn().mockResolvedValue(undefined),
      downloadBlob: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppNavComponent],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: mockAuth },
        { provide: JornadaService, useValue: mockJornadaSvc },
        { provide: ElectronFileService, useValue: mockElectronFileSvc },
      ],
    });

    fixture = TestBed.createComponent(AppNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería tener montoInicial default de 500', () => {
    expect(component.montoInicial()).toBe(500);
  });

  it('debería mantener montoInicial en 500 al abrir el modal de apertura', () => {
    component.abrirModalApertura();
    expect(component.montoInicial()).toBe(500);
    expect(component.showOpenModal()).toBe(true);
  });

  it('5.1 RED: modal de cierre debería mostrar totalEnCaja como read-only sin input de saldoReal', () => {
    // Abrir modal de cierre
    component.abrirModalCierre();
    fixture.detectChanges();

    const modalEl: HTMLElement = fixture.nativeElement;

    // NO debe haber un input con id "saldo-real-nav"
    const input = modalEl.querySelector('#saldo-real-nav');
    expect(input).toBeNull();

    // Debe mostrar el totalEnCaja en el modal
    const modalText = modalEl.querySelector('[role="dialog"]')?.textContent ?? '';
    expect(modalText).toContain('18,000'); // totalEnCaja del mock
    expect(modalText).toContain('Total en caja');
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

  it('5.2 RED: confirmarCierre debería pasar arqueoTotal como saldoReal con entries a cerrar()', () => {
    component.abrirModalCierre();
    fixture.detectChanges();

    // Set at least one denomination so entries are non-empty
    component.actualizarCantidad(5000, 1);
    fixture.detectChanges();

    component.confirmarCierre();

    // saldoReal = 5000 * 1 = 5000
    expect(mockJornadaSvc.cerrar).toHaveBeenCalledWith(1, 1, [
      { denominacion: 5000, cantidad: 1, subtotal: 5000 },
    ]);
  });

  it('should call ElectronFileService.downloadBlob after confirmarCierre (Blob only, service ya guardó)', () => {
    mockJornadaSvc.obtenerReporte.mockReturnValue(of({
      id: 1,
      jornada_id: 1,
      content_type: 'excel',
      content_base64: 'dGVzdEJhc2U2NA==',
      filename: 'jornada_2026-06-05_1.xlsx',
      created_at: '',
    }));
    mockElectronFileSvc.isElectronPackaged = true;

    component.abrirModalCierre();
    fixture.detectChanges();
    component.actualizarCantidad(5000, 1);
    component.confirmarCierre();

    expect(mockElectronFileSvc.downloadBlob).toHaveBeenCalledWith(
      'dGVzdEJhc2U2NA==',
      'jornada_2026-06-05_1.xlsx',
    );
  });

  it('1.3 RED: checkbox toggle shows/hides $1 and $3 denomination rows in nav modal', () => {
    component.abrirModalCierre();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    // By default, $1 and $3 should NOT be visible
    expect(component.denominacionesVisibles()).not.toContain(1);
    expect(component.denominacionesVisibles()).not.toContain(3);
    expect(component.denominacionesVisibles().length).toBe(10);

    // Click checkbox to show optional denominations
    const checkbox = fixture.nativeElement.querySelector('#show-optional-denoms-nav') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.click();
    fixture.detectChanges();

    // After clicking, $1 and $3 should be visible
    expect(component.denominacionesVisibles()).toContain(1);
    expect(component.denominacionesVisibles()).toContain(3);
    expect(component.denominacionesVisibles().length).toBe(12);

    // DOM should have $1 and $3
    expect(dialog.textContent).toContain('$1');
    expect(dialog.textContent).toContain('$3');
  });

  it('1.3 TRIANGULATE: unchecking hides $1 and $3 again in nav modal', () => {
    component.abrirModalCierre();
    component.showOptionalDenoms.set(true);
    fixture.detectChanges();

    expect(component.denominacionesVisibles().length).toBe(12);

    const checkbox = fixture.nativeElement.querySelector('#show-optional-denoms-nav') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.click(); // toggles off
    fixture.detectChanges();

    expect(component.denominacionesVisibles()).not.toContain(1);
    expect(component.denominacionesVisibles()).not.toContain(3);
    expect(component.denominacionesVisibles().length).toBe(10);
  });

  it('debería renderizar el badge de versión desde APP_VERSION en la barra', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(`v${APP_VERSION}`);
  });

  it('debería mostrar el badge de versión una sola vez (discreto, sin duplicar)', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const occurrences = text.split(`v${APP_VERSION}`).length - 1;
    expect(occurrences).toBe(1);
  });
});
