import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { StockBadgeComponent } from '../stock-badge/stock-badge.component';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';

@Component({
  selector: 'app-product-card',
  imports: [PesosPipe, NgClass, StockBadgeComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent {
  readonly producto = input.required<Producto>();
  readonly selected = input(false);
  readonly clicked = output<void>();
}
