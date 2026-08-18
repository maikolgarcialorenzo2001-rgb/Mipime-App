import { Component, computed, effect, inject, input, output, signal, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PesosPipe } from '../../pipes/pesos.pipe';
import { CobroPendienteService, type PendienteItem } from '../../services/cobro-pendiente.service';

/**
 * Modal de pendientes (decision AD-5/AD-7). Un único componente que soporta
 * dos modos:
 *  - cobrar: paso lista -> paso pago (formas Efectivo/Transferencia/Divisas
 *    habilitadas; Cuenta Casas y Pendiente deshabilitadas). Emite
 *    `cobroCompletado` al cobrar.
 *  - soloLectura (`soloLectura=true`): reusa el markup de lista, filas
 *    no-interactivas, sin opciones de pago ni confirmación. NUNCA emite
 *    `cobroCompletado`.
 * El cobro se registra vía CobroPendienteService (AD-1); la lista llega por
 * input `cobroPendiente` (POS la carga con `listarPendientes`).
 */
@Component({
  selector: 'app-cobro-pendiente-modal',
  imports: [PesosPipe, CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './cobro-pendiente-modal.component.html',
  styleUrl: './cobro-pendiente-modal.component.css',
})
export class CobroPendienteModalComponent {
  readonly cobroPendiente = input<PendienteItem[]>([]);
  readonly saldoEnCaja = input<number>(0);
  readonly soloLectura = input(false);
  readonly jornadaId = input(0);
  readonly usuarioId = input(0);

  readonly cobroCompletado = output();
  readonly cancelar = output();

  readonly backdrop = viewChild<ElementRef<HTMLElement>>('backdrop');

  constructor() {
    afterNextRender(() => {
      setTimeout(() => this.backdrop()?.nativeElement.focus());
    });
  }

  private readonly _service = inject(CobroPendienteService);

  readonly selectedId = signal<number | null>(null);
  readonly formaPago = signal<'efectivo' | 'transferencia' | 'divisas'>('efectivo');
  readonly divisaTipo = signal<'EUR' | 'USD'>('USD');
  readonly billeteRecibido = signal<number | null>(null);
  readonly tasaCambio = signal<number | null>(null);
  readonly completacionEfectivo = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Ids de filas con el detalle expandido (D1): `Set<number>` con mutación
   * inmutable (`new Set(...)`) para que el template reaccione. */
  readonly detallesAbiertos = signal<Set<number>>(new Set());

  /** Cuando el pago en divisa se vuelve suficiente, limpia la completación stale
   * (mismo patrón que checkout-modal; evita inflar saldo_esperado con
   * completacionEfectivo remanente). */
  private readonly _cleanupEffect = effect(() => {
    if (this.pagoSuficiente()) {
      this.completacionEfectivo.set(null);
    }
  });

  /** Reset defensivo (D2): el POS reemplaza la referencia del array en cada
   * recarga (`pendientes.set(pendientes)` con array nuevo); si una fila
   * expandida ya no existe, el estado quedaría stale. Al leer `cobroPendiente()`
   * el effect se re-ejecuta con cada recarga. El cierre del modal destruye el
   * componente (`@if` en pos.page.html), así que el reset es redundante ahí. */
  private readonly _resetDetallesEffect = effect(() => {
    this.cobroPendiente();
    this.detallesAbiertos.set(new Set());
  });

  readonly seleccionada = computed<PendienteItem | null>(() => {
    const id = this.selectedId();
    if (id == null) return null;
    return this.cobroPendiente().find((p) => p.id === id) ?? null;
  });

  readonly totalSeleccionado = computed<number>(
    () => this.seleccionada()?.total ?? 0,
  );

  /** Computeds de divisa reusados del checkout-modal (AD-5). */
  readonly vuelto = computed<number | null>(() => {
    const billete = this.billeteRecibido();
    const tasa = this.tasaCambio();
    const t = this.totalSeleccionado();
    if (billete == null || tasa == null || tasa <= 0 || billete <= 0) return null;
    return billete * tasa - t;
  });

  readonly pagoSuficiente = computed<boolean>(() => {
    const v = this.vuelto();
    return v != null && v >= 0;
  });

  readonly falta = computed<number | null>(() => {
    const v = this.vuelto();
    if (v == null || v >= 0) return null;
    return v * -1;
  });

  readonly errorCompletacion = computed<string | null>(() => {
    const falta = this.falta();
    const completacion = this.completacionEfectivo();
    if (falta == null) return null;
    if (completacion == null || completacion < falta) {
      return `Debe ingresar al menos $${falta.toLocaleString('es-AR')} para completar el pago`;
    }
    return null;
  });

  readonly estimadoDivisa = computed<number | null>(() => {
    const tasa = this.tasaCambio();
    const t = this.totalSeleccionado();
    if (tasa == null || tasa <= 0 || t <= 0) return null;
    return t / tasa;
  });

  readonly divisaValida = computed<boolean>(() => {
    const tasa = this.tasaCambio();
    const billete = this.billeteRecibido();
    return tasa != null && tasa > 0 && billete != null && billete > 0 &&
      (this.pagoSuficiente() ||
        (this.completacionEfectivo() != null && this.errorCompletacion() == null));
  });

  /** Efectivo y transferencia no requieren sub-form (solo divisas). */
  readonly formularioValido = computed<boolean>(() =>
    this.formaPago() === 'divisas' ? this.divisaValida() : true,
  );

  /** UI guard: divisas con vuelto > saldoEnCaja bloquea confirmar. */
  readonly saldoInsuficienteVuelto = computed<boolean>(() => {
    if (this.formaPago() !== 'divisas') return false;
    const v = this.vuelto();
    if (v == null || v <= 0) return false;
    return this.saldoEnCaja() < v;
  });

  readonly formularioValidoConSaldo = computed<boolean>(
    () => this.formularioValido() && !this.saldoInsuficienteVuelto(),
  );

  seleccionar(id: number): void {
    if (this.soloLectura()) return; // no-op en soloLectura (AD-7/AC10)
    this.selectedId.set(id);
    this.resetearSubFormDivisa();
  }

  /** Toggle expand/collapse del detalle de una fila (D1). Mutación inmutable:
   * siempre setea un `Set` nuevo para notificar al template. */
  toggleDetalle(id: number): void {
    const abiertos = new Set(this.detallesAbiertos());
    if (abiertos.has(id)) {
      abiertos.delete(id);
    } else {
      abiertos.add(id);
    }
    this.detallesAbiertos.set(abiertos);
  }

  /** True cuando la fila tiene algún detalle opcional (D4). `||` trata tanto
   * null como el string vacío como sin valor (spec REQ-3/REQ-4). */
  tieneDetalle(p: PendienteItem): boolean {
    return !!(p.autorizadoPor || p.descripcion);
  }

  seleccionarFormaPago(valor: 'efectivo' | 'transferencia' | 'divisas'): void {
    this.formaPago.set(valor);
    if (valor !== 'divisas') {
      this.completacionEfectivo.set(null);
    }
  }

  private resetearSubFormDivisa(): void {
    this.divisaTipo.set('USD');
    this.billeteRecibido.set(null);
    this.tasaCambio.set(null);
    this.completacionEfectivo.set(null);
  }

  async onConfirmar(): Promise<void> {
    if (this.soloLectura()) return;
    const sel = this.seleccionada();
    if (!sel || !this.formularioValidoConSaldo() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      await this._cobrar(sel.id);
      this.cobroCompletado.emit();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al registrar el cobro');
    } finally {
      this.loading.set(false);
    }
  }

  private async _cobrar(pendienteId: number): Promise<void> {
    const formaPago = this.formaPago();
    await this._service.registrarCobroPendiente(pendienteId, {
      jornadaId: this.jornadaId(),
      usuarioId: this.usuarioId(),
      formaPago,
      divisaTipo: formaPago === 'divisas' ? this.divisaTipo() : undefined,
      billeteRecibido: formaPago === 'divisas' ? this.billeteRecibido() ?? undefined : undefined,
      tasaCambio: formaPago === 'divisas' ? this.tasaCambio() ?? undefined : undefined,
      completacionEfectivo:
        formaPago === 'divisas' ? this.completacionEfectivo() ?? undefined : undefined,
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelar.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}