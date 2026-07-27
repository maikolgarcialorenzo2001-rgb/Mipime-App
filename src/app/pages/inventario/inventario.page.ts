import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { AuthService } from '../../services/auth.service';
import type { Producto } from '../../models';
import type { StockMovimiento, LoteStock } from '../../models';
import { StockBadgeComponent } from '../../components/stock-badge/stock-badge.component';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    StockBadgeComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './inventario.page.html',
  styleUrl: './inventario.page.css',
})
export class InventarioPage implements OnInit {
  private readonly productoService = inject(ProductoService);
  private readonly stockService = inject(StockMovimientoService);
  private readonly authService = inject(AuthService);

  readonly esAdmin = computed(() => this.authService.usuario()?.rol === 'admin');

  readonly productos = signal<Producto[]>([]);
  readonly movimientos = signal<StockMovimiento[]>([]);
  readonly loading = signal(true);
  readonly movimientosLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly selectedAction = signal<{
    productoId: number;
    tipo: 'entrada' | 'salida' | 'ajuste' | 'traslado' | 'editar';
  } | null>(null);
  readonly showHistoryId = signal<number | null>(null);
  readonly movimientoCantidad = signal<number | null>(null);
  readonly movimientoCosto = signal<number | null>(null);
  readonly movimientoMotivo = signal('');
  readonly showLotesId = signal<number | null>(null);
  readonly lotes = signal<LoteStock[]>([]);
  readonly lotesLoading = signal(false);
  readonly selectedLoteIndex = signal<number | null>(null);
  readonly productoLotes = signal<LoteStock[]>([]);
  readonly editarPrecioVenta = signal<number | null>(null);
  readonly editarPrecioCosto = signal<number | null>(null);

  /** Devuelve el lote actualmente seleccionado en el formulario editar. */
  get loteActual(): LoteStock | null {
    const idx = this.selectedLoteIndex();
    const lotes = this.productoLotes();
    if (idx === null || lotes.length === 0) return null;
    return lotes[idx - 1] ?? null;
  }

  /** Helper para convertir string a número en templates. */
  toInt(value: string | number | null): number | null {
    if (value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n) ? null : n;
  }

  readonly filteredProductos = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.productos();
    return this.productos().filter((p) =>
      p.nombre.toLowerCase().includes(q),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.loadProductos();
  }

  private async loadProductos(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const productos = await firstValueFrom(
        this.productoService.listar(),
      );
      this.productos.set(productos ?? []);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cargar productos',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmitMovimiento(): Promise<void> {
    const action = this.selectedAction();
    if (!action) return;

    this.error.set(null);
    try {
      switch (action.tipo) {
        case 'entrada': {
          await this.stockService.registrarEntrada(
            action.productoId,
            this.movimientoCantidad() ?? 0,
            this.movimientoCosto() ?? 0,
            this.movimientoMotivo() || undefined,
          );
          break;
        }
        case 'salida':
          await this.stockService.registrarSalida(
            action.productoId,
            this.movimientoCantidad() ?? 0,
            this.movimientoMotivo() || undefined,
            undefined,
            'almacen',
          );
          break;
        case 'ajuste': {
          const loteIndex = this.selectedLoteIndex();
          const lotes = this.productoLotes();
          const lote = lotes[loteIndex !== null ? loteIndex - 1 : -1];
          if (!lote) {
            this.error.set('Debe seleccionar un lote para ajustar');
            return;
          }
          await this.stockService.registrarAjusteLote(
            action.productoId,
            lote.id,
            this.movimientoCantidad() ?? 0,
            this.movimientoMotivo(),
            lote.ubicacion,
          );
          break;
        }
        case 'editar': {
          const loteIdx = this.selectedLoteIndex();
          const productoLotes = this.productoLotes();
          const loteSel = productoLotes[loteIdx !== null ? loteIdx - 1 : -1];
          if (!loteSel) {
            this.error.set('Debe seleccionar un lote');
            return;
          }
          const pv = this.editarPrecioVenta();
          const pc = this.editarPrecioCosto();
          if (pv === null) {
            this.error.set('El precio de venta es obligatorio');
            return;
          }
          if (pc === null) {
            this.error.set('El precio de costo es obligatorio');
            return;
          }
          await this.stockService.registrarEditar(
            action.productoId,
            loteSel.id,
            pv,
            pc,
            this.movimientoCantidad() ?? 0,
            this.movimientoMotivo(),
            loteSel.ubicacion,
          );
          break;
        }
        case 'traslado':
          await this.stockService.registrarTraslado(
            action.productoId,
            this.movimientoCantidad() ?? 0,
          );
          break;
      }
      this.selectedAction.set(null);
      this.movimientoCantidad.set(null);
      this.movimientoMotivo.set('');
      this.selectedLoteIndex.set(null);
      this.productoLotes.set([]);
      this.editarPrecioVenta.set(null);
      this.editarPrecioCosto.set(null);
      await this.loadProductos();
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Error al registrar movimiento',
      );
    }
  }

  async toggleHistory(productoId: number): Promise<void> {
    if (this.showHistoryId() === productoId) {
      this.showHistoryId.set(null);
      return;
    }
    this.showHistoryId.set(productoId);
    this.movimientosLoading.set(true);
    this.error.set(null);
    try {
      const movs = await this.stockService.obtenerMovimientos(
        productoId,
      );
      this.movimientos.set(movs);
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Error al cargar historial',
      );
    } finally {
      this.movimientosLoading.set(false);
    }
  }

  async toggleLotes(productoId: number): Promise<void> {
    if (this.showLotesId() === productoId) {
      this.showLotesId.set(null);
      return;
    }
    this.showLotesId.set(productoId);
    this.lotesLoading.set(true);
    this.error.set(null);
    try {
      const lotesData = await this.stockService.obtenerLotesPorProducto(
        productoId,
      );
      this.lotes.set(lotesData);
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Error al cargar lotes',
      );
    } finally {
      this.lotesLoading.set(false);
    }
  }

  async onSelectAction(
    productoId: number,
    tipo: 'entrada' | 'salida' | 'ajuste' | 'traslado' | 'editar',
  ): Promise<void> {
    this.selectedAction.set({ productoId, tipo });
    this.selectedLoteIndex.set(null);
    this.movimientoCantidad.set(null);
    this.movimientoCosto.set(null);
    this.movimientoMotivo.set('');
    this.editarPrecioVenta.set(null);
    this.editarPrecioCosto.set(null);

    if (tipo === 'ajuste' || tipo === 'editar') {
      try {
        const lotes = await this.stockService.obtenerLotesPorProducto(productoId);
        this.productoLotes.set(lotes);
        if (lotes.length > 0 && tipo === 'editar') {
          this.selectedLoteIndex.set(1);
          const firstLote = lotes[0];
          const prod = this.productos().find((p) => p.id === productoId);
          this.editarPrecioVenta.set(prod?.precio_venta ?? 0);
          this.editarPrecioCosto.set(firstLote.precio_costo);
          this.movimientoCantidad.set(firstLote.cantidad);
        } else if (lotes.length > 0) {
          this.selectedLoteIndex.set(1);
        }
      } catch {
        this.productoLotes.set([]);
      }
    } else {
      this.productoLotes.set([]);
    }
  }

  /** Actualiza placeholders de precio_costo y cantidad al cambiar de lote en editar. */
  actualizarPlaceholdersEditar(): void {
    const lote = this.loteActual;
    if (lote) {
      this.editarPrecioCosto.set(lote.precio_costo);
      this.movimientoCantidad.set(lote.cantidad);
    }
  }

  // ── CRUD Productos (Nuevo solo — Editar usa formulario inline) ──

  readonly showProductoModal = signal(false);
  readonly formNombre = signal('');
  readonly formCosto = signal<number | null>(null);
  readonly formPrecioVenta = signal<number | null>(null);
  readonly formUnidades = signal<number | null>(null);
  readonly formError = signal<string | null>(null);
  readonly confirmandoEliminar = signal<number | null>(null);
  readonly procesando = signal(false);

  abrirNuevoProducto(): void {
    this.formNombre.set('');
    this.formCosto.set(null);
    this.formPrecioVenta.set(null);
    this.formUnidades.set(null);
    this.formError.set(null);
    this.procesando.set(false);
    this.showProductoModal.set(true);
  }

  cerrarModal(): void {
    this.showProductoModal.set(false);
    this.formNombre.set('');
    this.formCosto.set(null);
    this.formPrecioVenta.set(null);
    this.formUnidades.set(null);
    this.formError.set(null);
    this.procesando.set(false);
  }

  async guardarProducto(): Promise<void> {
    // Validate required fields
    if (!this.formNombre()?.trim()) {
      this.formError.set('El nombre es obligatorio');
      return;
    }
    if (this.formCosto() === null) {
      this.formError.set('El precio de costo es obligatorio');
      return;
    }
    if (this.formPrecioVenta() === null) {
      this.formError.set('El precio de venta es obligatorio');
      return;
    }
    if (this.formUnidades() === null) {
      this.formError.set('Las unidades son obligatorias');
      return;
    }

    this.procesando.set(true);
    this.formError.set(null);

    try {
      await firstValueFrom(
        this.productoService.crear({
          nombre: this.formNombre().trim(),
          precio_costo: this.formCosto()!,
          precio_venta: this.formPrecioVenta()!,
          stock_almacen: this.formUnidades()!,
        }),
      );
      this.cerrarModal();
      await this.loadProductos();
    } catch (e) {
      this.formError.set(
        e instanceof Error ? e.message : 'Error al guardar producto',
      );
    } finally {
      this.procesando.set(false);
    }
  }

  confirmarEliminar(id: number): void {
    this.confirmandoEliminar.set(id);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const id = this.confirmandoEliminar();
    if (id === null) return;

    this.procesando.set(true);
    try {
      await firstValueFrom(this.productoService.eliminar(id));
      this.confirmandoEliminar.set(null);
      await this.loadProductos();
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al eliminar producto',
      );
    } finally {
      this.procesando.set(false);
    }
  }
}
