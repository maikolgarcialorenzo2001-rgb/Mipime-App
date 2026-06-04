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
}
