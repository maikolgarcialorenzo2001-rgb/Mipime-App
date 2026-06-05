import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { JornadaPage } from './jornada.page';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import type { Jornada } from '../../models';
import type { UsuarioPublico } from '../../models';

interface MockJornadaService {
  jornadaAbierta: WritableSignal<Jornada | null>;
  jornadaCargando: WritableSignal<boolean>;
  obtenerAbierta: () => import('rxjs').Observable<Jornada | null>;
  cerrar: ReturnType<typeof vi.fn>;
  obtenerReporte: ReturnType<typeof vi.fn>;
  registrarMovimiento: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta: ReturnType<typeof vi.fn>;
}

interface MockJornadaServiceInput {
  jornadaAbierta?: Jornada | null;
  jornadaCargando?: boolean;
  obtenerAbierta?: () => import('rxjs').Observable<Jornada | null>;
  cerrar?: ReturnType<typeof vi.fn>;
  obtenerReporte?: ReturnType<typeof vi.fn>;
  registrarMovimiento?: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta?: ReturnType<typeof vi.fn>;
}

function createMockJornadaService(overrides: MockJornadaServiceInput = {}): MockJornadaService {
  return {
    jornadaAbierta: signal<Jornada | null>(overrides.jornadaAbierta ?? null),
    jornadaCargando: signal<boolean>(overrides.jornadaCargando ?? false),
    obtenerAbierta: overrides.obtenerAbierta ?? (() => of(null)),
    cerrar: overrides.cerrar ?? vi.fn(),
    obtenerReporte: overrides.obtenerReporte ?? vi.fn(),
    registrarMovimiento: overrides.registrarMovimiento ?? vi.fn(),
    refreshJornadaAbierta: overrides.refreshJornadaAbierta ?? vi.fn(),
  };
}

const mockJornadaAbierta: Jornada = {
  id: 1,
  fecha: '2026-06-04',
  hora_apertura: '09:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 15000,
  total_gastos: 2000,
  saldo_esperado: 18000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-04T09:00:00Z',
  updated_at: '2026-06-04T09:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornadaAbierta,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 17800,
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

const mockWorker: UsuarioPublico = {
  id: 2,
  nombre: 'Worker',
  rol: 'trabajador',
  activo: 1,
  created_at: '',
  updated_at: '',
};

function createMockAuth(usuarioValue: UsuarioPublico | null) {
  const s = signal<UsuarioPublico | null>(usuarioValue);
  return {
    usuario: s.asReadonly(),
    hasRole: (role: string) => usuarioValue?.rol === role,
  };
}

describe('JornadaPage', () => {
  describe('con jornada abierta — admin', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: mockJornadaAbierta,
              jornadaCargando: false,
              obtenerAbierta: () => of(mockJornadaAbierta),
              cerrar: vi.fn().mockReturnValue(of(mockJornadaCerrada)),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería crearse', () => {
      expect(component).toBeTruthy();
    });

    it('debería mostrar el resumen de la jornada', () => {
      const card = fixture.nativeElement.querySelector('app-jornada-summary-card');
      expect(card).toBeTruthy();
    });

    it('debería mostrar botón "Cerrar jornada" para admin', () => {
      const btn = fixture.nativeElement.querySelector('button');
      expect(btn?.textContent?.trim()).toContain('Cerrar jornada');
    });

    it('debería abrir modal al hacer click en cerrar', () => {
      component.abrirModalCierre();
      fixture.detectChanges();
      expect(component.showCloseModal()).toBe(true);
    });

    it('debería cerrar modal con Escape', () => {
      component.abrirModalCierre();
      component.onModalKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(component.showCloseModal()).toBe(false);
    });
  });

  describe('con jornada abierta — worker', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: mockJornadaAbierta,
              jornadaCargando: false,
              obtenerAbierta: () => of(mockJornadaAbierta),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockWorker) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('NO debería mostrar botón de cerrar para worker', () => {
      const btn = fixture.nativeElement.querySelector('button');
      expect(btn).toBeFalsy();
    });
  });

  describe('sin jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: null,
              jornadaCargando: false,
              obtenerAbierta: () => of(null),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('debería mostrar empty state si no hay jornada', () => {
      const empty = fixture.nativeElement.querySelector('app-empty-state');
      expect(empty).toBeTruthy();
    });
  });

  describe('error al cargar jornada', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: null,
              jornadaCargando: false,
              obtenerAbierta: () => of(null),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      const component = fixture.componentInstance;
      component.error.set('Error al cargar');
      fixture.detectChanges();
    });

    it('debería mostrar error si hay error', () => {
      const error = fixture.nativeElement.querySelector('app-error-alert');
      expect(error).toBeTruthy();
    });
  });

  describe('movimiento form - admin con jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;
    let registrarSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      registrarSpy = vi.fn().mockReturnValue(of({ id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'test', monto: 100, created_at: '' }));

      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: mockJornadaAbierta,
              jornadaCargando: false,
              obtenerAbierta: () => of(mockJornadaAbierta),
              registrarMovimiento: registrarSpy,
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('4.1 RED: debería mostrar formulario de movimiento para admin con jornada abierta', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      const descInput = fixture.nativeElement.querySelector('input[placeholder="Descripción"]');
      expect(descInput).toBeTruthy();
      const montoInput = fixture.nativeElement.querySelector('input[placeholder="Monto"]');
      expect(montoInput).toBeTruthy();
    });

    it('4.1 RED: debería llamar registrarMovimiento al submit con datos válidos', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Luz');
      component.monto.set(500);
      fixture.detectChanges();

      component.registrarMovimiento();

      expect(registrarSpy).toHaveBeenCalledWith(1, 'gasto', 'Luz', 500);
    });

    it('4.1 RED: debería limpiar form y refrescar jornada tras registro exitoso', () => {
      const refreshSpy = vi.fn();
      (TestBed.inject(JornadaService) as any).refreshJornadaAbierta = refreshSpy;

      component.tipo.set('gasto');
      component.descripcion.set('Luz');
      component.monto.set(500);
      fixture.detectChanges();

      component.registrarMovimiento();

      expect(component.tipo()).toBe('gasto');
      expect(component.descripcion()).toBe('');
      expect(component.monto()).toBe(0);
      expect(component.registrando()).toBe(false);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('4.1 RED: debería mostrar error si descripcion está vacía', () => {
      component.tipo.set('gasto');
      component.descripcion.set('');
      component.monto.set(500);

      component.registrarMovimiento();

      expect(component.formError()).toBe('La descripción es requerida');
      expect(registrarSpy).not.toHaveBeenCalled();
    });

    it('4.1 RED: debería mostrar error si monto es 0', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(0);

      component.registrarMovimiento();

      expect(component.formError()).toBe('El monto debe ser mayor a 0');
      expect(registrarSpy).not.toHaveBeenCalled();
    });

    it('4.1 RED: debería mostrar error si monto es negativo', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(-100);

      component.registrarMovimiento();

      expect(component.formError()).toBe('El monto debe ser mayor a 0');
      expect(registrarSpy).not.toHaveBeenCalled();
    });

    it('4.1 RED: debería llamar registrarMovimiento con ingreso_extra', () => {
      component.tipo.set('ingreso_extra');
      component.descripcion.set('Venta de envases');
      component.monto.set(300);
      fixture.detectChanges();

      component.registrarMovimiento();

      expect(registrarSpy).toHaveBeenCalledWith(1, 'ingreso_extra', 'Venta de envases', 300);
    });
  });

  describe('movimiento form - worker', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: mockJornadaAbierta,
              jornadaCargando: false,
              obtenerAbierta: () => of(mockJornadaAbierta),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockWorker) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('4.1 RED: NO debería mostrar formulario de movimiento para worker', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeFalsy();
      const descInput = fixture.nativeElement.querySelector('input[placeholder="Descripción"]');
      expect(descInput).toBeFalsy();
    });
  });

  describe('movimiento form - sin jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: null,
              jornadaCargando: false,
              obtenerAbierta: () => of(null),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('4.1 RED: NO debería mostrar formulario cuando no hay jornada abierta', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeFalsy();
    });
  });

  describe('cierre de jornada', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;
    let cerrarSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      cerrarSpy = vi.fn().mockReturnValue(of(mockJornadaCerrada));

      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: createMockJornadaService({
              jornadaAbierta: mockJornadaAbierta,
              jornadaCargando: false,
              obtenerAbierta: () => of(mockJornadaAbierta),
              cerrar: cerrarSpy,
              obtenerReporte: vi.fn().mockReturnValue(of({
                id: 1,
                jornada_id: 1,
                content_type: 'excel',
                content_base64: '',
                filename: 'jornada_2026-06-04_1.xlsx',
                created_at: '',
              })),
            }),
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('5.3 RED: modal de cierre debería pasar saldo_esperado como saldoReal sin input manual', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      // NO debe haber input de saldoReal
      const input = fixture.nativeElement.querySelector('#saldo-real');
      expect(input).toBeNull();

      // Debe mostrar el saldo_esperado como read-only
      const modalText = fixture.nativeElement.querySelector('[role="dialog"]')?.textContent ?? '';
      expect(modalText).toContain('Saldo esperado');
      expect(modalText).toContain('18,000');

      // confirmarCierre debe usar saldo_esperado automáticamente
      component.confirmarCierre();
      expect(cerrarSpy).toHaveBeenCalledWith(1, 18000, 1);
    });

    it('debería mostrar error si confirmarCierre falla', () => {
      component.abrirModalCierre();
      component.cerrarError.set('Error de DB');
      fixture.detectChanges();

      const errorEl: HTMLElement | null = fixture.nativeElement.querySelector('.bg-red-50');
      expect(errorEl?.textContent).toContain('Error de DB');
    });
  });
});
