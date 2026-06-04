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
  readonly stockWarningThreshold = input(5);
  readonly clicked = output<void>();
}
