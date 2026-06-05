import { Component, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import type { CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-checkout-modal',
  imports: [CurrencyPipe],
  templateUrl: './checkout-modal.component.html',
  styleUrl: './checkout-modal.component.css',
})
export class CheckoutModalComponent {
  readonly items = input.required<CartItem[]>();
  readonly total = input.required<number>();
  readonly errorMessage = input<string | null>(null);
  readonly confirmar = output<{ formaPago: string }>();
  readonly cancelar = output();

  readonly formaPago = signal<'efectivo' | 'transferencia'>('efectivo');

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
    this.confirmar.emit({ formaPago: this.formaPago() });
  }

  seleccionarFormaPago(valor: 'efectivo' | 'transferencia'): void {
    this.formaPago.set(valor);
  }
}
