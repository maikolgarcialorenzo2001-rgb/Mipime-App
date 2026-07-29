import { Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CartItem } from '../../services/cart.service';

export interface CheckoutPayload {
  formaPago: string;
  divisaTipo?: 'EUR' | 'USD';
  billeteRecibido?: number;
  tasaCambio?: number;
  compradorNombre?: string;
  autorizadoPor?: string;
  descripcion?: string;
}

@Component({
  selector: 'app-checkout-modal',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './checkout-modal.component.html',
  styleUrl: './checkout-modal.component.css',
})
export class CheckoutModalComponent {
  readonly items = input.required<CartItem[]>();
  readonly total = input.required<number>();
  readonly errorMessage = input<string | null>(null);
  readonly confirmar = output<CheckoutPayload>();
  readonly cancelar = output();

  readonly formaPago = signal<string>('efectivo');

  // Divisas sub-form
  readonly divisaTipo = signal<'EUR' | 'USD'>('USD');
  readonly billeteRecibido = signal<number | null>(null);
  readonly tasaCambio = signal<number | null>(null);
  readonly vuelto = computed<number | null>(() => {
    const billete = this.billeteRecibido();
    const tasa = this.tasaCambio();
    const t = this.total();
    if (billete == null || tasa == null || tasa <= 0 || billete <= 0) return null;
    return billete * tasa - t;
  });

  /** Estimado de divisa a pagar: total / tasa → feedback visual */
  readonly estimadoDivisa = computed<number | null>(() => {
    const tasa = this.tasaCambio();
    const t = this.total();
    if (tasa == null || tasa <= 0 || t <= 0) return null;
    return t / tasa;
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
  }
}
