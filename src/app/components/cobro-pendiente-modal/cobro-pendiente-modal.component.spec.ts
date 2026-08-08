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

  function botonVerDetalles(): HTMLButtonElement | undefined {
    return botones().find((b) => b.textContent?.includes('Ver detalles'));
  }

  // ── RED: detalles opcionales — botón "Ver detalles" (REQ-2..REQ-5, D2/D3) ──

  it('RED: "Ver detalles" expande y colapsa el bloque con ambos campos (REQ-2/REQ-3)', () => {
    listar([
      pendienteItem({ id: 1, autorizadoPor: 'María', descripcion: 'Se lo lleva en cuenta' }),
    ]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    expect(btn!.getAttribute('aria-expanded')).toBe('false');

    btn!.click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Autorizado por:');
    expect(el.textContent).toContain('María');
    expect(el.textContent).toContain('Descripción:');
    expect(el.textContent).toContain('Se lo lleva en cuenta');
    expect(btn!.getAttribute('aria-expanded')).toBe('true');

    // segundo click → colapsa
    btn!.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Se lo lleva en cuenta');
    expect(btn!.getAttribute('aria-expanded')).toBe('false');
  });

  it('RED: solo autorizadoPor con valor no renderiza la label "Descripción" (REQ-3)', () => {
    listar([pendienteItem({ id: 1, autorizadoPor: 'María' })]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Autorizado por:');
    expect(el.textContent).not.toContain('Descripción:');
  });

  it('RED: solo descripcion con valor no renderiza la label "Autorizado por" (REQ-3)', () => {
    listar([pendienteItem({ id: 1, descripcion: 'Nota de prueba' })]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Descripción:');
    expect(el.textContent).toContain('Nota de prueba');
    expect(el.textContent).not.toContain('Autorizado por:');
  });

  it('RED: fila con detalles muestra botón, fila sin detalles no (REQ-4)', () => {
    listar([
      pendienteItem({ id: 1, autorizadoPor: 'María' }),
      pendienteItem({ id: 2, autorizadoPor: null, descripcion: null }),
    ]);

    // contraste: 1 botón por la fila con detalles; la histórica no lo tiene
    const botonesDetalle = botones().filter((b) => b.textContent?.includes('Ver detalles'));
    expect(botonesDetalle).toHaveLength(1);
    // sin bloque vacío renderizado
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Autorizado por:');
  });

  it('RED: campos con string vacío se tratan como sin valor (REQ-4 extensión)', () => {
    listar([
      pendienteItem({ id: 1, descripcion: 'Nota' }),
      pendienteItem({ id: 2, autorizadoPor: '', descripcion: '' }),
    ]);

    const botonesDetalle = botones().filter((b) => b.textContent?.includes('Ver detalles'));
    expect(botonesDetalle).toHaveLength(1); // la fila 2 (strings vacíos) NO tiene botón
  });

  it('RED: caso mixto — autorizadoPor vacío + descripcion con valor muestra botón (REQ-3)', () => {
    listar([
      pendienteItem({ id: 1, autorizadoPor: '', descripcion: 'Nota' }),
    ]);

    const botonesDetalle = botones().filter((b) => b.textContent?.includes('Ver detalles'));
    expect(botonesDetalle).toHaveLength(1); // descripcion tiene valor real -> botón presente
  });

  it('RED: soloLectura opera el toggle de detalles sin emitir cobroCompletado (REQ-5)', () => {
    const spy = vi.fn();
    component.cobroCompletado.subscribe(spy);
    fixture.componentRef.setInput('soloLectura', true);
    listar([pendienteItem({ id: 1, autorizadoPor: 'María', descripcion: 'Nota' })]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Autorizado por:');

    btn!.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Autorizado por:');

    expect(spy).not.toHaveBeenCalled();
    expect(component.seleccionada()).toBeNull();
  });

  it('RED: en modo cobrar, el click en "Ver detalles" no selecciona la fila (D3)', () => {
    listar([pendienteItem({ id: 1, autorizadoPor: 'María' })]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();

    expect(component.selectedId()).toBeNull();
    expect(component.seleccionada()).toBeNull();
    // el toggle igual corrió: el bloque quedó abierto
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Autorizado por:');
  });

  it('RED: al recargar la lista (nueva referencia), las expansiones se resetean (D2)', () => {
    listar([pendienteItem({ id: 1, autorizadoPor: 'María' })]);

    const btn = botonVerDetalles();
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Autorizado por:');

    // recarga: el POS hace pendientes.set(pendientes) con un array NUEVO
    fixture.componentRef.setInput('cobroPendiente', [
      pendienteItem({ id: 1, autorizadoPor: 'María' }),
    ]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Autorizado por:');
    expect(botonVerDetalles()!.getAttribute('aria-expanded')).toBe('false');
  });

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

  it('RED: divisa que pasa a pagoSuficiente limpia la completación stale (AC6)', async () => {
    listar([pendienteItem({ total: 1000 })]);
    component.seleccionar(1);
    component.seleccionarFormaPago('divisas');
    component.tasaCambio.set(700);
    component.billeteRecibido.set(1); // 700 < 1000 → falta 300
    component.completacionEfectivo.set(300);
    fixture.detectChanges();

    expect(component.pagoSuficiente()).toBe(false);
    expect(component.completacionEfectivo()).toBe(300);

    // El cliente sube el billete: ahora 1400 >= 1000 → el pago es suficiente.
    component.billeteRecibido.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.pagoSuficiente()).toBe(true);
    expect(component.completacionEfectivo()).toBeNull();
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