import { Injectable, signal, computed } from '@angular/core';
import type { Producto } from '../models';
import { UNIDAD_MEDIDA } from '../models/producto';

export interface CartItem {
  producto: Producto;
  cantidad: number;
  subtotal: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  readonly items = signal<CartItem[]>([]);

  readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + item.subtotal, 0),
  );

  readonly cantidadItems = computed(() =>
    this.items().reduce((sum, item) => sum + item.cantidad, 0),
  );

  /** Paso de incremento/decremento según unidad de medida (1 | 0.1). */
  stepPara(producto: Producto): number {
    return UNIDAD_MEDIDA[producto.unidad_medida].step;
  }

  /** Cantidad redondeada a 2 decimales para evitar ruido de float (0.3000000004). */
  private _redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Incrementa la cantidad de un item por el paso según su unidad de medida. */
  incrementar(producto: Producto, cantidadActual: number): void {
    this.actualizarCantidad(
      producto.id,
      this._redondear(cantidadActual + this.stepPara(producto)),
    );
  }

  /** Decrementa la cantidad de un item por el paso según su unidad de medida. */
  decrementar(producto: Producto, cantidadActual: number): void {
    const nuevo = this._redondear(cantidadActual - this.stepPara(producto));
    this.actualizarCantidad(producto.id, nuevo);
  }

  agregar(producto: Producto, cantidad = 1): void {
    if (cantidad <= 0) return;

    this.items.update((actual) => {
      const existente = actual.find(
        (item) => item.producto.id === producto.id,
      );

      if (existente) {
        return actual.map((item) =>
          item.producto.id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + cantidad,
                subtotal: (item.cantidad + cantidad) * item.producto.precio_venta,
              }
            : item,
        );
      }

      return [
        ...actual,
        {
          producto,
          cantidad,
          subtotal: cantidad * producto.precio_venta,
        },
      ];
    });
  }

  actualizarCantidad(productoId: number, cantidad: number): void {
    if (cantidad <= 0) {
      this.quitar(productoId);
      return;
    }

    this.items.update((actual) =>
      actual.map((item) =>
        item.producto.id === productoId
          ? {
              ...item,
              cantidad,
              subtotal: cantidad * item.producto.precio_venta,
            }
          : item,
      ),
    );
  }

  quitar(productoId: number): void {
    this.items.update((actual) =>
      actual.filter((item) => item.producto.id !== productoId),
    );
  }

  limpiar(): void {
    this.items.set([]);
  }
}
