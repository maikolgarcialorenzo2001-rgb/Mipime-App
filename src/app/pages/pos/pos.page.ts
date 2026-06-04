import { Component, inject, viewChild, ElementRef, afterNextRender, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import { JornadaService } from '../../services/jornada.service';
import { VentaService } from '../../services/venta.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CartItemRowComponent } from '../../components/cart-item-row/cart-item-row.component';
import { CheckoutModalComponent } from '../../components/checkout-modal/checkout-modal.component';
import { QuantityInputComponent } from '../../components/quantity-input/quantity-input.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import type { Producto } from '../../models';

@Component({
  selector: 'app-pos-page',
  imports: [CurrencyPipe, ProductCardComponent, CartItemRowComponent, CheckoutModalComponent, QuantityInputComponent, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './pos.page.html',
  styleUrl: './pos.page.css',
})
export class PosPage {
  private readonly _productoService = inject(ProductoService);
  private readonly _cartService = inject(CartService);
  private readonly _jornadaService = inject(JornadaService);
  private readonly _ventaService = inject(VentaService);

  readonly cart = this._cartService;
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = signal('');
  readonly resultados = signal<Producto[]>([]);
  readonly buscando = signal(false);
  readonly selectedIndex = signal(0);
  readonly showModal = signal(false);
  readonly pendingProduct = signal<Producto | null>(null);

  readonly ventaError = signal<string | null>(null);

  /** Cantidad de columnas del grid según el viewport, matcheando Tailwind breakpoints. */
  private get _columnCount(): number {
    const w = window.innerWidth;
    if (w >= 1280) return 5; // xl: grid-cols-5
    if (w >= 1024) return 4; // lg: grid-cols-4
    if (w >= 640) return 3;  // sm: grid-cols-3
    return 2;                // default: grid-cols-2
  }

  private _debounceId?: ReturnType<typeof setTimeout>;

  constructor() {
    this._buscar('');

    afterNextRender(() => {
      this.searchInput()?.nativeElement.focus();
    });
  }

  get sinJornada(): boolean {
    return !this._jornadaService.jornadaCargando() && this._jornadaService.jornadaAbierta() === null;
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
    clearTimeout(this._debounceId);

    this._debounceId = setTimeout(() => {
      this._buscar(value.trim());
    }, 200);
  }

  onKeydown(event: KeyboardEvent): void {
    // Si el modal de cantidad está abierto, no procesamos atajos
    if (this.pendingProduct()) return;

    if (event.key === 'Escape') {
      if (this.query()) {
        this.query.set('');
        this._buscar('');
      }
      this.searchInput()?.nativeElement.focus();
      return;
    }

    if (event.key === 'Backspace') {
      // Si hay resultados y todo el texto de búsqueda ya se borró,
      // reducir cantidad del producto seleccionado en el carrito
      if (!this.query()) {
        const resultados = this.resultados();
        const idx = this.selectedIndex();
        const producto = resultados[idx];
        if (producto) {
          const item = this.cart.items().find(i => i.producto.id === producto.id);
          if (item) {
            event.preventDefault();
            this.cart.actualizarCantidad(producto.id, item.cantidad - 1);
          }
        }
      }
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const len = this.resultados().length;
      const cols = this._columnCount;

      this.selectedIndex.update((i) => {
        switch (event.key) {
          case 'ArrowLeft':  return Math.max(0, i - 1);
          case 'ArrowRight': return Math.min(len - 1, i + 1);
          case 'ArrowUp':    return Math.max(0, i - cols);
          case 'ArrowDown':  return Math.min(len - 1, i + cols);
          default:           return i;
        }
      });
      return;
    }

    if (event.key === 'Enter') {
      const resultados = this.resultados();
      const idx = this.selectedIndex();
      if (resultados[idx]) {
        this._agregarAlCarrito(resultados[idx]);
      }
    }
  }

  agregarAlCarrito(producto: Producto): void {
    this.pendingProduct.set(producto);
  }

  onCantidadConfirmada(cantidad: number): void {
    const producto = this.pendingProduct();
    if (!producto) return;
    this.pendingProduct.set(null);
    this._agregarAlCarrito(producto, cantidad);
  }

  onCantidadCancelada(): void {
    this.pendingProduct.set(null);
    this.searchInput()?.nativeElement.focus();
  }

  abrirModal(): void {
    this.ventaError.set(null);
    this.showModal.set(true);
  }

  cerrarModal(): void {
    this.showModal.set(false);
    this.ventaError.set(null);
  }

  confirmarVenta(): void {
    const jId = this._jornadaService.jornadaAbierta()?.id;
    if (jId === undefined) return;

    this.ventaError.set(null);
    const items = this.cart.items();

    this._ventaService.registrar(jId, items).subscribe({
      next: () => {
        this.showModal.set(false);
        this.cart.limpiar();
        this.searchInput()?.nativeElement.focus();
      },
      error: (err: unknown) => {
        this.ventaError.set(
          err instanceof Error ? err.message : 'Error al registrar la venta',
        );
      },
    });
  }

  private _buscar(query: string): void {
    // Si la query se resuelve rápido (< 150ms), no mostramos el spinner
    // para evitar el pantallazo al agregar productos al carrito.
    const loadingTimer = setTimeout(() => this.buscando.set(true), 150);

    const obs = query
      ? this._productoService.buscar(query)
      : this._productoService.listar();

    obs.subscribe({
      next: (productos) => {
        clearTimeout(loadingTimer);
        this.resultados.set(productos);
        this.buscando.set(false);
      },
      error: () => {
        clearTimeout(loadingTimer);
        this.buscando.set(false);
      },
    });
  }

  private _agregarAlCarrito(producto: Producto, cantidad = 1): void {
    this.cart.agregar(producto, cantidad);
    this.query.set('');
    this._buscar('');
    this.searchInput()?.nativeElement.focus();
  }
}
