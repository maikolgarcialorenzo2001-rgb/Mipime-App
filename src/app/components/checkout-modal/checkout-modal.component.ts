import { Component, computed, input, output, signal, effect } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { CartItem } from '../../services/cart.service';

export interface CheckoutPayload {
  formaPago: string;
  divisaTipo?: 'EUR' | 'USD';
  billeteRecibido?: number;
  tasaCambio?: number;
  completacionEfectivo?: number;
  compradorNombre?: string;
  autorizadoPor?: string;
  descripcion?: string;
}

@Component({
  selector: 'app-checkout-modal',
  imports: [PesosPipe, CurrencyPipe, FormsModule],
  templateUrl: './checkout-modal.component.html',
  styleUrl: './checkout-modal.component.css',
})
export class CheckoutModalComponent {
  readonly items = input.required<CartItem[]>();
  readonly total = input.required<number>();
  readonly errorMessage = input<string | null>(null);
  readonly saldoEnCaja = input<number>(0);
  readonly confirmar = output<CheckoutPayload>();
  readonly cancelar = output();

  readonly formaPago = signal<string>('efectivo');

  // Divisas sub-form
  readonly divisaTipo = signal<'EUR' | 'USD'>('USD');
  readonly billeteRecibido = signal<number | null>(null);
  readonly tasaCambio = signal<number | null>(null);
  readonly completacionEfectivo = signal<number | null>(null);

  /** Cuando el pago en divisa se vuelve suficiente, limpia la completación */
  private readonly _cleanupEffect = effect(() => {
    if (this.pagoSuficiente()) {
      this.completacionEfectivo.set(null);
    }
  });
  readonly vuelto = computed<number | null>(() => {
    const billete = this.billeteRecibido();
    const tasa = this.tasaCambio();
    const t = this.total();
    if (billete == null || tasa == null || tasa <= 0 || billete <= 0) return null;
    return billete * tasa - t;
  });

  /** Cuánto falta para cubrir el total (solo si vuelto < 0) */
  readonly falta = computed<number | null>(() => {
    const v = this.vuelto();
    if (v == null || v >= 0) return null;
    return v * -1;
  });

  /** True si el pago en divisa es suficiente (billete × tasa >= total) */
  readonly pagoSuficiente = computed<boolean>(() => {
    const v = this.vuelto();
    return v != null && v >= 0;
  });

  /** Error si completacionEfectivo < falta */
  readonly errorCompletacion = computed<string | null>(() => {
    const falta = this.falta();
    const completacion = this.completacionEfectivo();
    if (falta == null) return null;
    if (completacion == null || completacion < falta) {
      return `Debe ingresar al menos $${falta.toLocaleString('es-AR')} para completar el pago`;
    }
    return null;
  });

  /** Estimado de divisa a pagar: total / tasa → feedback visual */
  readonly estimadoDivisa = computed<number | null>(() => {
    const tasa = this.tasaCambio();
    const t = this.total();
    if (tasa == null || tasa <= 0 || t <= 0) return null;
    return t / tasa;
  });

  readonly pendienteValido = computed(() =>
    this.compradorNombre().trim().length > 0 && this.autorizadoPor().trim().length > 0,
  );
  readonly cuentaCosasValido = computed(() =>
    this.autorizadoPor().trim().length > 0,
  );
  readonly divisaValido = computed(() =>
    this.tasaCambio() != null && this.tasaCambio()! > 0
    && this.billeteRecibido() != null && this.billeteRecibido()! > 0
    && (this.pagoSuficiente() || (this.completacionEfectivo() != null && this.errorCompletacion() == null)),
  );
  /** True si el formulario activo tiene todos los campos requeridos. */
  readonly formularioValido = computed(() => {
    const fp = this.formaPago();
    if (fp === 'divisas') return this.divisaValido();
    if (fp === 'pendiente') return this.pendienteValido();
    if (fp === 'cuenta_cosas') return this.cuentaCosasValido();
    return true; // efectivo y transferencia no tienen sub-form
  });

  /** UI guard: true si formaPago=divisas, hay vuelto > 0 y saldoEnCaja < vuelto */
  readonly saldoInsuficienteVuelto = computed(() => {
    if (this.formaPago() !== 'divisas') return false;
    const v = this.vuelto();
    if (v == null || v <= 0) return false;
    return this.saldoEnCaja() < v;
  });

  /** Formulario válido incluyendo saldo suficiente para vuelto */
  readonly formularioValidoConSaldo = computed(() => {
    return this.formularioValido() && !this.saldoInsuficienteVuelto();
  });

  // Pendiente / Cuenta Casas sub-form
  readonly compradorNombre = signal<string>('');
  readonly autorizadoPor = signal<string>('');
  readonly descripcion = signal<string>('');

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

  onConfirmar(): void {
    const payload: CheckoutPayload = { formaPago: this.formaPago() };

    if (this.formaPago() === 'divisas') {
      payload.divisaTipo = this.divisaTipo();
      payload.billeteRecibido = this.billeteRecibido() ?? undefined;
      payload.tasaCambio = this.tasaCambio() ?? undefined;
      payload.completacionEfectivo = this.completacionEfectivo() ?? undefined;
    } else if (this.formaPago() === 'pendiente') {
      payload.compradorNombre = this.compradorNombre();
      payload.autorizadoPor = this.autorizadoPor();
      payload.descripcion = this.descripcion() || undefined;
    } else if (this.formaPago() === 'cuenta_cosas') {
      payload.autorizadoPor = this.autorizadoPor();
      payload.descripcion = this.descripcion() || undefined;
    }

    this.confirmar.emit(payload);
  }

  seleccionarFormaPago(valor: string): void {
    this.formaPago.set(valor);
    if (valor !== 'divisas') {
      this.completacionEfectivo.set(null);
    }
  }
}
