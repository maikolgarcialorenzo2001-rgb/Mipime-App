import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { HistorialPage } from './historial.page';
import { ElectronFileService } from '../../services/electron-file.service';
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
    total_movimientos: 3000,
    saldo_esperado: 27000,
    saldo_real: 26800,
    estado: 'cerrada',
    user_cierre_id: 1,
    user_apertura_id: null,
    total_merma: 0,
    created_at: '2026-06-04T09:00:00Z',
    updated_at: '2026-06-04T18:30:00Z',
  },
  {
    id: 4,
    fecha: '2026-06-04',
    hora_apertura: '14:00:00',
    hora_cierre: '22:30:00',
    monto_inicial: 3000,
    total_ventas: 15000,
    total_movimientos: 1000,
    saldo_esperado: 17000,
    saldo_real: 16900,
    estado: 'cerrada',
    user_cierre_id: 2,
    user_apertura_id: null,
    total_merma: 0,
    created_at: '2026-06-04T14:00:00Z',
    updated_at: '2026-06-04T22:30:00Z',
  },
  {
    id: 2,
    fecha: '2026-06-03',
    hora_apertura: '08:30:00',
    hora_cierre: '17:45:00',
    monto_inicial: 3000,
    total_ventas: 18000,
    total_movimientos: 1500,
    saldo_esperado: 19500,
    saldo_real: null,
    estado: 'cerrada',
    user_cierre_id: 2,
    user_apertura_id: null,
    total_merma: 0,
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
    total_movimientos: 0,
    saldo_esperado: 10000,
    saldo_real: null,
    estado: 'abierta',
    user_cierre_id: null,
    user_apertura_id: null,
    total_merma: 0,
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
            generarExportacionPorRango: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
        {
          provide: ElectronFileService,
          useValue: {
            isElectronPackaged: false,
            saveIndividual: vi.fn().mockResolvedValue(undefined),
            saveMonthly: vi.fn().mockResolvedValue(undefined),
            saveRange: vi.fn().mockResolvedValue(undefined),
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
    // 3 unique days with jornadas (Jun 1, Jun 3, Jun 4)
    expect(dayButtons.length).toBe(3);
  });

  it('debería mostrar estado badge en celdas con jornada — ahora 4 badges (2 en Jun 4 + 1 Jun 3 + 1 Jun 1)', () => {
    const badges = fixture.nativeElement.querySelectorAll('app-estado-badge');
    // 2 badges on Jun 4 + 1 on Jun 3 + 1 on Jun 1 = 4
    expect(badges.length).toBe(4);
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
      const electronService = TestBed.inject(ElectronFileService) as unknown as { saveMonthly: ReturnType<typeof vi.fn> };

      component.exportarMes();

      expect(electronService.saveMonthly).toHaveBeenCalled();
      expect(component.exportando()).toBe(false);
      expect(component.errorExport()).toBeNull();
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
      const electronService = TestBed.inject(ElectronFileService) as unknown as { saveIndividual: ReturnType<typeof vi.fn> };
      const mockReporte: JornadaReporte = {
        id: 1,
        jornada_id: 3,
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content_base64: mockExcelBase64,
        filename: 'jornada_2026-06-04.xlsx',
        created_at: '2026-06-04T18:30:00Z',
      };
      vi.mocked(service.obtenerReporte).mockReturnValue(of(mockReporte));

      component.descargarExcel(mockJornadas[0]);

      expect(electronService.saveIndividual).toHaveBeenCalledWith(
        mockExcelBase64,
        mockJornadas[0],
      );
    });

    it('debería no hacer nada cuando el reporte es null', () => {
      const service = TestBed.inject(JornadaService);
      const electronService = TestBed.inject(ElectronFileService) as unknown as { saveIndividual: ReturnType<typeof vi.fn> };
      vi.mocked(service.obtenerReporte).mockReturnValue(of(null));

      component.descargarExcel(mockJornadas[0]);

      expect(electronService.saveIndividual).not.toHaveBeenCalled();
    });

    describe('Electron auto-save', () => {
      let electronService: {
        isElectronPackaged: boolean;
        saveIndividual: ReturnType<typeof vi.fn>;
        saveMonthly: ReturnType<typeof vi.fn>;
        saveRange: ReturnType<typeof vi.fn>;
      };

      beforeEach(() => {
        electronService = TestBed.inject(ElectronFileService) as unknown as typeof electronService;
      });

      it('descargarExcel debería llamar saveIndividual cuando isElectronPackaged=true', () => {
        electronService.isElectronPackaged = true;
        const service = TestBed.inject(JornadaService);
        vi.mocked(service.obtenerReporte).mockReturnValue(of({
          id: 1,
          jornada_id: 3,
          content_type: 'excel',
          content_base64: mockExcelBase64,
          filename: 'jornada_test.xlsx',
          created_at: '',
        }));

        component.descargarExcel(mockJornadas[0]);

        expect(electronService.saveIndividual).toHaveBeenCalledWith(
          mockExcelBase64,
          mockJornadas[0],
        );
      });

      it('exportarMes debería llamar saveMonthly cuando isElectronPackaged=true', () => {
        electronService.isElectronPackaged = true;

        component.exportarMes();

        expect(electronService.saveMonthly).toHaveBeenCalledWith(
          mockExcelBase64,
          2026,
          5, // Junio (0-indexed)
        );
      });

      it('exportarRango debería llamar saveRange cuando isElectronPackaged=true', () => {
        electronService.isElectronPackaged = true;
        component.rangeDesde.set('2026-06-01');
        component.rangeHasta.set('2026-06-30');

        component.exportarRango();

        expect(electronService.saveRange).toHaveBeenCalledWith(
          mockExcelBase64,
          '2026-06-01',
          '2026-06-30',
        );
      });

      it('descargarExcel debería llamar saveIndividual incluso cuando isElectronPackaged=false (service internamente hace Blob)', () => {
        electronService.isElectronPackaged = false;
        const service = TestBed.inject(JornadaService);
        vi.mocked(service.obtenerReporte).mockReturnValue(of({
          id: 1,
          jornada_id: 3,
          content_type: 'excel',
          content_base64: mockExcelBase64,
          filename: 'jornada_test.xlsx',
          created_at: '',
        }));

        component.descargarExcel(mockJornadas[0]);

        expect(electronService.saveIndividual).toHaveBeenCalled();
      });
    });
  });

  describe('Multi-jornada (Feature A)', () => {
    it('A.1 RED: _jornadasPorFecha debería agrupar múltiples jornadas de la misma fecha', () => {
      // Arrange: 2 jornadas on 2026-06-04 (mockJornadas[0] and mockJornadas[1])
      const map = (component as unknown as { _jornadasPorFecha: () => Map<string, Jornada[]> })._jornadasPorFecha();
      const arr = map.get('2026-06-04');
      expect(arr).toBeDefined();
      expect(arr.length).toBe(2);
      expect(arr[0].id).toBe(3);
      expect(arr[1].id).toBe(4);
    });

    it('A.1 RED: _jornadasPorFecha debería tener jornadas únicas para fechas sin duplicados', () => {
      const map = (component as unknown as { _jornadasPorFecha: () => Map<string, Jornada[]> })._jornadasPorFecha();
      expect(map.get('2026-06-03')!.length).toBe(1);
      expect(map.get('2026-06-01')!.length).toBe(1);
    });

    it('A.2 RED: diaSeleccionado debería retornar array de jornadas cuando hay múltiples', () => {
      component.seleccionarDia('2026-06-04');
      fixture.detectChanges();

      const sel = component.diaSeleccionado();
      expect(sel).not.toBeNull();
      expect(sel!.fecha).toBe('2026-06-04');
      expect(sel!.jornadas.length).toBe(2);
    });

    it('A.2 RED: diaSeleccionado debería retornar array vacío cuando no hay jornada', () => {
      component.seleccionarDia('2026-06-02');
      fixture.detectChanges();

      const sel = component.diaSeleccionado();
      expect(sel).not.toBeNull();
      expect(sel!.jornadas).toEqual([]);
    });

    it('A.3 RED: calendario debería mostrar 4 badges (2 en el día 4, 1 en el 3, 1 en el 1)', () => {
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('app-estado-badge');
      // 2 badges on junio 4 (id=3, id=4) + 1 badge on junio 3 + 1 badge on junio 1 = 4
      expect(badges.length).toBe(4);
    });

    it('A.2 RED: panel de detalle debería mostrar 2 tarjetas cuando hay 2 jornadas', () => {
      component.seleccionarDia('2026-06-04');
      fixture.detectChanges();

      // Each jornada card is a div inside the detail panel with its own Descargar Excel button
      const downloadButtons = fixture.nativeElement.querySelectorAll(
        '.rounded-xl.bg-white.p-5 button',
      );
      // There should be at least 2 buttons (one per jornada card)
      // Filter: find buttons containing "Descargar Excel"
      const excelBtns = Array.from(downloadButtons).filter(
        (b) => b instanceof HTMLElement && b.textContent?.includes('Descargar Excel'),
      );
      // 2 jornadas on Jun 4 → 2 Descargar Excel buttons (one per jornada card)
      expect(excelBtns.length).toBe(2);
    });

    it('A.2 RED: panel de detalle con fecha sin jornada muestra mensaje vacío', () => {
      component.seleccionarDia('2026-06-02');
      fixture.detectChanges();

      const detailPanel: HTMLElement | null = fixture.nativeElement.querySelector('.rounded-xl.bg-white.p-5');
      expect(detailPanel).toBeTruthy();
      expect(detailPanel?.textContent).toContain('No hay jornada registrada');
    });
  });

  describe('Exportar rango (Feature D)', () => {
    it('D.1 RED: showRangePicker debería empezar como false', () => {
      expect(component.showRangePicker()).toBe(false);
    });

    it('D.1 RED: toggleRangePicker debería cambiar showRangePicker', () => {
      component.toggleRangePicker();
      fixture.detectChanges();
      expect(component.showRangePicker()).toBe(true);

      component.toggleRangePicker();
      expect(component.showRangePicker()).toBe(false);
    });

    it('D.2 RED: exportarRango debería llamar al servicio con fechas correctas', () => {
      const service = TestBed.inject(JornadaService);
      component.rangeDesde.set('2026-06-01');
      component.rangeHasta.set('2026-06-15');
      component.exportarRango();

      expect(service.generarExportacionPorRango).toHaveBeenCalledWith('2026-06-01', '2026-06-15');
    });

    it('D.2 RED: exportarRango debería mostrar error si faltan fechas', () => {
      component.rangeDesde.set('');
      component.rangeHasta.set('2026-06-15');
      component.exportarRango();

      expect(component.errorExport()).toBe('Seleccioná fecha desde y hasta para exportar.');
    });

    it('D.2 RED: exportarRango debería limpiar error al completar', () => {
      component.errorExport.set('error previo');
      component.rangeDesde.set('2026-06-01');
      component.rangeHasta.set('2026-06-15');
      component.exportarRango();

      expect(component.errorExport()).toBeNull();
    });

    it('D.2 RED: exportarRango debería manejar error del servicio', () => {
      const service = TestBed.inject(JornadaService);
      vi.mocked(service.generarExportacionPorRango).mockReturnValue(
        throwError(() => new Error('Error al exportar')),
      );

      component.rangeDesde.set('2026-06-01');
      component.rangeHasta.set('2026-06-15');
      component.exportarRango();

      expect(component.errorExport()).toBe('Error al exportar');
      expect(component.exportandoRango()).toBe(false);
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
        // intencional: observable que nunca emite
      // eslint-disable-next-line @typescript-eslint/no-empty-function
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

    it('4.5 RED: venta sin detalles (cobro de pendiente) aparece como fila "Cobrar Pendiente #id"', () => {
      const dataConCobro: JornadaReportData = {
        ...mockPreviewData,
        ventas: [
          {
            id: 100,
            jornada_id: 3,
            fecha_hora: '2026-06-04T16:00:00',
            total: 2000,
            usuario_id: 1,
            forma_pago: 'efectivo',
            cobro_de_venta_id: 42,
            created_at: '2026-06-04T16:00:00Z',
            detalles: [],
          },
        ],
      };
      vi.mocked(TestBed.inject(JornadaService).obtenerDatosJornada).mockReturnValue(
        of(dataConCobro),
      );
      component.verPreview(mockJornadas[0]);

      expect(component.previewDetalles()).toEqual([
        {
          producto: 'Cobrar Pendiente #42',
          cantidad: 1,
          precioUnitario: 2000,
          precioBase: null,
          total: 2000,
          formaPago: 'efectivo',
        },
      ]);
    });

    it('4.5 RED: en jornada mixta, el cobro suma su fila a las ventas con detalle', () => {
      const dataMixta: JornadaReportData = {
        ...mockPreviewData,
        productosMap: new Map([[1, { nombre: 'Producto X', precio_costo: 500 }]]),
        ventas: [
          {
            id: 10,
            jornada_id: 3,
            fecha_hora: '2026-06-04T10:00:00',
            total: 3000,
            usuario_id: 1,
            forma_pago: 'efectivo',
            created_at: '',
            detalles: [
              { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 1500, subtotal: 3000 },
            ],
          },
          {
            id: 100,
            jornada_id: 3,
            fecha_hora: '2026-06-04T16:00:00',
            total: 2000,
            usuario_id: 1,
            forma_pago: 'transferencia',
            cobro_de_venta_id: 42,
            created_at: '',
            detalles: [],
          },
        ],
      };
      vi.mocked(TestBed.inject(JornadaService).obtenerDatosJornada).mockReturnValue(
        of(dataMixta),
      );
      component.verPreview(mockJornadas[0]);

      const rows = component.previewDetalles();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        producto: 'Producto X',
        cantidad: 2,
        precioUnitario: 1500,
        precioBase: 500,
        total: 3000,
        formaPago: 'efectivo',
      });
      expect(rows[1]).toMatchObject({
        producto: 'Cobrar Pendiente #42',
        total: 2000,
        formaPago: 'transferencia',
      });
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
            generarExportacionPorRango: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
        {
          provide: ElectronFileService,
          useValue: {
            isElectronPackaged: false,
            saveIndividual: vi.fn().mockResolvedValue(undefined),
            saveMonthly: vi.fn().mockResolvedValue(undefined),
            saveRange: vi.fn().mockResolvedValue(undefined),
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
            generarExportacionPorRango: vi.fn().mockReturnValue(of(mockExcelBase64)),
            obtenerReporte: vi.fn().mockReturnValue(of(null)),
            obtenerDatosJornada: vi.fn().mockReturnValue(of(mockPreviewData)),
          },
        },
        {
          provide: ElectronFileService,
          useValue: {
            isElectronPackaged: false,
            saveIndividual: vi.fn().mockResolvedValue(undefined),
            saveMonthly: vi.fn().mockResolvedValue(undefined),
            saveRange: vi.fn().mockResolvedValue(undefined),
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
