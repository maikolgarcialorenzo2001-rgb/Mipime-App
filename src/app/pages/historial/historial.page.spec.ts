import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { HistorialPage } from './historial.page';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada } from '../../models';

registerLocaleData(localeEs);

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
