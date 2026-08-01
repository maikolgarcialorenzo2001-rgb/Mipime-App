import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { StockBadgeComponent } from '../../components/stock-badge/stock-badge.component';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import type { Producto } from '../../models';
import type { GlobalInvestment } from '../../models';
import type { LoteDetalle } from '../../models';

@Component({
  selector: 'app-productos-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, StockBadgeComponent],
  templateUrl: './producto.page.html',
  styleUrl: './producto.page.css',
})
export class ProductosPage implements OnInit {
  private readonly _productoService = inject(ProductoService);
  private readonly _stockService = inject(StockMovimientoService);
  private readonly _jornadaService = inject(JornadaService);
  private readonly _authService = inject(AuthService);

  readonly esAdmin = computed(() => this._authService.usuario()?.rol === 'admin');

  readonly productos = signal<Producto[]>([]);
  readonly buscando = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly query = signal('');

  // ── Investment Stats ──────────────────────────────────────────
  readonly inversionGlobal = signal<GlobalInvestment | null>(null);
  readonly inversionPorProducto = signal<Map<number, number>>(new Map());

  getTotalInvertido(productoId: number): number {
    return this.inversionPorProducto().get(productoId) ?? 0;
  }
  // ── Merma ──────────────────────────────────────────────────

  readonly selectedProductoId = signal<number | null>(null);
  readonly mermaCantidad = signal<number | null>(null);
  readonly mermaMotivo = signal('');
  readonly mermaUbicacion = signal<'almacen' | 'shop'>('shop');
  readonly mermaError = signal<string | null>(null);
  readonly mermaProcesando = signal(false);

  /** Stock disponible en la ubicación seleccionada */
  readonly mermaStockDisponible = computed(() => {
    const pid = this.selectedProductoId();
    if (pid === null) return 0;
    const prod = this.productos().find((p) => p.id === pid);
    if (!prod) return 0;
    return this.mermaUbicacion() === 'almacen' ? prod.stock_almacen : prod.stock_shop;
  });

  /** True cuando la cantidad ingresada es ≤ stock disponible (o null/0) */
  readonly mermaStockSuficiente = computed(() => {
    const cantidad = this.mermaCantidad();
    if (!cantidad || cantidad <= 0) return true;
    return cantidad <= this.mermaStockDisponible();
  });

  // ── Lotes ──────────────────────────────────────────────────
  readonly lotesProductoId = signal<number | null>(null);
  readonly lotesPorProducto = signal<Map<number, LoteDetalle[]>>(new Map());
  readonly lotesLoading = signal(false);
  readonly lotesError = signal<string | undefined>(undefined);

  async toggleLotes(productoId: number): Promise<void> {
    if (this.lotesProductoId() === productoId) {
      this.lotesProductoId.set(null);
      return;
    }

    this.lotesProductoId.set(productoId);

    // Check cache
    const cache = this.lotesPorProducto();
    if (cache.has(productoId)) {
      return;
    }

    this.lotesLoading.set(true);
    this.lotesError.set(undefined);

    try {
      const lotes = await this._stockService.obtenerLotesAgrupados(productoId);
      const updated = new Map(cache);
      updated.set(productoId, lotes);
      this.lotesPorProducto.set(updated);
    } catch (e) {
      this.lotesError.set(e instanceof Error ? e.message : 'Error al cargar lotes');
    } finally {
      this.lotesLoading.set(false);
    }
  }

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
        this._cargarInversion();
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Error al cargar productos');
        this.buscando.set(false);
        console.error('[ProductosPage] Error al cargar:', err);
      },
    });
  }

  private _cargarInversion(): void {
    this._productoService.obtenerInversionGlobal().subscribe({
      next: (stats) => this.inversionGlobal.set(stats),
      error: () => this.inversionGlobal.set(null),
    });
    this._productoService.obtenerInversionPorProducto().subscribe({
      next: (rows) => {
        const map = new Map<number, number>();
        for (const r of rows) {
          map.set(r.producto_id, r.total_invertido);
        }
        this.inversionPorProducto.set(map);
      },
      error: () => this.inversionPorProducto.set(new Map()),
    });
  }

  // ── Merma ──────────────────────────────────────────────────

  abrirMerma(productoId: number): void {
    this.selectedProductoId.set(productoId);
    this.mermaCantidad.set(null);
    this.mermaMotivo.set('');
    this.mermaUbicacion.set('shop');
    this.mermaError.set(null);
  }

  cancelarMerma(): void {
    this.selectedProductoId.set(null);
    this.mermaCantidad.set(null);
    this.mermaMotivo.set('');
    this.mermaUbicacion.set('shop');
    this.mermaError.set(null);
  }

  async onSubmitMerma(): Promise<void> {
    const productoId = this.selectedProductoId();
    if (!productoId) return;

    if (!this.mermaCantidad() || this.mermaCantidad()! <= 0) {
      this.mermaError.set('La cantidad debe ser mayor a 0');
      return;
    }

    if (!this.mermaMotivo().trim()) {
      this.mermaError.set('El motivo es obligatorio');
      return;
    }

    const cant = this.mermaCantidad()!;

    this.mermaProcesando.set(true);
    this.mermaError.set(null);
    try {
      await this._stockService.registrarMerma(
        productoId,
        cant,
        this.mermaMotivo().trim(),
        this._jornadaService.jornadaAbierta()?.id,
        this.mermaUbicacion(),
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
