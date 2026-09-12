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
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../../version';
import { PesosPipe } from '../../pipes/pesos.pipe';

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
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.remove(
      ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
    );

    mockJornadaSvc = createMockJornadaService();
    mockAuth = createMockAuth(mockAdmin);
    mockElectronFileSvc = {
      isElectronPackaged: false,
      saveIndividual: vi.fn().mockResolvedValue(undefined),
      downloadBlob: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppNavComponent, PesosPipe],
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

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.remove(
      ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
    );
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

  it('el botón suelto de tema ya no debería existir en la top bar; el control vive en el modal', () => {
    const el2 = fixture.nativeElement as HTMLElement;
    expect(el2.querySelector('nav button[aria-label="Cambiar tema"]')).toBeNull();
    expect(el2.querySelector('nav button[aria-label="Ajustes"]')).toBeTruthy();
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
    mockJornadaSvc.obtenerReporte.mockReturnValue(
      of({
        id: 1,
        jornada_id: 1,
        content_type: 'excel',
        content_base64: 'dGVzdEJhc2U2NA==',
        filename: 'jornada_2026-06-05_1.xlsx',
        created_at: '',
      }),
    );
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
    const checkbox = fixture.nativeElement.querySelector(
      '#show-optional-denoms-nav',
    ) as HTMLInputElement;
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

    const checkbox = fixture.nativeElement.querySelector(
      '#show-optional-denoms-nav',
    ) as HTMLInputElement;
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

  it('el indicador de la página activa es una píldora corta centrada (active-accent), sin chip de texto', () => {
    const tpl = readFileSync('src/app/components/layout/app-nav.component.html', 'utf-8');

    // Sin chip de texto de la página activa en la top bar
    expect(tpl).not.toContain('activePage');
    expect(tpl).not.toContain('font-mono');

    // El acento ya no es un borde full-width: no debe quedar border-b-2 en los ítems
    expect(tpl.match(/border-b-2/g) ?? []).toHaveLength(0);

    // Los 12 ítems (6 desktop + 6 bottom) usan el marcador active-accent
    const acentos = tpl.match(/\[class\.active-accent\]="[a-zA-Z]+(?:Bottom)?\.isActive"/g) ?? [];
    expect(acentos.length).toBe(12);

    // El texto activo queda del tono del hover (azul), el gris solo si NO está activo
    const textoAzul = tpl.match(/\[class\.text-blue-600\]="[a-zA-Z]+(?:Bottom)?\.isActive"/g) ?? [];
    expect(textoAzul.length).toBe(12);
    const textoGrisNoActivo = tpl.match(/\[class\.text-gray-600\]="![a-zA-Z]+(?:Bottom)?\.isActive"/g) ?? [];
    expect(textoGrisNoActivo.length).toBe(12);
    const textoGrisDark = tpl.match(/\[class\.dark:text-gray-400\]="![a-zA-Z]+(?:Bottom)?\.isActive"/g) ?? [];
    expect(textoGrisDark.length).toBe(12);

    // Contrato CSS (global): píldora corta, centrada, con variante dark.
    // Vive en styles.css porque la encapsulación emulada del componente rompe
    // el selector .dark descendiente (el dark vive en <html>).
    const css = readFileSync('src/styles.css', 'utf-8');
    expect(css).toContain('.active-accent::after');
    expect(css).toMatch(/left:\s*50%/);
    expect(css).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(css).toMatch(/width:\s*\d+px/);
    expect(css).toMatch(/\.dark \.active-accent::after/);
  });

  describe('Modal de ajustes', () => {
    function abrirModalAjustes(): HTMLElement {
      const gear = (fixture.nativeElement as HTMLElement).querySelector(
        'nav button[aria-label="Ajustes"]',
      ) as HTMLElement;
      expect(gear).toBeTruthy();
      gear.click();
      fixture.detectChanges();
      return gear;
    }

    function botonNivel(label: string): HTMLElement {
      const grupo = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="group"][aria-label="Tamaño de fuente"]',
      );
      const boton = Array.from(grupo?.querySelectorAll('button') ?? []).find(
        (b) => b.textContent?.trim() === label,
      );
      expect(boton).toBeTruthy();
      return boton as HTMLElement;
    }

    it('debería abrir el modal con selector de 5 niveles y toggle de tema al pulsar Ajustes', () => {
      abrirModalAjustes();

      const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain('Ajustes');

      const grupo = dialog?.querySelector('[role="group"][aria-label="Tamaño de fuente"]');
      expect(grupo?.querySelectorAll('button').length).toBe(5);

      expect(dialog?.querySelector('button[aria-label="Cambiar tema"]')).toBeTruthy();
    });

    it('debería cerrar el modal con el botón de cierre', () => {
      abrirModalAjustes();

      const closeBtn = (fixture.nativeElement as HTMLElement).querySelector(
        'button[aria-label="Cerrar ajustes"]',
      ) as HTMLElement;
      expect(closeBtn).toBeTruthy();
      closeBtn.click();
      fixture.detectChanges();

      expect(component.showSettingsModal()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
    });

    it('debería cerrar el modal al hacer clic en el backdrop pero no al hacer clic dentro', () => {
      abrirModalAjustes();

      const panel = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="dialog"] > div',
      ) as HTMLElement;
      panel.click();
      fixture.detectChanges();
      expect(component.showSettingsModal()).toBe(true);

      const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="dialog"]',
      ) as HTMLElement;
      backdrop.click();
      fixture.detectChanges();
      expect(component.showSettingsModal()).toBe(false);
    });

    it('debería cerrar el modal al presionar Escape', () => {
      abrirModalAjustes();

      const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="dialog"]',
      ) as HTMLElement;
      backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(component.showSettingsModal()).toBe(false);
    });

    it('cada nivel de fuente debería aplicar su marcador y persistir al hacer clic', () => {
      abrirModalAjustes();
      const niveles: [string, string | null, string][] = [
        ['Pequeña', 'font-scale-small', 'small'],
        ['Grande', 'font-scale-large', 'large'],
        ['Muy grande', 'font-scale-xlarge', 'xlarge'],
        ['Extra grande', 'font-scale-xxlarge', 'xxlarge'],
        ['Normal', null, 'normal'],
      ];

      for (const [label, cls, stored] of niveles) {
        botonNivel(label).click();
        fixture.detectChanges();

        if (cls) {
          expect(document.documentElement.classList.contains(cls)).toBe(true);
        } else {
          const tieneMarcador = [...document.documentElement.classList].some((c) =>
            c.startsWith('font-scale-'),
          );
          expect(tieneMarcador).toBe(false);
        }
        expect(localStorage.getItem('fontScale')).toBe(stored);
      }
    });

    it('el toggle de tema dentro del modal debería controlar .dark y localStorage', () => {
      abrirModalAjustes();
      const toggle = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="dialog"] button[aria-label="Cambiar tema"]',
      ) as HTMLElement;
      expect(toggle).toBeTruthy();

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      toggle.click();
      fixture.detectChanges();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(toggle.querySelector('.material-symbols-outlined')?.textContent?.trim()).toBe(
        'light_mode',
      );

      toggle.click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('tema y escala deberían ser independientes', () => {
      abrirModalAjustes();

      botonNivel('Extra grande').click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(true);

      const toggle = (fixture.nativeElement as HTMLElement).querySelector(
        '[role="dialog"] button[aria-label="Cambiar tema"]',
      ) as HTMLElement;
      toggle.click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(true);

      botonNivel('Normal').click();
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(false);
      expect(localStorage.getItem('fontScale')).toBe('normal');
    });
  });
});
