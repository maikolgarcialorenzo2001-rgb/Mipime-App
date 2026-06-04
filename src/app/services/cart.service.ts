import { Injectable, signal, computed } from '@angular/core';
import type { Producto } from '../models';

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
