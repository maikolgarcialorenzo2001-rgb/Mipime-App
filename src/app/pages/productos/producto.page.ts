import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { StockBadgeComponent } from '../../components/stock-badge/stock-badge.component';
import { ProductoService } from '../../services/producto.service';
import type { Producto } from '../../models';

@Component({
  selector: 'app-productos-page',
  imports: [CurrencyPipe, DecimalPipe, StockBadgeComponent],
  templateUrl: './producto.page.html',
  styleUrl: './producto.page.css',
})
export class ProductosPage implements OnInit {
  private readonly _productoService = inject(ProductoService);

  readonly productos = signal<Producto[]>([]);
  readonly buscando = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly query = signal('');

  private _timeoutId?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this._cargar();
  }

  onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this._timeoutId);

    this._timeoutId = setTimeout(() => {
      if (value.trim()) {
        this.buscando.set(true);
        this._productoService.buscar(value.trim()).subscribe({
          next: (resultados) => {
            this.productos.set(resultados);
            this.buscando.set(false);
          },
          error: (err: unknown) => {
            this.error.set(err instanceof Error ? err.message : 'Error al buscar');
            this.buscando.set(false);
          },
        });
      } else {
        this._cargar();
      }
    }, 300);
  }

  /** Vuelve a cargar productos, limpiando el error previo. */
  recargar(): void {
    this.error.set(undefined);
    this._cargar();
  }

  private _cargar(): void {
    this.buscando.set(true);
    this._productoService.listar().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.buscando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Error al cargar productos');
        this.buscando.set(false);
        console.error('[ProductosPage] Error al cargar:', err);
      },
    });
  }
}
