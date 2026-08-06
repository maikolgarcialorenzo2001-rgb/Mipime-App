import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CobroPendienteModalComponent } from './cobro-pendiente-modal.component';
import { CobroPendienteService } from '../../services/cobro-pendiente.service';
import type { PendienteItem } from '../../services/cobro-pendiente.service';

function pendienteItem(overrides: Partial<PendienteItem> = {}): PendienteItem {
  return {
    id: 1,
    compradorNombre: 'Carlos',
    fechaHora: '2026-08-05T10:00:00Z',
    total: 1000,
    jornadaId: 7,
    ...overrides,
  };
}

describe('CobroPendienteModalComponent', () => {
  let fixture: ComponentFixture<CobroPendienteModalComponent>;
  let component: CobroPendienteModalComponent;
  let mockService: {
    listarPendientes: ReturnType<typeof vi.fn>;
    registrarCobroPendiente: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      listarPendientes: vi.fn(),
      registrarCobroPendiente: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [CobroPendienteModalComponent],
      providers: [{ provide: CobroPendienteService, useValue: mockService }],
    });
    fixture = TestBed.createComponent(CobroPendienteModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('jornadaId', 7);
    fixture.componentRef.setInput('usuarioId', 2);
  });

  function listar(pendientes: PendienteItem[]): void {
    fixture.componentRef.setInput('cobroPendiente', pendientes);
    fixture.componentRef.setInput('saldoEnCaja', 1000);
    fixture.detectChanges();
  }

  function botones(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  // ─── 3.2 RED: estado vacío ─────────────────────────────────────────

  it('RED: lista vacía muestra estado vacío y no permite seleccionar', () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    listar([]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No hay pendientes sin cobrar');
    component.seleccionar(1);
    expect(component.seleccionada()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── 3.2 RED: render de la lista (comprador / fallback / fecha / monto) ──

  it('RED: lista muestra comprador, fecha y monto', () => {
    listar([pendienteItem({ id: 2, compradorNombre: 'Ana', total: 500 })]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ana');
    expect(el.textContent).toContain('2026-08-05');
    expect(el.textContent).toContain('500');
  });

  it('RED: comprador ausente muestra fallback Pendiente #id', () => {
    listar([pendienteItem({ id: 9, compradorNombre: null })]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Pendiente #9');
  });

  // ── 3.2 RED: flujo de cobro ─────────────────────────────────────────

  it('RED: seleccionar un pendiente muestra el monto completo a cobrar y la forma de pago', () => {
    listar([pendienteItem()]);
    component.seleccionar(1);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Total a cobrar');
    expect(el.textContent).toContain('Forma de pago');
    expect(el.textContent).toContain('Confirmar cobro');
  });

  it('RED: Efectivo/Transferencia/Divisas habilitadas; Cuenta Casas y Pendiente deshabilitadas', () => {
    listar([pendienteItem()]);
    component.seleccionar(1);
    fixture.detectChanges();

    const text = (b: HTMLButtonElement) => b.textContent?.trim() ?? '';
    const efectivo = botones().find((b) => text(b) === 'Efectivo');
    const transferencia = botones().find((b) => text(b) === 'Transferencia');
    const divisas = botones().find((b) => text(b) === 'Divisas');
    const cuenta = botones().find((b) => text(b).startsWith('Cuenta Casas'));
    const pendiente = botones().find((b) => text(b).startsWith('Pendiente'));

    expect(efectivo).toBeTruthy();
    expect(transferencia).toBeTruthy();
    expect(divisas).toBeTruthy();
    expect(efectivo!.disabled).toBe(false);
    expect(transferencia!.disabled).toBe(false);
    expect(divisas!.disabled).toBe(false);
    expect(cuenta!.disabled).toBe(true);
    expect(pendiente!.disabled).toBe(true);
  });

  it('RED: submit no se renderiza sin selección', () => {
    listar([pendienteItem()]);

    const confirm = botones().find((b) => b.textContent?.includes('Confirmar cobro'));
    expect(confirm).toBeUndefined();
  });

  it('RED: confirmar cobra vía servicio con pendienteId y forma de pago, y emite cobroCompletado', async () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    mockService.registrarCobroPendiente.mockResolvedValue({ id: 100 } as never);
    listar([pendienteItem({ id: 3, total: 800 })]);

    component.seleccionar(3);
    component['onConfirmar']();
    await fixture.whenStable();

    expect(mockService.registrarCobroPendiente).toHaveBeenCalledWith(3, {
      jornadaId: 7,
      usuarioId: 2,
      formaPago: 'efectivo',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RED: divisa con vuelto > saldoEnCaja deshabilita Confirmar y no cobra', async () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    listar([pendienteItem({ total: 850 })]);
    fixture.componentRef.setInput('saldoEnCaja', 100);
    component.seleccionar(1);
    component.seleccionarFormaPago('divisas');
    component.divisaTipo.set('USD');
    component.tasaCambio.set(700);
    component.billeteRecibido.set(2); // vuelto = 1400 - 850 = 550 > saldo 100
    fixture.detectChanges();

    expect(component.saldoInsuficienteVuelto()).toBe(true);
    const confirm = botones().find((b) => b.textContent?.includes('Confirmar cobro'));
    expect(confirm).toBeTruthy();
    expect(confirm!.disabled).toBe(true);

    component['onConfirmar']();
    await fixture.whenStable();
    expect(mockService.registrarCobroPendiente).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('RED: error del servicio se muestra y no emite cobroCompletado', async () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    mockService.registrarCobroPendiente.mockRejectedValue(new Error('Pendiente ya cobrado'));
    listar([pendienteItem()]);

    component.seleccionar(1);
    component['onConfirmar']();
    await fixture.whenStable();

    expect(component.error()).toContain('Pendiente ya cobrado');
    expect(spy).not.toHaveBeenCalled();
  });

  // ── 3.2 RED: modo solo lectura ──────────────────────────────────────

  it('RED: soloLectura renderiza filas sin selección, sin pago ni confirmar', () => {
    fixture.componentRef.setInput('soloLectura', true);
    listar([pendienteItem({ id: 4, compradorNombre: null })]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Pendiente #4');
    // no hay botones de forma de pago ni confirmar
    expect(el.textContent).not.toContain('Forma de pago');
    expect(el.textContent).not.toContain('Confirmar cobro');

    // seleccionar es no-op en soloLectura
    component.seleccionar(2);
    expect(component.seleccionada()).toBeNull();
  });

  it('RED: soloLectura con lista vacía — muestra estado vacío', () => {
    fixture.componentRef.setInput('soloLectura', true);
    listar([]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No hay pendientes sin cobrar');
    expect(el.textContent).not.toContain('Confirmar cobro');
  });

  it('RED: soloLectura nunca emite cobroCompletado', () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    fixture.componentRef.setInput('soloLectura', true);
    listar([pendienteItem()]);

    component['onConfirmar']();
    expect(spy).not.toHaveBeenCalled();
    expect(mockService.registrarCobroPendiente).not.toHaveBeenCalled();
  });

  // ── 3.2 RED: cancelar ───────────────────────────────────────────────

  it('RED: cancelar emite al hacer click en Cancelar', () => {
    const spy = vi.fn();
    component.cancelar.subscribe(spy);
    listar([pendienteItem()]);

    const cancelBtn = botones().find((b) => b.textContent?.includes('Cancelar'));
    cancelBtn!.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RED: Escape cierra el modal', () => {
    const spy = vi.fn();
    component.cancelar.subscribe(spy);
    listar([pendienteItem()]);

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});