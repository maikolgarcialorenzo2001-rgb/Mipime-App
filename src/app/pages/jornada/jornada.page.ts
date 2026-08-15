import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE } from '../../services/database';
import { CuentaCosasService } from '../../services/cuenta-cosa.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { JornadaSummaryCardComponent } from '../../components/jornada-summary-card/jornada-summary-card.component';
import type { Venta, DetalleVenta } from '../../models/venta';
import type { Movimiento } from '../../models/movimiento';
import type { StockMovimiento } from '../../models/stock-movimiento';
import type { CuentaCosa } from '../../models/cuenta-cosa';


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
  private readonly _cuentaCosasService = inject(CuentaCosasService);

  readonly error = signal<string | null>(null);

  /** Daily table data */
  readonly ventasDelDia = signal<Venta[]>([]);
  readonly movimientosDelDia = signal<Movimiento[]>([]);
  readonly mermasDelDia = signal<StockMovimiento[]>([]);
  readonly cuentasCosasDelDia = signal<CuentaCosa[]>([]);
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

  /** UI guard: deshabilitar botón si saldo en caja es insuficiente. */
  readonly saldoInsuficiente = computed(() => {
    const tipo = this.tipo();
    if (tipo !== 'gasto' && tipo !== 'compra_divisa') return false;
    const monto = tipo === 'compra_divisa' ? this.totalCup() : this.monto();
    return !this.jornadaService.saldoSuficientePara(monto);
  });
  readonly formError = signal<string | null>(null);
  readonly soloNumeros = signal(false);

  readonly totalGastos = computed(() =>
    this.movimientosDelDia()
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0),
  );

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
      this.cuentasCosasDelDia.set([]);
      this.productosMap.set(new Map());
      this.detallesPorVenta.set(new Map());
      return;
    }

    this.dailyLoading.set(true);
    try {
      const [ventas, movimientos, mermas, productos, cuentasCosas] = await Promise.all([
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
        this._cuentaCosasService.listarPorJornada(j.id),
      ]);
      this.ventasDelDia.set(ventas);
      this.movimientosDelDia.set(movimientos);
      this.mermasDelDia.set(mermas);
      this.cuentasCosasDelDia.set(cuentasCosas);

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
      this.cuentasCosasDelDia.set([]);
      this.detallesPorVenta.set(new Map());
    } finally {
      this.dailyLoading.set(false);
    }
  }

  get isAdmin(): boolean {
    return this._authService.hasRole('admin');
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
        this.formError.set(err instanceof Error ? err.message : 'Error al registrar');
      },
    });
  }


}
