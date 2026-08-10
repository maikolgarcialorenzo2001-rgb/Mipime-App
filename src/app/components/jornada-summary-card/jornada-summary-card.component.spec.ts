import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JornadaSummaryCardComponent } from './jornada-summary-card.component';
import type { Jornada } from '../../models';

function jornadaDe(overrides: Partial<Jornada> = {}): Jornada {
  return {
    id: 1,
    fecha: '2026-08-10',
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
    created_at: '2026-08-10T09:00:00Z',
    updated_at: '2026-08-10T09:00:00Z',
    ...overrides,
  };
}

describe('JornadaSummaryCardComponent', () => {
  let fixture: ComponentFixture<JornadaSummaryCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JornadaSummaryCardComponent],
    });
    fixture = TestBed.createComponent(JornadaSummaryCardComponent);
  });

  it('se crea correctamente', () => {
    fixture.componentRef.setInput('jornada', jornadaDe());
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra "Saldo en caja" con el totalEnCaja recalculado, no con saldo_esperado', () => {
    // Regression fix-cierre-jornada-calculos: la tarjeta debe mostrar el saldo en caja
    // crudo recalculado (como cierre y Excel), no la columna saldo_esperado que descuenta merma.
    const jornada = jornadaDe({ saldo_esperado: 18000, total_merma: 500 });
    fixture.componentRef.setInput('jornada', jornada);
    fixture.componentRef.setInput('totalEnCaja', 17500);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('$17500');
    expect(fixture.nativeElement.textContent).not.toContain('$18000');
  });

  it('muestra $0 cuando totalEnCaja no está disponible', () => {
    fixture.componentRef.setInput('jornada', jornadaDe());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('$0');
  });
});
