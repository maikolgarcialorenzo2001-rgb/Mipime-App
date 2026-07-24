import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import type { Producto } from '../../models';
import type { StockMovimiento } from '../../models';
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

  readonly productos = signal<Producto[]>([]);
  readonly movimientos = signal<StockMovimiento[]>([]);
  readonly loading = signal(true);
  readonly movimientosLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly selectedAction = signal<{
    productoId: number;
    tipo: 'entrada' | 'salida' | 'ajuste';
  } | null>(null);
  readonly showHistoryId = signal<number | null>(null);
  readonly movimientoCantidad = signal<number>(0);
  readonly movimientoMotivo = signal('');

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
        case 'entrada':
          await this.stockService.registrarEntrada(
            action.productoId,
            this.movimientoCantidad(),
            this.movimientoMotivo() || undefined,
          );
          break;
        case 'salida':
          await this.stockService.registrarSalida(
            action.productoId,
            this.movimientoCantidad(),
            this.movimientoMotivo() || undefined,
          );
          break;
        case 'ajuste':
          await this.stockService.registrarAjuste(
            action.productoId,
            this.movimientoCantidad(),
            this.movimientoMotivo(),
          );
          break;
      }
      this.selectedAction.set(null);
      this.movimientoCantidad.set(0);
      this.movimientoMotivo.set('');
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

  // ── CRUD Productos ──────────────────────────────────────────────

  readonly showProductoModal = signal(false);
  readonly editandoProductoId = signal<number | null>(null);
  readonly formNombre = signal('');
  readonly formCosto = signal<number>(0);
  readonly formPrecioVenta = signal<number>(0);
  readonly formUnidades = signal<number>(0);
  readonly formError = signal<string | null>(null);
  readonly confirmandoEliminar = signal<number | null>(null);
  readonly procesando = signal(false);

  abrirNuevoProducto(): void {
    this.formNombre.set('');
    this.formCosto.set(0);
    this.formPrecioVenta.set(0);
    this.formUnidades.set(0);
    this.formError.set(null);
    this.procesando.set(false);
    this.editandoProductoId.set(null);
    this.showProductoModal.set(true);
  }

  abrirEditarProducto(p: Producto): void {
    this.formNombre.set(p.nombre);
    this.formCosto.set(p.precio_costo ?? 0);
    this.formPrecioVenta.set(p.precio_venta);
    this.formUnidades.set(p.stock_actual);
    this.formError.set(null);
    this.procesando.set(false);
    this.editandoProductoId.set(p.id);
    this.showProductoModal.set(true);
  }

  cerrarModal(): void {
    this.showProductoModal.set(false);
    this.editandoProductoId.set(null);
    this.formNombre.set('');
    this.formCosto.set(0);
    this.formPrecioVenta.set(0);
    this.formUnidades.set(0);
    this.formError.set(null);
    this.procesando.set(false);
  }

  async guardarProducto(): Promise<void> {
    // Validate required fields
    if (!this.formNombre()?.trim()) {
      this.formError.set('El nombre es obligatorio');
      return;
    }
    if (!this.formCosto() && this.formCosto() !== 0) {
      this.formError.set('El precio de costo es obligatorio');
      return;
    }
    if (!this.formPrecioVenta() && this.formPrecioVenta() !== 0) {
      this.formError.set('El precio de venta es obligatorio');
      return;
    }
    if (!this.editandoProductoId() && !this.formUnidades() && this.formUnidades() !== 0) {
      this.formError.set('Las unidades son obligatorias');
      return;
    }

    this.procesando.set(true);
    this.formError.set(null);

    try {
      if (this.editandoProductoId()) {
        await firstValueFrom(
          this.productoService.actualizar(this.editandoProductoId()!, {
            nombre: this.formNombre().trim(),
            precio_costo: this.formCosto(),
            precio_venta: this.formPrecioVenta(),
          }),
        );
      } else {
        await firstValueFrom(
          this.productoService.crear({
            nombre: this.formNombre().trim(),
            precio_costo: this.formCosto(),
            precio_venta: this.formPrecioVenta(),
            stock_actual: this.formUnidades(),
          }),
        );
      }
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
