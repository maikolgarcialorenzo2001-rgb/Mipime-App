import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE } from '../../services/database';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { JornadaSummaryCardComponent } from '../../components/jornada-summary-card/jornada-summary-card.component';
import type { Venta } from '../../models/venta';
import type { Movimiento } from '../../models/movimiento';
import type { StockMovimiento } from '../../models/stock-movimiento';

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

  /** Movimiento form */
  readonly tipo = signal<'gasto' | 'ingreso_extra'>('gasto');
  readonly descripcion = signal('');
  readonly monto = signal(0);
  readonly registrando = signal(false);
  readonly formError = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  /** Modal de reapertura */
  readonly showReopenModal = signal(false);
  readonly reopening = signal(false);

  /** Guard: prevent reopen modal from showing more than once per jornada session */
  private _reopenModalShown = false;

  readonly usuario = this._authService.usuario;

  constructor() {
    effect(() => {
      const j = this.jornadaService.jornadaAbierta();
      const loading = this.jornadaService.jornadaCargando();
      const user = this.usuario();

      // Cuando termina la carga y hay jornada abierta del mismo usuario → mostrar modal
      if (j && !loading && user && j.estado === 'abierta' && !this._reopenModalShown) {
        const aperturaId = j.user_apertura_id;
        // Mismo usuario o legacy (sin user_apertura_id) → puede reabrir
        if (aperturaId === null || aperturaId === user.id) {
          this._reopenModalShown = true;
          this.showReopenModal.set(true);
        }
      }

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
      return;
    }

    this.dailyLoading.set(true);
    try {
      const [ventas, movimientos, mermas] = await Promise.all([
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
      ]);
      this.ventasDelDia.set(ventas);
      this.movimientosDelDia.set(movimientos);
      this.mermasDelDia.set(mermas);
    } catch {
      this.ventasDelDia.set([]);
      this.movimientosDelDia.set([]);
      this.mermasDelDia.set([]);
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
    const desc = this.descripcion().trim();
    const monto = this.monto();

    if (!desc) {
      this.formError.set('La descripción es requerida');
      return;
    }

    if (monto <= 0) {
      this.formError.set('El monto debe ser mayor a 0');
      return;
    }

    const j = this.jornadaService.jornadaAbierta();
    if (!j) return;

    this.formError.set(null);
    this.registrando.set(true);

    this.jornadaService.registrarMovimiento(j.id, this.tipo(), desc, monto).subscribe({
      next: () => {
        this.registrando.set(false);
        this.descripcion.set('');
        this.monto.set(0);
        this.tipo.set('gasto');
        this.jornadaService.refreshJornadaAbierta();
      },
      error: (err: unknown) => {
        this.registrando.set(false);
        this.formError.set(err instanceof Error ? err.message : 'Error al registrar movimiento');
      },
    });
  }

  abrirModalCierre(): void {
    this.cerrarError.set(null);
    this.showCloseModal.set(true);
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
  }

  confirmarCierre(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.usuario()?.id;

    if (!j || uid === undefined) return;
    const sr = j.saldo_esperado;

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, sr, uid).subscribe({
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

  /** Reapertura — mostrar modal */
  abrirModalReapertura(): void {
    this.showReopenModal.set(true);
  }

  /** Reapertura — reabrir (jornada queda abierta) */
  reabrirJornada(): void {
    this.showReopenModal.set(false);
  }

  /** Reapertura — cerrar y guardar */
  cerrarYGuardar(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.usuario()?.id;

    if (!j || uid === undefined) return;

    this.showReopenModal.set(false);
    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, j.saldo_esperado, uid).subscribe({
      next: () => {
        this.cerrando.set(false);
        this._descargarExcel(j.id);
      },
      error: (err: unknown) => {
        this.cerrando.set(false);
        this.cerrarError.set(
          err instanceof Error ? err.message : 'Error al cerrar la jornada',
        );
      },
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarModalCierre();
    }
  }

  onCloseReopenBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.showReopenModal.set(false);
    }
  }

  onCloseReopenKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.showReopenModal.set(false);
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
