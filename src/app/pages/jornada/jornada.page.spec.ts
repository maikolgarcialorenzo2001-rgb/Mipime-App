import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { JornadaPage } from './jornada.page';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import type { Jornada, StockMovimiento } from '../../models';
import type { UsuarioPublico } from '../../models';
import type { Movimiento } from '../../models/movimiento';
import type { Venta } from '../../models/venta';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

interface MockJornadaService {
  jornadaAbierta: WritableSignal<Jornada | null>;
  jornadaCargando: WritableSignal<boolean>;
  obtenerAbierta: () => import('rxjs').Observable<Jornada | null>;
  cerrar: ReturnType<typeof vi.fn>;
  obtenerReporte: ReturnType<typeof vi.fn>;
  registrarMovimiento: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta: ReturnType<typeof vi.fn>;
  calcularTotalMerma: ReturnType<typeof vi.fn>;
}

interface MockJornadaServiceInput {
  jornadaAbierta?: Jornada | null;
  jornadaCargando?: boolean;
  obtenerAbierta?: () => import('rxjs').Observable<Jornada | null>;
  cerrar?: ReturnType<typeof vi.fn>;
  obtenerReporte?: ReturnType<typeof vi.fn>;
  registrarMovimiento?: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta?: ReturnType<typeof vi.fn>;
  calcularTotalMerma?: ReturnType<typeof vi.fn>;
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
    calcularTotalMerma: overrides.calcularTotalMerma ?? vi.fn(),
  };
}

const mockJornadaAbierta: Jornada = {
  id: 1,
  fecha: '2026-06-04',
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
  total_merma: 500,
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

    let mockDb: Database;

    beforeEach(() => {
      mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
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
      const mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('SÍ debería mostrar botón de cerrar para worker', () => {
      const btn = fixture.nativeElement.querySelector('button');
      expect(btn).toBeTruthy();
    });
  });

  describe('sin jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      const mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
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
      const mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
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
      const mockDb = createMockDb();

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
          { provide: DATABASE, useValue: mockDb },
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

      expect(registrarSpy).toHaveBeenCalledWith(1, 'gasto', 'Luz', 500, undefined);
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

      expect(registrarSpy).toHaveBeenCalledWith(1, 'ingreso_extra', 'Venta de envases', 300, undefined);
    });

    it('compra_divisa: opción existe en el selector', () => {
      fixture.detectChanges();
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      const options = Array.from(select.options).map(o => o.value);
      expect(options).toContain('compra_divisa');
    });

    it('compra_divisa: seleccionar muestra campos de divisa y oculta descripcion/monto', () => {
      component.tipo.set('compra_divisa');
      fixture.detectChanges();

      // Should show a second select for divisa type
      const selects = fixture.nativeElement.querySelectorAll('select');
      // Find the divisa select (not the tipo select)
      const divisaSelect = Array.from(selects).find(
        (s: Element) => (s as HTMLSelectElement).querySelector('option[value="USD"]')
      );
      expect(divisaSelect).toBeTruthy();

      // Should show divisa inputs
      const montoDivisaInput = fixture.nativeElement.querySelector('input[placeholder="Monto en divisa"]');
      expect(montoDivisaInput).toBeTruthy();
      const tasaInput = fixture.nativeElement.querySelector('input[placeholder="Tasa de cambio (cup)"]');
      expect(tasaInput).toBeTruthy();

      // Should hide regular description input
      const descInput = fixture.nativeElement.querySelector('input[placeholder="Descripción"]');
      expect(descInput).toBeFalsy();
    });

    it('compra_divisa: llama registrarMovimiento con datos de divisa calculados', () => {
      component.tipo.set('compra_divisa');
      component.montoDivisa.set(100);
      component.tasaCambio.set(120);
      component.divisaTipo.set('USD');
      fixture.detectChanges();

      component.registrarMovimiento();

      // monto = 100 * 120 = 12000, descripción auto-generada
      expect(registrarSpy).toHaveBeenCalledWith(
        1,
        'compra_divisa',
        'Compra USD 100 @ 120',
        12000,
        { divisaTipo: 'USD', montoDivisa: 100, tasaCambio: 120 },
      );
    });

    it('compra_divisa: rechaza montoDivisa = 0', () => {
      component.tipo.set('compra_divisa');
      component.montoDivisa.set(0);
      component.tasaCambio.set(120);
      fixture.detectChanges();

      component.registrarMovimiento();

      expect(component.formError()).toBe('El monto en divisa debe ser mayor a 0');
      expect(registrarSpy).not.toHaveBeenCalled();
    });

    it('compra_divisa: rechaza tasaCambio = 0', () => {
      component.tipo.set('compra_divisa');
      component.montoDivisa.set(100);
      component.tasaCambio.set(0);
      fixture.detectChanges();

      component.registrarMovimiento();

      expect(component.formError()).toBe('La tasa de cambio debe ser mayor a 0');
      expect(registrarSpy).not.toHaveBeenCalled();
    });
  });

  describe('movimiento form - worker', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      const mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('4.1 GREEN: worker debería ver formulario de movimiento (Opción B)', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      const descInput = fixture.nativeElement.querySelector('input[placeholder="Descripción"]');
      expect(descInput).toBeTruthy();
    });
  });

  describe('movimiento form - sin jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      const mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
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
      const mockDb = createMockDb();

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
          { provide: DATABASE, useValue: mockDb },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should compute saldoReal from arqueo form and pass arqueo entries to cerrar()', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      // Must show totalEnCaja as read-only (monto_inicial=5000, no ventas/mov)
      const modalText = fixture.nativeElement.querySelector('[role="dialog"]')?.textContent ?? '';
      expect(modalText).toContain('Total en caja');
      expect(modalText).toContain('5,000');

      // Set denomination values: 2 × $5.000 + 5 × $1.000 = $15.000
      component.arqueoForm.update(b => ({ ...b, [5000]: 2, [1000]: 5 }));
      fixture.detectChanges();

      component.confirmarCierre();
      expect(cerrarSpy).toHaveBeenCalledWith(1, 15000, 1, [
        { denominacion: 5000, cantidad: 2, subtotal: 10000 },
        { denominacion: 1000, cantidad: 5, subtotal: 5000 },
      ]);
    });

    it('debería mostrar error si confirmarCierre falla', () => {
      component.abrirModalCierre();
      component.cerrarError.set('Error de DB');
      fixture.detectChanges();

      const errorEl: HTMLElement | null = fixture.nativeElement.querySelector('.bg-red-50');
      expect(errorEl?.textContent).toContain('Error de DB');
    });

    it('arqueo: modal renders denomination inputs for visible denominations', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      const visible = component.denominacionesVisibles();

      // 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5 — but NOT 3 or 1
      expect(visible).not.toContain(1);
      expect(visible).not.toContain(3);
      expect(visible.length).toBe(10);

      // Each visible denomination has an input in the dialog
      for (const d of visible) {
        const label = dialog.querySelector(`span`) as HTMLElement;
        // At least the denomination label should be rendered
        expect(dialog.textContent).toContain(d.toLocaleString());
      }
    });

    it('arqueo: $1 and $3 inputs are NOT visible by default', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      expect(component.denominacionesVisibles()).not.toContain(1);
      expect(component.denominacionesVisibles()).not.toContain(3);
    });

    it('arqueo: checking optional checkbox shows $1 and $3 inputs', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      component.showOptionalDenoms.set(true);
      fixture.detectChanges();

      expect(component.denominacionesVisibles()).toContain(1);
      expect(component.denominacionesVisibles()).toContain(3);
      expect(component.denominacionesVisibles().length).toBe(12);
    });

    it('1.1 RED: DOM checkbox toggle shows/hides $1 and $3 denomination rows', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();

      // By default, $1 and $3 should NOT be in the DOM text
      expect(component.denominacionesVisibles()).not.toContain(1);
      expect(component.denominacionesVisibles()).not.toContain(3);

      // Click the checkbox to show optional denominations
      const checkbox = fixture.nativeElement.querySelector('#show-optional-denoms') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      checkbox.click();
      fixture.detectChanges();

      // After clicking, $1 and $3 should be visible in the computed
      expect(component.denominacionesVisibles()).toContain(1);
      expect(component.denominacionesVisibles()).toContain(3);
      expect(component.denominacionesVisibles().length).toBe(12);

      // The DOM should now contain denomination labels for $1 and $3
      expect(dialog.textContent).toContain('$1');
      expect(dialog.textContent).toContain('$3');
    });

    it('1.1 TRIANGULATE: unchecking hides $1 and $3 again', () => {
      component.abrirModalCierre();
      // First enable optional denoms
      component.showOptionalDenoms.set(true);
      fixture.detectChanges();

      expect(component.denominacionesVisibles().length).toBe(12);

      // Then uncheck
      const checkbox = fixture.nativeElement.querySelector('#show-optional-denoms') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      checkbox.click(); // toggles from checked to unchecked
      fixture.detectChanges();

      expect(component.denominacionesVisibles()).not.toContain(1);
      expect(component.denominacionesVisibles()).not.toContain(3);
      expect(component.denominacionesVisibles().length).toBe(10);
    });

    it('arqueo: total is computed correctly from entered quantities', () => {
      component.abrirModalCierre();

      component.arqueoForm.update(b => ({ ...b, [5000]: 3, [200]: 4, [50]: 2 }));
      fixture.detectChanges();

      // 3×5000 + 4×200 + 2×50 = 15000 + 800 + 100 = 15900
      expect(component.arqueoTotal()).toBe(15900);
    });

    it('arqueo: confirmarCierre shows error when all quantities are 0', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      component.confirmarCierre();

      expect(component.cerrarError()).toBe('Ingresa la cantidad de al menos una denominación');
      expect(cerrarSpy).not.toHaveBeenCalled();
    });

    it('arqueo: shows faltante label when totalEnCaja > arqueoTotal', () => {
      component.abrirModalCierre();
      // totalEnCaja starts at 5000 (monto_inicial, no ventas/mov loaded)
      // arqueoTotal = 3000 → diff = 2000 → faltante
      component.arqueoForm.update(b => ({ ...b, [2000]: 1, [1000]: 1 }));
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      expect(dialog.textContent).toContain('Faltante');
      expect(dialog.textContent).toContain('2,000');
    });

    it('arqueo: shows sobrante label when totalEnCaja < arqueoTotal', () => {
      component.abrirModalCierre();
      // totalEnCaja starts at 5000 (monto_inicial, no ventas/mov loaded)
      // arqueoTotal = 10000 → diff = -5000 → sobrante
      component.arqueoForm.update(b => ({ ...b, [5000]: 2 }));
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      expect(dialog.textContent).toContain('Sobrante');
      expect(dialog.textContent).toContain('5,000');
    });

    it('arqueo: shows cuadrado when totalEnCaja === arqueoTotal', () => {
      component.abrirModalCierre();
      // totalEnCaja starts at 5000 (monto_inicial, no ventas/mov loaded)
      component.arqueoForm.update(b => ({ ...b, [5000]: 1 }));
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      expect(dialog.textContent).toContain('Cuadrado');
    });
  });

  describe('tabla diaria con merma', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;
    let mockDb: Database;

    beforeEach(() => {
      mockDb = createMockDb();
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
          { provide: DATABASE, useValue: mockDb },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería mostrar sección de mermas cuando existen mermas', async () => {
      const mermasMock: StockMovimiento[] = [
        { id: 1, producto_id: 1, cantidad: 5, tipo: 'merma', motivo: 'Rotura', costo_total: 250, created_at: '2026-06-04T10:00:00Z' },
      ];
      component.mermasDelDia.set(mermasMock);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('Mermas');
      expect(texto).toContain('Rotura');
      expect(texto).toContain('250');
    });

    it('debería mostrar total_merma en el summary card en rojo', async () => {
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent;
      // mockJornadaAbierta has total_merma: 500
      expect(texto).toContain('Total mermas');
      expect(texto).toContain('500');
    });

    it('debería ocultar sección de mermas cuando no hay mermas', async () => {
      component.ventasDelDia.set([]);
      component.movimientosDelDia.set([]);
      component.mermasDelDia.set([]);
      fixture.detectChanges();

      // Check that no "Mermas" sub-header exists
      const allH4 = fixture.nativeElement.querySelectorAll('h4');
      const mermaHeader = Array.from(allH4).find(
        (h) => (h as HTMLElement).textContent?.includes('Mermas'),
      );
      expect(mermaHeader).toBeFalsy();

      // Daily table should not contain any merma rows
      const mermaRows = fixture.nativeElement.querySelectorAll('tbody tr');
      const mermaRowText = Array.from(mermaRows).map(
        (r) => (r as HTMLElement).textContent,
      );
      expect(mermaRowText.some((t) => t?.includes('Rotura'))).toBe(false);
    });
  });
});

describe('fix-cierre-jornada-calculos — totalEnCaja y diferencia', () => {
  let fixture: ComponentFixture<JornadaPage>;
  let component: JornadaPage;

  beforeEach(() => {
    const mockDb = createMockDb();
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
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    fixture = TestBed.createComponent(JornadaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── Task 1.1: totalEnCaja computed ───

  it('1.1 RED: totalEnCaja = monto_inicial + efectivo + ingresosExtra - gastos', () => {
    component.ventasDelDia.set([
      { id: 1, jornada_id: 1, fecha_hora: '', total: 2000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      { id: 2, jornada_id: 1, fecha_hora: '', total: 1000, usuario_id: 1, forma_pago: 'transferencia', created_at: '' },
    ] as Venta[]);
    component.movimientosDelDia.set([
      { id: 1, jornada_id: 1, tipo: 'ingreso_extra', descripcion: '', monto: 400, created_at: '' },
      { id: 2, jornada_id: 1, tipo: 'gasto', descripcion: '', monto: 300, created_at: '' },
    ] as Movimiento[]);

    // 5000 + 2000(efectivo) + 400(ingreso) - 300(gasto) = 7100
    expect(component.totalEnCaja()).toBe(7100);
  });

  it('1.1 RED: totalEnCaja = monto_inicial cuando no hay ventas ni movimientos', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);

    expect(component.totalEnCaja()).toBe(5000); // solo monto_inicial
  });

  // ─── Task 1.2: diferencia usa totalEnCaja ───

  it('1.2 RED: diferencia = totalEnCaja - arqueoTotal (faltante: totalEnCaja > arqueo)', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);
    // totalEnCaja = 5000
    component.arqueoForm.update(b => ({ ...b, [5000]: 1 })); // 5000
    // diferencia = 5000 - 5000 = 0 → cuadrado
    expect(component.diferencia()).toBe(0);

    component.arqueoForm.update(b => ({ ...b, [5000]: 0, [2000]: 2 })); // 4000
    // diferencia = 5000 - 4000 = 1000 → faltante
    expect(component.diferencia()).toBe(1000);
  });

  it('1.2 RED: diferencia = totalEnCaja - arqueoTotal (sobrante: totalEnCaja < arqueo)', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);
    // totalEnCaja = 5000
    component.arqueoForm.update(b => ({ ...b, [5000]: 2 })); // 10000
    // diferencia = 5000 - 10000 = -5000 → sobrante
    expect(component.diferencia()).toBe(-5000);
  });

  it('1.2 RED: faltante label en modal cuando totalEnCaja > arqueoTotal', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);
    // totalEnCaja = 5000
    component.abrirModalCierre();
    component.arqueoForm.update(b => ({ ...b, [2000]: 2 })); // 4000
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Faltante');
    expect(dialog?.textContent).toContain('1,000'); // 5000 - 4000 = 1000
  });

  it('1.2 RED: sobrante label en modal cuando totalEnCaja < arqueoTotal', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);
    // totalEnCaja = 5000
    component.abrirModalCierre();
    component.arqueoForm.update(b => ({ ...b, [5000]: 2 })); // 10000
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Sobrante');
    expect(dialog?.textContent).toContain('5,000'); // 5000 - 10000 = -5000 → sobrante 5000
  });

  it('1.2 RED: cuadrado label en modal cuando totalEnCaja === arqueoTotal', () => {
    component.ventasDelDia.set([]);
    component.movimientosDelDia.set([]);
    // totalEnCaja = 5000
    component.abrirModalCierre();
    component.arqueoForm.update(b => ({ ...b, [5000]: 1 })); // 5000
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Cuadrado');
  });

  it('onDenomInput actualiza arqueoForm conservando solo dígitos', () => {
    component.abrirModalCierre();
    const input = document.createElement('input');
    input.value = 'abc123def';
    component.onDenomInput(5000, { target: input } as unknown as Event);
    // Signal debe tener solo los dígitos
    expect(component.arqueoForm()[5000]).toBe(123);
    // La señal es la única fuente de verdad ahora
  });

  it('onDenomInput setea 0 si solo hay letras', () => {
    component.abrirModalCierre();
    const input = document.createElement('input');
    input.value = 'abc';
    component.onDenomInput(1000, { target: input } as unknown as Event);
    expect(component.arqueoForm()[1000]).toBe(0);
  });

  it('onDenomInput actualiza arqueoForm con valores mixtos', () => {
    component.abrirModalCierre();
    const input = document.createElement('input');
    input.value = 'xyz42pq';
    component.onDenomInput(200, { target: input } as unknown as Event);
    expect(component.arqueoForm()[200]).toBe(42);
  });

  it('filtrarTecla bloquea teclas no numéricas', () => {
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('filtrarTecla permite teclas numéricas', () => {
    const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('filtrarTecla permite teclas de navegación', () => {
    const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    component.filtrarTecla(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('arqueoForm es signal puro — set directo con valor numérico funciona', () => {
    component.abrirModalCierre();
    component.arqueoForm.set({ ...component.arqueoForm(), [5000]: 15 });
    fixture.detectChanges();
    expect(component.arqueoForm()[5000]).toBe(15);
  });

  describe('responsive layout', () => {
    it('debería tener container con max-w-7xl', () => {
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.max-w-7xl');
      expect(container).toBeTruthy();
    });
  });
});
