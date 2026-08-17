import { Component, input, output } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart-item-row',
  imports: [PesosPipe],
  templateUrl: './cart-item-row.component.html',
  styleUrl: './cart-item-row.component.css',
})
export class CartItemRowComponent {
  readonly item = input.required<CartItem>();
  readonly cantidadReducir = output();
  readonly cantidadAumentar = output();
  readonly quitar = output();
}
