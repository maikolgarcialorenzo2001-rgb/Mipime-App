import { Component, input, output } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';
import { StockBadgeComponent } from '../stock-badge/stock-badge.component';
import type { Producto } from '../../models';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, NgClass, StockBadgeComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent {
  readonly producto = input.required<Producto>();
  readonly selected = input(false);
  readonly clicked = output<void>();
}
