import { Component, input, output } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';
import type { Producto } from '../../models';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, NgClass],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent {
  readonly producto = input.required<Producto>();
  readonly selected = input(false);
  readonly clicked = output<void>();

  getStockColor(): string {
    const stock = this.producto().stock_actual;
    if (stock > 10) return 'text-green-400';
    if (stock >= 1) return 'text-orange-400';
    return 'text-red-500';
  }
}
