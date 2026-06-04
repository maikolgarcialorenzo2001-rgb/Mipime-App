import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HistorialPage } from './historial.page';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada } from '../../models';

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
    fecha: '2026-06-04',
    hora_apertura: '09:00:00',
    hora_cierre: null,
    monto_inicial: 5000,
    total_ventas: 5000,
    total_gastos: 0,
    saldo_esperado: 10000,
    saldo_real: null,
    estado: 'abierta',
    user_cierre_id: null,
    created_at: '2026-06-04T09:00:00Z',
    updated_at: '2026-06-04T09:00:00Z',
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
    fixture.detectChanges();
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  it('debería mostrar todas las jornadas en la tabla', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('debería mostrar el estado con app-estado-badge', () => {
    const badges = fixture.nativeElement.querySelectorAll('app-estado-badge');
    expect(badges.length).toBe(3);
  });

  it('debería mostrar las fechas correctamente', () => {
    const cells = fixture.nativeElement.querySelectorAll('tbody tr td:first-child');
    expect(cells[0].textContent?.trim()).toBe('2026-06-04');
    expect(cells[1].textContent?.trim()).toBe('2026-06-03');
  });

  it('debería mostrar "—" si no hay hora de cierre', () => {
    const cierreCells = fixture.nativeElement.querySelectorAll('tbody tr td:nth-child(3)');
    expect(cierreCells[2].textContent?.trim()).toBe('—');
  });

  it('debería mostrar "—" si no hay saldo real', () => {
    const saldoCells = fixture.nativeElement.querySelectorAll('tbody tr td:nth-child(7)');
    expect(saldoCells[1].textContent?.trim()).toBe('—');
  });

  it('debería tener botón Excel deshabilitado para jornada abierta', () => {
    const buttons = fixture.nativeElement.querySelectorAll('tbody tr:last-child button');
    buttons.forEach((btn: HTMLButtonElement) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('debería tener botones habilitados para jornada cerrada', () => {
    const firstRowButtons = fixture.nativeElement.querySelectorAll('tbody tr:first-child button');
    firstRowButtons.forEach((btn: HTMLButtonElement) => {
      expect(btn.disabled).toBe(false);
    });
  });
});

describe('HistorialPage — vacío', () => {
  let fixture: ComponentFixture<HistorialPage>;
  let component: HistorialPage;

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
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería mostrar empty state si no hay jornadas', () => {
    const empty = fixture.nativeElement.querySelector('app-empty-state');
    expect(empty).toBeTruthy();
  });

  it('no debería mostrar la tabla si no hay jornadas', () => {
    const table = fixture.nativeElement.querySelector('table');
    expect(table).toBeFalsy();
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
