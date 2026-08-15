import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService, type EdicionResultado } from '../../services/stock-movimiento.service';
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
  readonly successMessage = signal<string | null>(null);
  private _toastTimeout: ReturnType<typeof setTimeout> | null = null;
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
  readonly editarNombre = signal('');
  readonly editarPrecioVenta = signal<number | null>(null);
  readonly editarPrecioCosto = signal<number | null>(null);

  /** Ubicación de origen elegida para el Traslado (obligatoria, sin default). */
  readonly salidaUbicacion = signal<'almacen' | 'shop' | null>(null);

  /** Lotes de la ubicación elegida con stock > 0 (los únicos seleccionables en el Traslado). */
  readonly lotesDeUbicacion = computed(() => {
    const ubicacion = this.salidaUbicacion();
    if (ubicacion === null) return [];
    return this.productoLotes().filter(
      (l) => l.ubicacion === ubicacion && l.cantidad > 0,
    );
  });

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

  /** Cambia la ubicación de origen del Traslado y resetea el lote elegido. */
  onSalidaUbicacionChange(value: string): void {
    this.salidaUbicacion.set(
      value === 'shop' || value === 'almacen' ? value : null,
    );
    this.selectedLoteIndex.set(null);
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

  /** Muestra un toast de éxito y lo oculta automáticamente (~2.5s). */
  private _mostrarToast(mensaje: string): void {
    this.successMessage.set(mensaje);
    if (this._toastTimeout !== null) {
      clearTimeout(this._toastTimeout);
    }
    this._toastTimeout = setTimeout(() => {
      this.successMessage.set(null);
      this._toastTimeout = null;
    }, 2500);
  }

  async onSubmitMovimiento(): Promise<void> {
    const action = this.selectedAction();
    if (!action) return;
    // Re-entrancy guard: ignore accidental double-clicks while a movement is
    // still being registered, otherwise the operation runs twice (and double
    // stock is consumed even when it should not be).
    if (this.procesandoMovimiento()) return;

    this.procesandoMovimiento.set(true);
    this.error.set(null);
    // F3: resultado de registrarEditar para comunicar si el lote editado quedó
    // como frente FIFO (cache actualizado) o si el frente sigue siendo otro lote.
    let edicionResult: EdicionResultado | null = null;
    try {
      switch (action.tipo) {
        case 'entrada': {
          const costo = this.movimientoCosto();
          if (costo !== null && !(costo >= 0)) {
            this.error.set('El costo no puede ser negativo');
            return;
          }
          await this.stockService.registrarEntrada(
            action.productoId,
            this.movimientoCantidad() ?? 0,
            costo ?? 0,
            this.movimientoMotivo() || undefined,
          );
          break;
        }
        case 'salida': {
          const ubicacion = this.salidaUbicacion();
          const loteIndex = this.selectedLoteIndex();
          if (ubicacion === null || loteIndex === null) {
            this.error.set('Elija la ubicación y el lote para el traslado');
            return;
          }
          const lote = this.lotesDeUbicacion()[loteIndex - 1];
          await this.stockService.registrarSalida(
            action.productoId,
            this.movimientoCantidad() ?? 0,
            this.movimientoMotivo() || undefined,
            undefined,
            ubicacion,
            lote.id,
          );
          break;
        }
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
          const nombre = this.editarNombre();
          const motivo = this.movimientoMotivo();
          const cantidad = this.movimientoCantidad();
          if (!nombre.trim()) {
            this.error.set('El nombre del producto es obligatorio');
            return;
          }
          if (!motivo.trim()) {
            this.error.set('El motivo es obligatorio');
            return;
          }
          if (cantidad === null) {
            // Decisión Fase 1: campo vacío → error visible, NUNCA zeroing
            // silencioso (antes se enviaba 0 vía `?? 0` sin avisar al usuario).
            this.error.set('La cantidad es obligatoria');
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
          // F4: guards de signo en la UI (el form usa novalidate).
          if (!(pv >= 0)) {
            this.error.set('El precio de venta no puede ser negativo');
            return;
          }
          if (!(pc >= 0)) {
            this.error.set('El costo no puede ser negativo');
            return;
          }
          const prod = this.productos().find((p) => p.id === action.productoId);
          // F8: sin lote activo (producto sin lotes con cantidad > 0) se guarda
          // con loteId null y el service materializa el "lote 0". La ubicación
          // sigue la misma semántica que la preselección de F7: la ubicación
          // con más stock (empate → almacén).
          const loteId = loteSel ? loteSel.id : null;
          const ubicacion =
            loteSel
              ? loteSel.ubicacion
              : (prod?.stock_almacen ?? 0) >= (prod?.stock_shop ?? 0)
                ? 'almacen'
                : 'shop';
          edicionResult = await this.stockService.registrarEditar(
            action.productoId,
            loteId,
            nombre,
            pv,
            pc,
            cantidad,
            motivo,
            ubicacion,
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
      this.salidaUbicacion.set(null);
      this.productoLotes.set([]);
      this.editarNombre.set('');
      this.editarPrecioVenta.set(null);
      this.editarPrecioCosto.set(null);
      await this.loadProductos();
      if (action.tipo === 'editar' && this.error() === null) {
        const actualizado = this.productos().find(
          (p) => p.id === action.productoId,
        );
        if (actualizado) {
          // F3: feedback claro del precio costo. Cuando el lote editado es el
          // frente FIFO, productos.precio_costo se actualizó. Cuando no lo es,
          // el costo quedó guardado en el lote pero la columna muestra el costo
          // del lote más viejo con stock (semántica FIFO) — se comunica para que
          // no parezca que "no se guardó".
          let costoMsg = '';
          if (edicionResult) {
            const costoProducto = edicionResult.costoProducto?.toFixed(2) ?? '—';
            if (edicionResult.esFront) {
              costoMsg = ` · Precio costo: $${costoProducto}`;
            } else {
              costoMsg = ` · Costo del lote: $${edicionResult.costoEditado.toFixed(2)} — Precio costo del producto sin cambios: $${costoProducto} (lote más viejo con stock)`;
            }
          }
          this._mostrarToast(
            `Stock guardado — Almacén: ${actualizado.stock_almacen} u · Tienda: ${actualizado.stock_shop} u${costoMsg}`,
          );
        }
      }
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Error al registrar movimiento',
      );
    } finally {
      this.procesandoMovimiento.set(false);
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
    this.salidaUbicacion.set(null);
    this.movimientoCantidad.set(null);
    this.movimientoCosto.set(null);
    this.movimientoMotivo.set('');
    this.editarNombre.set('');
    this.editarPrecioVenta.set(null);
    this.editarPrecioCosto.set(null);

    if (tipo === 'ajuste' || tipo === 'editar' || tipo === 'salida') {
      try {
        const lotes = await this.stockService.obtenerLotesPorProducto(productoId);
        this.productoLotes.set(lotes);
        if (lotes.length > 0 && tipo === 'editar') {
          const prod = this.productos().find((p) => p.id === productoId);
          const loteInicial = elegirLoteInicialEdicion(
            lotes,
            prod?.stock_almacen ?? 0,
            prod?.stock_shop ?? 0,
          );
          this.selectedLoteIndex.set(
            loteInicial ? lotes.indexOf(loteInicial) + 1 : 1,
          );
          this.editarNombre.set(prod?.nombre ?? '');
          this.editarPrecioVenta.set(prod?.precio_venta ?? 0);
          this.editarPrecioCosto.set(loteInicial?.precio_costo ?? 0);
          this.movimientoCantidad.set(loteInicial?.cantidad ?? 0);
        } else if (lotes.length > 0 && tipo === 'ajuste') {
          this.selectedLoteIndex.set(1);
        } else if (lotes.length === 0 && tipo === 'editar') {
          // F8: producto con stock > 0 en columnas pero sin NINGÚN lote con
          // cantidad > 0 (selector sin opciones). El form se prellena con los
          // datos del producto y se guarda con loteId null: el service
          // materializa el "lote 0" de forma atómica en su transacción.
          const prod = this.productos().find((p) => p.id === productoId);
          if (prod) {
            this.editarNombre.set(prod.nombre);
            this.editarPrecioVenta.set(prod.precio_venta);
            this.editarPrecioCosto.set(prod.precio_costo);
            this.movimientoCantidad.set(0);
          }
          this.selectedLoteIndex.set(null);
        }
        // salida: sin auto-selección — el usuario elige ubicación y lote (obligatorios)
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
  readonly procesandoMovimiento = signal(false);

  /** Conteo de lo que se eliminaría al borrar el producto (F9): movimientos,
   *  lotes, venta_lotes y bloqueos por historial (ventas/cuenta_cosas). null
   *  mientras no se cargó o si falló el conteo (fallback genérico en el HTML). */
  readonly eliminarConteo = signal<{
    movimientos: number;
    lotes: number;
    ventaLotes: number;
    ventas: number;
    cuentas: number;
  } | null>(null);
  readonly eliminarConteoLoading = signal(false);

  abrirNuevoProducto(): void {
    if (!this.esAdmin()) return;
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
    if (!this.esAdmin()) return;
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
    // F4: feedback temprano de precios/costos negativos (NaN-safe) antes de
    // llamar al servicio. El 0 es válido.
    if (!(this.formCosto()! >= 0)) {
      this.formError.set('El costo no puede ser negativo');
      return;
    }
    if (!(this.formPrecioVenta()! >= 0)) {
      this.formError.set('El precio de venta no puede ser negativo');
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

  async confirmarEliminar(id: number): Promise<void> {
    this.confirmandoEliminar.set(id);
    this.eliminarConteo.set(null);
    this.eliminarConteoLoading.set(true);
    try {
      this.eliminarConteo.set(
        await firstValueFrom(this.productoService.obtenerConteoEliminacion(id)),
      );
    } catch {
      // Fallback genérico en el HTML: no se pudo calcular el alcance, se
      // conserva el comportamiento previo (confirmar sin detalle).
      this.eliminarConteo.set(null);
    } finally {
      this.eliminarConteoLoading.set(false);
    }
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(null);
    this.eliminarConteo.set(null);
    this.eliminarConteoLoading.set(false);
  }

  async ejecutarEliminar(): Promise<void> {
    const id = this.confirmandoEliminar();
    if (id === null) return;

    // F9: doble guard de UX — el servicio igual bloquea ventas/cuentas (F1),
    // pero no dejamos intentar borrar un producto que sabemos que no se puede.
    if (
      (this.eliminarConteo()?.ventas ?? 0) > 0 ||
      (this.eliminarConteo()?.cuentas ?? 0) > 0
    ) {
      this.error.set(
        'No se puede eliminar: el producto tiene ventas o cuenta casas asociadas',
      );
      return;
    }

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

/**
 * F7: elige el lote inicial del formulario "Editar" filtrando por la ubicación
 * donde el producto concentra su stock:
 * - si hay stock en ambas ubicaciones, la principal es la de mayor stock
 *   (empate → 'almacen', la ubicación primaria de la app);
 * - si la ubicación principal no tiene lotes (dato legacy divergente), cae al
 *   frente FIFO global.
 */
export function elegirLoteInicialEdicion(
  lotes: LoteStock[],
  stockAlmacen: number,
  stockShop: number,
): LoteStock | null {
  if (lotes.length === 0) return null;
  const ubicacionPrincipal: 'almacen' | 'shop' =
    stockAlmacen >= stockShop ? 'almacen' : 'shop';
  return (
    lotes.find((l) => l.ubicacion === ubicacionPrincipal) ?? lotes[0]
  );
}
