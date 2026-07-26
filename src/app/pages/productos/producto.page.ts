import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { StockBadgeComponent } from '../../components/stock-badge/stock-badge.component';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { JornadaService } from '../../services/jornada.service';
import type { Producto } from '../../models';

@Component({
  selector: 'app-productos-page',
  imports: [FormsModule, CurrencyPipe, StockBadgeComponent],
  templateUrl: './producto.page.html',
  styleUrl: './producto.page.css',
})
export class ProductosPage implements OnInit {
  private readonly _productoService = inject(ProductoService);
  private readonly _stockService = inject(StockMovimientoService);
  private readonly _jornadaService = inject(JornadaService);

  readonly productos = signal<Producto[]>([]);
  readonly buscando = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly query = signal('');

  // ── Merma ──────────────────────────────────────────────────
  readonly selectedProductoId = signal<number | null>(null);
  readonly mermaCantidad = signal<number>(0);
  readonly mermaMotivo = signal('');
  readonly mermaError = signal<string | null>(null);
  readonly mermaProcesando = signal(false);

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

  // ── Merma ──────────────────────────────────────────────────

  abrirMerma(productoId: number): void {
    this.selectedProductoId.set(productoId);
    this.mermaCantidad.set(0);
    this.mermaMotivo.set('');
    this.mermaError.set(null);
  }

  cancelarMerma(): void {
    this.selectedProductoId.set(null);
    this.mermaCantidad.set(0);
    this.mermaMotivo.set('');
    this.mermaError.set(null);
  }

  async onSubmitMerma(): Promise<void> {
    const productoId = this.selectedProductoId();
    if (!productoId) return;

    if (this.mermaCantidad() <= 0) {
      this.mermaError.set('La cantidad debe ser mayor a 0');
      return;
    }

    this.mermaProcesando.set(true);
    this.mermaError.set(null);
    try {
      await this._stockService.registrarMerma(
        productoId,
        this.mermaCantidad(),
        this.mermaMotivo() || undefined,
        this._jornadaService.jornadaAbierta()?.id,
      );
      this.cancelarMerma();
      this._cargar();
    } catch (e) {
      this.mermaError.set(
        e instanceof Error ? e.message : 'Error al registrar merma',
      );
    } finally {
      this.mermaProcesando.set(false);
    }
  }
}
