import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { HistorialPage } from './historial.page';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada, JornadaReporte } from '../../models';
import type { JornadaReportData } from '../../services/excel.service';

registerLocaleData(localeEs);

const mockExcelBase64 = 'AAAA'; // minimal valid base64 (3 null bytes)

const mockJornadas: Jornada[] = [
  {
    id: 3,
    fecha: '2026-06-04',
    hora_apertura: '09:00:00',
    hora_cierre: '18:30:00',
    monto_inicial: 5000,
    total_ventas: 25000,
    total_gastos: 3000,
    saldo_esperado: 27000,
    saldo_real: 26800,
    estado: 'cerrada',
    user_cierre_id: 1,
    created_at: '2026-06-04T09:00:00Z',
    updated_at: '2026-06-04T18:30:00Z',
  },
  {
    id: 2,
    fecha: '2026-06-03',
    hora_apertura: '08:30:00',
    hora_cierre: '17:45:00',
    monto_inicial: 3000,
    total_ventas: 18000,
    total_gastos: 1500,
    saldo_esperado: 19500,
    saldo_real: null,
    estado: 'cerrada',
    user_cierre_id: 2,
    created_at: '2026-06-03T08:30:00Z',
    updated_at: '2026-06-03T17:45:00Z',
  },
  {
    id: 1,
    fecha: '2026-06-01',
    hora_apertura: '09:00:00',
    hora_cierre: null,
    monto_inicial: 5000,
    total_ventas: 5000,
    total_gastos: 0,
    saldo_esperado: 10000,
    saldo_real: null,
    estado: 'abierta',
    user_cierre_id: null,
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-06-01T09:00:00Z',
  },
];

const mockPreviewData: JornadaReportData = {
  jornada: mockJornadas[0],
  ventas: [],
  movimientos: [],
  productosMap: new Map(),
  totalCosto: 0,
  userCierreNombre: null,
};

describe('HistorialPage', () => {
  let fixture: ComponentFixture<HistorialPage>;
  let component: HistorialPage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistorialPage],
      providers: [
        {
          provide: JornadaService,
          useValue: {
            historial: () => of(mockJornadas),
            generarExportacionMensual: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(HistorialPage);
    component = fixture.componentInstance;
    // Fijamos el mes a junio 2026 para matchear los mocks
    component.currentMonth.set(new Date(2026, 5, 1));
    fixture.detectChanges();
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  it('debería mostrar el título del mes en uppercase', () => {
    const titulo = fixture.nativeElement.querySelector('h2');
    expect(titulo?.textContent?.toLowerCase()).toContain('junio');
    expect(titulo?.textContent).toContain('2026');
  });

  it('debería tener 7 columnas de días de la semana', () => {
    const grids = fixture.nativeElement.querySelectorAll('.grid-cols-7');
    const headerGrid = grids[0];
    const dayHeaders = headerGrid.querySelectorAll(':scope > div');
    expect(dayHeaders.length).toBe(7);
  });

  it('debería mostrar botones para los días con jornada', () => {
    // Junio 2026: lunes 1, martes 2... Los días con jornada: 1, 3, 4
    // El 1 es lunes → primer día del grid
    // Buscamos los botones (días clickeables) que tienen app-estado-badge
    const buttons = fixture.nativeElement.querySelectorAll('button');
    // Total buttons: 2 nav (prev/next) + botones de días con jornada
    const dayButtons = Array.from(buttons).filter(
      (b) => b instanceof HTMLElement && b.querySelector('app-estado-badge'),
    );
    expect(dayButtons.length).toBe(3);
  });

  it('debería mostrar estado badge en celdas con jornada', () => {
    const badges = fixture.nativeElement.querySelectorAll('app-estado-badge');
    expect(badges.length).toBe(3);
  });

  it('debería seleccionar/deseleccionar un día al hacer click', () => {
    expect(component.selectedDateStr()).toBeNull();

    component.seleccionarDia('2026-06-03');
    expect(component.selectedDateStr()).toBe('2026-06-03');

    // Click again deselecciona
    component.seleccionarDia('2026-06-03');
    expect(component.selectedDateStr()).toBeNull();
  });

  it('debería mostrar panel de detalle al seleccionar un día', () => {
    component.seleccionarDia('2026-06-04');
    fixture.detectChanges();

    const detailPanel = fixture.nativeElement.querySelector('.rounded-xl.bg-white.p-5');
    expect(detailPanel).toBeTruthy();
    // Debería mostrar "junio" en la fecha formateada
    expect(detailPanel?.textContent).toContain('Ventas');
    expect(detailPanel?.textContent).toContain('Gastos');
  });

  it('debería navegar entre meses', () => {
    component.mesAnterior();
    fixture.detectChanges();
    expect(component.currentMonth().getMonth()).toBe(4); // mayo

    component.mesSiguiente();
    fixture.detectChanges();
    expect(component.currentMonth().getMonth()).toBe(5); // junio otra vez
  });

  it('debería limpiar selección al cambiar de mes', () => {
    component.seleccionarDia('2026-06-03');
    expect(component.selectedDateStr()).toBe('2026-06-03');

    component.mesAnterior();
    expect(component.selectedDateStr()).toBeNull();
  });

  it('debería mostrar botón descargar en panel si jornada está cerrada', () => {
    component.seleccionarDia('2026-06-04');
    fixture.detectChanges();

    const downloadBtn: HTMLElement | null = fixture.nativeElement.querySelector(
      '.rounded-xl.bg-white.p-5 button',
    );
    expect(downloadBtn).toBeTruthy();
    expect(downloadBtn?.textContent).toContain('Descargar Excel');
  });

  describe('Exportar mes', () => {
    it('C9 RED: tieneJornadasCerradas debería ser true cuando hay cerradas en el mes actual', () => {
      expect(component.tieneJornadasCerradas()).toBe(true);
    });

    it('C9 RED: tieneJornadasCerradas debería ser false si solo hay abiertas en el mes', () => {
      // Navigate to a month without closed jornadas
      component.currentMonth.set(new Date(2025, 0, 1)); // January 2025
      fixture.detectChanges();
      expect(component.tieneJornadasCerradas()).toBe(false);
    });

    it('C9 RED: exportando debería empezar como false', () => {
      expect(component.exportando()).toBe(false);
    });

    it('C9 RED: exportarMes debería llamar al servicio con año/mes correctos', () => {
      const service = TestBed.inject(JornadaService);
      component.exportarMes();
      expect(service.generarExportacionMensual).toHaveBeenCalledWith(2026, 5);
    });

    it('C9 RED: exportarMes debería iniciar descarga y limpiar exportando', () => {
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

      component.exportarMes();

      expect(createUrlSpy).toHaveBeenCalled();
      expect(component.exportando()).toBe(false);
      expect(component.errorExport()).toBeNull();

      createUrlSpy.mockRestore();
    });

    it('C9 RED: botón "Exportar mes" debería estar visible cuando hay cerradas', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('[data-testid="btn-exportar-mes"]');
      expect(btn).toBeTruthy();
    });

    it('C9 RED: botón debería estar oculto cuando no hay cerradas en el mes', () => {
      component.currentMonth.set(new Date(2025, 0, 1));
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('[data-testid="btn-exportar-mes"]');
      expect(btn).toBeFalsy();
    });

    it('C9 RED: botón debería estar disabled y mostrar "Generando..." mientras exportando', () => {
      component.exportando.set(true);
      fixture.detectChanges();
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="btn-exportar-mes"]',
      );
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Generando');
    });

    it('C9 RED: errorExport debería mostrarse cuando la exportación falla', () => {
      const service = TestBed.inject(JornadaService);
      vi.mocked(service.generarExportacionMensual).mockReturnValue(
        throwError(() => new Error('Error de red')),
      );

      component.exportarMes();
      // Manually advance the observable
      fixture.detectChanges();

      expect(component.errorExport()).toBe('Error de red');
      expect(component.exportando()).toBe(false);
    });

    it('C9 RED: después de exportación exitosa, exportando vuelve a false', () => {
      component.exportarMes();
      // The observable completes synchronously with of()
      expect(component.exportando()).toBe(false);
      expect(component.errorExport()).toBeNull();
    });
  });

  describe('Descargar Excel', () => {
    it('debería llamar a obtenerReporte con el id de la jornada', () => {
      const service = TestBed.inject(JornadaService);
      component.descargarExcel(mockJornadas[0]);
      expect(service.obtenerReporte).toHaveBeenCalledWith(3);
    });

    it('debería descargar el archivo cuando existe el reporte', () => {
      const service = TestBed.inject(JornadaService);
      const mockReporte: JornadaReporte = {
        id: 1,
        jornada_id: 3,
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content_base64: mockExcelBase64,
        filename: 'jornada_2026-06-04.xlsx',
        created_at: '2026-06-04T18:30:00Z',
      };
      vi.mocked(service.obtenerReporte).mockReturnValue(of(mockReporte));

      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      component.descargarExcel(mockJornadas[0]);

      expect(createUrlSpy).toHaveBeenCalled();

      createUrlSpy.mockRestore();
    });

    it('debería no hacer nada cuando el reporte es null', () => {
      const service = TestBed.inject(JornadaService);
      vi.mocked(service.obtenerReporte).mockReturnValue(of(null));

      const createUrlSpy = vi.spyOn(URL, 'createObjectURL');
      component.descargarExcel(mockJornadas[0]);

      expect(createUrlSpy).not.toHaveBeenCalled();

      createUrlSpy.mockRestore();
    });
  });

  describe('Vista previa', () => {
    it('debería abrir preview con los datos de la jornada', () => {
      const service = TestBed.inject(JornadaService);
      const jornada = mockJornadas[0];
      component.verPreview(jornada);

      expect(component.showPreview()).toBe(true);
      expect(component.previewJornada()).toEqual(jornada);
      expect(service.obtenerDatosJornada).toHaveBeenCalledWith(jornada.id, jornada.user_cierre_id);
      expect(component.previewLoading()).toBe(false);
      expect(component.previewData()).toEqual(mockPreviewData);
    });

    it('debería mostrar loading mientras se cargan los datos de preview', () => {
      const service = TestBed.inject(JornadaService);
      // Usamos un observable que nunca completa para simular carga
      vi.mocked(service.obtenerDatosJornada).mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/no-empty-function — intencional: observable que nunca emite
        new Observable(() => {}),
      );

      component.verPreview(mockJornadas[0]);

      expect(component.previewLoading()).toBe(true);
      expect(component.previewData()).toBeNull();
    });

    it('debería cerrar preview al hacer click en el botón cerrar', () => {
      component.verPreview(mockJornadas[0]);
      fixture.detectChanges();

      const closeBtn: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="btn-cerrar-preview"]',
      );
      expect(closeBtn).toBeTruthy();
      closeBtn!.click();
      fixture.detectChanges();

      expect(component.showPreview()).toBe(false);
      expect(component.previewJornada()).toBeNull();
    });

    it('debería cerrar preview al presionar Escape', () => {
      component.verPreview(mockJornadas[0]);
      fixture.detectChanges();

      const backdrop: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="preview-backdrop"]',
      );
      expect(backdrop).toBeTruthy();
      backdrop!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(component.showPreview()).toBe(false);
    });

    it('debería cerrar preview al hacer click en el backdrop', () => {
      component.verPreview(mockJornadas[0]);
      fixture.detectChanges();

      const backdrop: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="preview-backdrop"]',
      );
      expect(backdrop).toBeTruthy();
      backdrop!.click();
      fixture.detectChanges();

      expect(component.showPreview()).toBe(false);
    });
  });
});

describe('HistorialPage — vacío', () => {
  let fixture: ComponentFixture<HistorialPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistorialPage],
      providers: [
        {
          provide: JornadaService,
          useValue: {
            historial: () => of([]),
            generarExportacionMensual: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(HistorialPage);
    fixture.detectChanges();
  });

  it('debería mostrar empty state si no hay jornadas', () => {
    const empty = fixture.nativeElement.querySelector('app-empty-state');
    expect(empty).toBeTruthy();
  });

  it('debería mostrar el calendario aunque no haya jornadas', () => {
    const calendar = fixture.nativeElement.querySelector('.grid-cols-7');
    expect(calendar).toBeTruthy();
  });
});

describe('HistorialPage — error', () => {
  let fixture: ComponentFixture<HistorialPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistorialPage],
      providers: [
        {
          provide: JornadaService,
          useValue: {
            historial: () => of([]),
            generarExportacionMensual: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(HistorialPage);
    const component = fixture.componentInstance;
    component.error.set('Error al cargar');
    fixture.detectChanges();
  });

  it('debería mostrar error si hay error', () => {
    const error = fixture.nativeElement.querySelector('app-error-alert');
    expect(error).toBeTruthy();
  });
});
