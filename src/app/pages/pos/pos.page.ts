import { Component, inject, viewChild, ElementRef, afterNextRender, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import type { Producto } from '../../models';

@Component({
  selector: 'app-pos-page',
  imports: [CurrencyPipe],
  templateUrl: './pos.page.html',
  styleUrl: './pos.page.css',
})
export class PosPage {
  private readonly _productoService = inject(ProductoService);
  private readonly _cartService = inject(CartService);

  readonly cart = this._cartService;
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = signal('');
  readonly resultados = signal<Producto[]>([]);
  readonly buscando = signal(false);
  readonly selectedIndex = signal(0);
  readonly showModal = signal(false);

  private _debounceId?: ReturnType<typeof setTimeout>;

  constructor() {
    // En un POS, al cargar la página mostrar todos los productos
    this._buscar('');

    afterNextRender(() => {
      // Foco automático en el buscador
      this.searchInput()?.nativeElement.focus();
    });
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
    if (event.key === 'Escape') {
      if (this.query()) {
        this.query.set('');
        this._buscar('');
      }
      this.searchInput()?.nativeElement.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update((i) => Math.max(0, i - 1));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update((i) =>
        Math.min(this.resultados().length - 1, i + 1),
      );
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
    this._agregarAlCarrito(producto);
  }

  abrirModal(): void {
    this.showModal.set(true);
  }

  cerrarModal(): void {
    this.showModal.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarModal();
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrarModal();
    }
  }

  confirmarVenta(): void {
    // TODO: persistir la venta en la DB
    this.showModal.set(false);
    this.cart.limpiar();
    this.searchInput()?.nativeElement.focus();
  }

  private _buscar(query: string): void {
    this.buscando.set(true);

    const obs = query
      ? this._productoService.buscar(query)
      : this._productoService.listar();

    obs.subscribe({
      next: (productos) => {
        this.resultados.set(productos);
        this.buscando.set(false);
      },
      error: () => {
        this.buscando.set(false);
      },
    });
  }

  private _agregarAlCarrito(producto: Producto): void {
    this.cart.agregar(producto);
    this.query.set('');
    this._buscar('');
    this.searchInput()?.nativeElement.focus();
  }
}
