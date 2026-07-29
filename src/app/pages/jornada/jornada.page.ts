import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE } from '../../services/database';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { JornadaSummaryCardComponent } from '../../components/jornada-summary-card/jornada-summary-card.component';
import type { Venta, DetalleVenta } from '../../models/venta';
import type { Movimiento } from '../../models/movimiento';
import type { StockMovimiento } from '../../models/stock-movimiento';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';

@Component({
  selector: 'app-jornada-page',
  imports: [ErrorAlertComponent, EmptyStateComponent, JornadaSummaryCardComponent, DatePipe],
  templateUrl: './jornada.page.html',
  styleUrl: './jornada.page.css',
})
export class JornadaPage {
  protected readonly jornadaService = inject(JornadaService);
  private readonly _authService = inject(AuthService);
  private readonly _db = inject(DATABASE);

  readonly error = signal<string | null>(null);

  /** Daily table data */
  readonly ventasDelDia = signal<Venta[]>([]);
  readonly movimientosDelDia = signal<Movimiento[]>([]);
  readonly mermasDelDia = signal<StockMovimiento[]>([]);
  readonly dailyLoading = signal(false);
  readonly productosMap = signal<Map<number, string>>(new Map());
  readonly detallesPorVenta = signal<Map<number, DetalleVenta[]>>(new Map());

  /** Movimiento form */
  readonly tipo = signal<'gasto' | 'ingreso_extra' | 'compra_divisa'>('gasto');
  readonly descripcion = signal('');
  readonly monto = signal(0);
  readonly divisaTipo = signal<'USD' | 'EUR'>('USD');
  readonly montoDivisa = signal(0);
  readonly tasaCambio = signal(0);
  readonly totalCup = computed(() => this.montoDivisa() * this.tasaCambio());
  readonly registrando = signal(false);
  readonly formError = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  /** Denomination form — signal puro, como quantity-input de POS */
  readonly DENOMINACIONES = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1] as const;
  readonly arqueoForm = signal<Record<number, number>>(
    Object.fromEntries(this.DENOMINACIONES.map(d => [d, 0])) as Record<number, number>,
  );
  readonly soloNumeros = signal(false);

  readonly showOptionalDenoms = signal(false);

  readonly denominacionesVisibles = computed(() =>
    this.showOptionalDenoms()
      ? [...this.DENOMINACIONES]
      : this.DENOMINACIONES.filter(d => d !== 1 && d !== 3),
  );

  readonly arqueoTotal = computed(() => {
    const f = this.arqueoForm();
    return this.denominacionesVisibles().reduce((sum, d) => sum + d * (f[d] ?? 0), 0);
  });

  readonly totalEnCaja = computed(() => {
    const j = this.jornadaService.jornadaAbierta();
    if (!j) return 0;
    const totalEfectivo = this.ventasDelDia()
      .filter(v => v.forma_pago === 'efectivo')
      .reduce((sum, v) => sum + v.total, 0);
    const totalIngresosExtra = this.movimientosDelDia()
      .filter(m => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalGastos = this.movimientosDelDia()
      .filter(m => m.tipo === 'gasto' || m.tipo === 'compra_divisa')
      .reduce((sum, m) => sum + m.monto, 0);
    return j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos;
  });

  readonly diferencia = computed(() => {
    return this.totalEnCaja() - this.arqueoTotal();
  });

  readonly usuario = this._authService.usuario;

  constructor() {
    effect(() => {
      // Cargar datos de la tabla diaria cuando cambia la jornada
      this._cargarDatosDiarios();
    });
  }

  private async _cargarDatosDiarios(): Promise<void> {
    const j = this.jornadaService.jornadaAbierta();
    if (!j) {
      this.ventasDelDia.set([]);
      this.movimientosDelDia.set([]);
      this.mermasDelDia.set([]);
      this.productosMap.set(new Map());
      this.detallesPorVenta.set(new Map());
      return;
    }

    this.dailyLoading.set(true);
    try {
      const [ventas, movimientos, mermas, productos] = await Promise.all([
        this._db.sql<Venta>(
          'SELECT * FROM ventas WHERE jornada_id = ? ORDER BY id',
          [j.id],
        ),
        this._db.sql<Movimiento>(
          'SELECT * FROM movimientos WHERE jornada_id = ? ORDER BY id',
          [j.id],
        ),
        this._db.sql<StockMovimiento>(
          "SELECT * FROM stock_movimientos WHERE jornada_id = ? AND tipo = 'merma' ORDER BY created_at",
          [j.id],
        ),
        this._db.sql<{ id: number; nombre: string }>(
          'SELECT id, nombre FROM productos',
        ),
      ]);
      this.ventasDelDia.set(ventas);
      this.movimientosDelDia.set(movimientos);
      this.mermasDelDia.set(mermas);

      // Fetch detalles for ventas
      const detallesMap = new Map<number, DetalleVenta[]>();
      if (ventas.length > 0) {
        const ventaIds = ventas.map((v) => v.id);
        const placeholders = ventaIds.map(() => '?').join(', ');
        const detalles = await this._db.sql<DetalleVenta>(
          `SELECT * FROM detalle_ventas WHERE venta_id IN (${placeholders}) ORDER BY id`,
          ventaIds,
        );
        for (const d of detalles) {
          const arr = detallesMap.get(d.venta_id) ?? [];
          arr.push(d);
          detallesMap.set(d.venta_id, arr);
        }
      }
      this.detallesPorVenta.set(detallesMap);
      const pMap = new Map<number, string>();
      for (const p of productos) {
        pMap.set(p.id, p.nombre);
      }
      this.productosMap.set(pMap);
    } catch {
      this.ventasDelDia.set([]);
      this.movimientosDelDia.set([]);
      this.mermasDelDia.set([]);
      this.detallesPorVenta.set(new Map());
    } finally {
      this.dailyLoading.set(false);
    }
  }

  get isAdmin(): boolean {
    return this._authService.hasRole('admin');
  }

  get puedeCerrar(): boolean {
    const j = this.jornadaService.jornadaAbierta();
    return j !== null && j.estado === 'abierta';
  }

  registrarMovimiento(): void {
    const tipo = this.tipo();
    const desc = tipo === 'compra_divisa'
      ? `Compra ${this.divisaTipo()} ${this.montoDivisa()} @ ${this.tasaCambio()}`
      : this.descripcion().trim();

    if (tipo !== 'compra_divisa' && !desc) {
      this.formError.set('La descripción es requerida');
      return;
    }

    let monto = this.monto();
    let divisa: { divisaTipo: 'USD' | 'EUR'; montoDivisa: number; tasaCambio: number } | undefined;

    if (tipo === 'compra_divisa') {
      if (this.montoDivisa() <= 0) {
        this.formError.set('El monto en divisa debe ser mayor a 0');
        return;
      }
      if (this.tasaCambio() <= 0) {
        this.formError.set('La tasa de cambio debe ser mayor a 0');
        return;
      }
      monto = this.totalCup();
      divisa = { divisaTipo: this.divisaTipo(), montoDivisa: this.montoDivisa(), tasaCambio: this.tasaCambio() };
    } else if (monto <= 0) {
      this.formError.set('El monto debe ser mayor a 0');
      return;
    }

    const j = this.jornadaService.jornadaAbierta();
    if (!j) return;

    this.formError.set(null);
    this.registrando.set(true);

    this.jornadaService.registrarMovimiento(j.id, tipo, desc, monto, divisa).subscribe({
      next: () => {
        this.registrando.set(false);
        this.descripcion.set('');
        this.monto.set(0);
        this.divisaTipo.set('USD');
        this.montoDivisa.set(0);
        this.tasaCambio.set(0);
        this.tipo.set('gasto');
        this.jornadaService.refreshJornadaAbierta();
      },
      error: (err: unknown) => {
        this.registrando.set(false);
        this.formError.set(err instanceof Error ? err.message : 'Error al registro');
      },
    });
  }

  /** Maneja input del usuario: solo dígitos, actualiza signal (como quantity-input de POS) */
  onDenomInput(denom: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const soloDigitos = input.value.replace(/[^0-9]/g, '');
    const cantidad = soloDigitos === '' ? 0 : parseInt(soloDigitos, 10);

    // Forzar DOM al valor limpio
    input.value = String(cantidad);

    // Actualizar signal (única fuente de verdad)
    this.arqueoForm.update(b => ({ ...b, [denom]: cantidad }));
  }

  filtrarTecla(event: KeyboardEvent): void {
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
      'Enter', 'Escape',
    ];
    if (teclasPermitidas.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      this.soloNumeros.set(true);
      setTimeout(() => this.soloNumeros.set(false), 1800);
    }
  }

  abrirModalCierre(): void {
    this.cerrarError.set(null);
    this.showOptionalDenoms.set(false);
    this.soloNumeros.set(false);
    this.arqueoForm.set(
      Object.fromEntries(this.DENOMINACIONES.map(d => [d, 0])) as Record<number, number>,
    );
    this.showCloseModal.set(true);
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
  }

  confirmarCierre(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.usuario()?.id;

    if (!j || uid === undefined) return;

    // Build arqueo entries from signal (only entries with cantidad > 0)
    const raw = this.arqueoForm();
    const entries: ArqueoCajaEntry[] = [];
    for (const d of this.denominacionesVisibles()) {
      const cantidad = raw[d] ?? 0;
      if (cantidad > 0) {
        entries.push({ denominacion: d, cantidad, subtotal: d * cantidad });
      }
    }

    if (entries.length === 0) {
      this.cerrarError.set('Ingresa la cantidad de al menos una denominación');
      return;
    }

    const saldoReal = this.arqueoTotal();
    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, saldoReal, uid, entries).subscribe({
      next: () => {
        this.showCloseModal.set(false);
        this.cerrando.set(false);

        // Descargar Excel
        this._descargarExcel(j.id);
      },
      error: (err: unknown) => {
        this.cerrarError.set(
          err instanceof Error ? err.message : 'Error al cerrar la jornada',
        );
        this.cerrando.set(false);
      },
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarModalCierre();
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrarModalCierre();
    }
  }

  private _descargarExcel(jornadaId: number): void {
    this.jornadaService.obtenerReporte(jornadaId).subscribe({
      next: (reporte) => {
        if (!reporte) return;

        const byteCharacters = atob(reporte.content_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = reporte.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }
}
