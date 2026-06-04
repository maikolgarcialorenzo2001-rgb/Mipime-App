import { Component, inject, viewChild, ElementRef, afterNextRender, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductoService } from '../../services/producto.service';
import { CartService } from '../../services/cart.service';
import { JornadaService } from '../../services/jornada.service';
import { VentaService } from '../../services/venta.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CartItemRowComponent } from '../../components/cart-item-row/cart-item-row.component';
import { CheckoutModalComponent } from '../../components/checkout-modal/checkout-modal.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import type { Producto } from '../../models';

@Component({
  selector: 'app-pos-page',
  imports: [CurrencyPipe, ProductCardComponent, CartItemRowComponent, CheckoutModalComponent, LoadingSpinnerComponent, EmptyStateComponent, ErrorAlertComponent],
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

  readonly jornadaCargando = signal(true);
  readonly jornadaId = signal<number | null>(null);
  readonly ventaError = signal<string | null>(null);

  private _debounceId?: ReturnType<typeof setTimeout>;

  constructor() {
    this._buscar('');
    this._cargarJornada();

    afterNextRender(() => {
      this.searchInput()?.nativeElement.focus();
    });
  }

  get sinJornada(): boolean {
    return !this.jornadaCargando() && this.jornadaId() === null;
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
    this.ventaError.set(null);
    this.showModal.set(true);
  }

  cerrarModal(): void {
    this.showModal.set(false);
  }

  confirmarVenta(): void {
    const jId = this.jornadaId();
    if (jId === null) return;

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

  private _cargarJornada(): void {
    this.jornadaCargando.set(true);

    this._jornadaService.obtenerAbierta().subscribe({
      next: (jornada) => {
        this.jornadaId.set(jornada?.id ?? null);
        this.jornadaCargando.set(false);
      },
      error: () => {
        this.jornadaId.set(null);
        this.jornadaCargando.set(false);
      },
    });
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
