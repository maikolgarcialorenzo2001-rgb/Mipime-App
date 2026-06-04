import { Component, input, output } from '@angular/core';
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
  readonly confirmar = output();
  readonly cancelar = output();

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
