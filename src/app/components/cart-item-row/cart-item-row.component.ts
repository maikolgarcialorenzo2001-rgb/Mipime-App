import { Component, input, output } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { CartItem } from '../../services/cart.service';
import { unidadMedidaInfo } from '../../models/producto';

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

  /** Etiqueta de precio por unidad de medida: "c/u" | "por lb". */
  etiquetaPrecio(item: CartItem): string {
    return unidadMedidaInfo(item.producto.unidad_medida).allowsDecimal
      ? 'por lb'
      : 'c/u';
  }
}
