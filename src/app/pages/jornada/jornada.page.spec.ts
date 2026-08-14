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
import type { CuentaCosa } from '../../models/cuenta-cosa';

function createMockDb(): Database {
  const sql = vi.fn().mockResolvedValue([]) as unknown as Database['sql'];
  return {
    sql,
    transaction: vi.fn((fn) => fn({ sql: (q: string, p?: unknown[]) => sql(q, p) })),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

interface MockJornadaService {
  jornadaAbierta: WritableSignal<Jornada | null>;
  jornadaCargando: WritableSignal<boolean>;
  totalEnCaja: WritableSignal<number>;
  obtenerAbierta: () => import('rxjs').Observable<Jornada | null>;
  registrarMovimiento: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta: ReturnType<typeof vi.fn>;
  calcularTotalMerma: ReturnType<typeof vi.fn>;
  saldoSuficientePara: (monto: number) => boolean;
}

interface MockJornadaServiceInput {
  jornadaAbierta?: Jornada | null;
  jornadaCargando?: boolean;
  totalEnCaja?: number;
  obtenerAbierta?: () => import('rxjs').Observable<Jornada | null>;
  registrarMovimiento?: ReturnType<typeof vi.fn>;
  refreshJornadaAbierta?: ReturnType<typeof vi.fn>;
  calcularTotalMerma?: ReturnType<typeof vi.fn>;
}

function createMockJornadaService(overrides: MockJornadaServiceInput = {}): MockJornadaService {
  const totalEnCaja = signal<number>(overrides.totalEnCaja ?? 0);
  return {
    jornadaAbierta: signal<Jornada | null>(overrides.jornadaAbierta ?? null),
    jornadaCargando: signal<boolean>(overrides.jornadaCargando ?? false),
    totalEnCaja,
    obtenerAbierta: overrides.obtenerAbierta ?? (() => of(null)),
    registrarMovimiento: overrides.registrarMovimiento ?? vi.fn(),
    refreshJornadaAbierta: overrides.refreshJornadaAbierta ?? vi.fn(),
    calcularTotalMerma: overrides.calcularTotalMerma ?? vi.fn(),
    saldoSuficientePara: (monto: number) => totalEnCaja() >= monto,
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
      const divisaSelect = Array.from(selects).find(
        (s: unknown) => (s as HTMLSelectElement).querySelector('option[value="USD"]')
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

    it('debería mostrar columna Ubicación en la tabla de mermas', () => {
      const mermasMock: StockMovimiento[] = [
        { id: 1, producto_id: 1, cantidad: 5, tipo: 'merma', motivo: 'Rotura', costo_total: 250, created_at: '2026-06-04T10:00:00Z', ubicacion: 'shop' },
        { id: 2, producto_id: 2, cantidad: 3, tipo: 'merma', motivo: 'Vencimiento', costo_total: 120, created_at: '2026-06-04T11:00:00Z', ubicacion: 'almacen' },
      ];
      component.mermasDelDia.set(mermasMock);
      fixture.detectChanges();

      const ths = fixture.nativeElement.querySelectorAll('thead tr th');
      const ubicacionHeader = Array.from(ths).find(
        (th) => (th as HTMLElement).textContent?.includes('Ubicación'),
      );
      expect(ubicacionHeader).toBeTruthy();

      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('Tienda');
      expect(texto).toContain('Almacén');
    });

    it('debería mostrar "—" cuando ubicacion es undefined en merma', () => {
      const mermasMock: StockMovimiento[] = [
        { id: 1, producto_id: 1, cantidad: 5, tipo: 'merma', motivo: 'Rotura', costo_total: 250, created_at: '2026-06-04T10:00:00Z' },
      ];
      component.mermasDelDia.set(mermasMock);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('—');
    });
  });

  describe('tabla diaria con cuenta casas', () => {
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

    it('6.1 RED: debería mostrar bloque "Cuenta Casas del día" con 5 columnas en orden cronológico', () => {
      const cuentasMock: CuentaCosa[] = [
        { id: 1, jornada_id: 1, producto_id: 1, cantidad: 2, descripcion: 'Retiro familiar', autorizado_por: 'María', created_at: '2026-06-04T08:00:00Z' },
        { id: 2, jornada_id: 1, producto_id: 2, cantidad: 3, descripcion: 'Encargo', autorizado_por: 'Juan', created_at: '2026-06-04T09:00:00Z' },
      ];
      component.productosMap.set(new Map([[1, 'Café'], [2, 'Pan']]));
      component.cuentasCosasDelDia.set(cuentasMock);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('Cuenta Casas del día');
      expect(texto).toContain('Café');
      expect(texto).toContain('2');
      expect(texto).toContain('Retiro familiar');
      expect(texto).toContain('María');
      expect(texto).toContain('Pan');
      expect(texto).toContain('3');
      expect(texto).toContain('Encargo');
      expect(texto).toContain('Juan');

      // 5 columnas: Producto, Cantidad, Descripción, Autorizado por, Hora
      const ths = fixture.nativeElement.querySelectorAll('thead tr th');
      const headers = Array.from(ths).map((th) => (th as HTMLElement).textContent?.trim());
      expect(headers).toContain('Producto');
      expect(headers).toContain('Cantidad');
      expect(headers).toContain('Descripción');
      expect(headers).toContain('Autorizado por');
      expect(headers).toContain('Hora');
    });

    it('6.1 RED: debería ocultar bloque cuando no hay cuenta casas', () => {
      component.ventasDelDia.set([]);
      component.movimientosDelDia.set([]);
      component.mermasDelDia.set([]);
      component.cuentasCosasDelDia.set([]);
      fixture.detectChanges();

      const allH4 = fixture.nativeElement.querySelectorAll('h4');
      const ccHeader = Array.from(allH4).find(
        (h) => (h as HTMLElement).textContent?.includes('Cuenta Casas del día'),
      );
      expect(ccHeader).toBeFalsy();
    });

    it('6.1 RED: debería resolver nombre de producto vía productosMap (fallback #id)', () => {
      const cuentasMock: CuentaCosa[] = [
        { id: 1, jornada_id: 1, producto_id: 99, cantidad: 1, descripcion: null, autorizado_por: 'María', created_at: '2026-06-04T08:00:00Z' },
      ];
      component.productosMap.set(new Map());
      component.cuentasCosasDelDia.set(cuentasMock);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('#99');
    });
  });
});

describe('UI guard — saldo insuficiente deshabilita botón', () => {
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
              totalEnCaja: 10000,
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

    it('3.1 RED: debería tener botón habilitado cuando saldo es suficiente para gasto', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(1000);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('3.1 RED: debería tener botón deshabilitado cuando saldo es insuficiente para gasto', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(50000); // > totalEnCaja(10000)
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('3.1 RED: debería tener botón deshabilitado con tooltip cuando saldo es insuficiente', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(50000); // > totalEnCaja(10000)
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.title).toContain('Saldo insuficiente');
    });

    it('3.1 RED: debería tener botón habilitado para ingreso_extra aunque saldo sea bajo', () => {
      component.tipo.set('ingreso_extra');
      component.descripcion.set('Test');
      component.monto.set(50000); // > totalEnCaja, pero ingreso_extra no egresa
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('3.1 RED: debería tener botón deshabilitado para compra_divisa con saldo insuficiente', () => {
      component.tipo.set('compra_divisa');
      component.montoDivisa.set(500);
      component.tasaCambio.set(120);
      // totalCup = 500 * 120 = 60000 > totalEnCaja(10000)
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.title).toContain('Saldo insuficiente');
    });

    it('3.1 RED: debería actualizar computed cuando cambia monto (reactividad)', () => {
      component.tipo.set('gasto');
      component.descripcion.set('Test');
      component.monto.set(1000);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);

      // Cambiar a monto insuficiente
      component.monto.set(50000);
      fixture.detectChanges();
      expect(btn.disabled).toBe(true);
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

  describe('responsive layout', () => {
    it('debería tener container con max-w-7xl', () => {
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.max-w-7xl');
      expect(container).toBeTruthy();
    });
  });
});
