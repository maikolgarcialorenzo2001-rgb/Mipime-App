import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JornadaService } from '../../services/jornada.service';
import { ThemeService } from '../../services/theme.service';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-nav.component.html',
  styleUrl: './app-nav.component.css',
})
export class AppNavComponent {
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthService);
  readonly jornadaService = inject(JornadaService);
  readonly themeService = inject(ThemeService);

  protected readonly auth = this._auth;

  /** Modal de apertura */
  readonly showOpenModal = signal(false);
  readonly montoInicial = signal(0);
  readonly abriendo = signal(false);
  readonly abrirError = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  /** Denomination form */
  readonly DENOMINACIONES = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1] as const;
  readonly arqueoForm = signal<Record<number, number>>({
    5000: 0, 2000: 0, 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 3: 0, 1: 0,
  });
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

  readonly diferencia = computed(() => {
    const esperado = this.jornadaService.jornadaAbierta()?.saldo_esperado ?? 0;
    return esperado - this.arqueoTotal();
  });

  get puedeAbrir(): boolean {
    return !this.jornadaService.jornadaCargando() && this.jornadaService.jornadaAbierta() === null;
  }

  get puedeCerrar(): boolean {
    const j = this.jornadaService.jornadaAbierta();
    return (
      !this.jornadaService.jornadaCargando() &&
      j !== null &&
      j.estado === 'abierta'
    );
  }

  // ── Apertura ──────────────────────────────────────────

  abrirModalApertura(): void {
    this.abrirError.set(null);
    this.montoInicial.set(0);
    this.showOpenModal.set(true);
  }

  cerrarModalApertura(): void {
    this.showOpenModal.set(false);
    this.abrirError.set(null);
  }

  onMontoInicialChange(value: string): void {
    const num = value === '' ? 0 : Number(value);
    this.montoInicial.set(Number.isNaN(num) ? 0 : num);
  }

  confirmarApertura(): void {
    const monto = this.montoInicial();

    this.abriendo.set(true);
    this.abrirError.set(null);

    this.jornadaService.abrir(monto).subscribe({
      next: () => {
        this.showOpenModal.set(false);
        this.abriendo.set(false);
      },
      error: (err: unknown) => {
        this.abrirError.set(
          err instanceof Error ? err.message : 'Error al abrir la jornada',
        );
        this.abriendo.set(false);
      },
    });
  }

  // ── Cierre ────────────────────────────────────────────

  abrirModalCierre(): void {
    this.cerrarError.set(null);
    this.arqueoForm.set({
      5000: 0, 2000: 0, 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 3: 0, 1: 0,
    });
    this.showOptionalDenoms.set(false);
    this.showCloseModal.set(true);
  }

  actualizarCantidad(denominacion: number, cantidad: number): void {
    this.arqueoForm.update(f => ({ ...f, [denominacion]: cantidad }));
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
    this.cerrarError.set(null);
  }

  confirmarCierre(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.auth.usuario()?.id;

    if (!j || uid === undefined) return;

    // Build arqueo entries from form (only entries with cantidad > 0)
    const entries: ArqueoCajaEntry[] = [];
    for (const d of this.denominacionesVisibles()) {
      const cantidad = this.arqueoForm()[d] ?? 0;
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

        // Descargar el reporte generado
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

  // ── Backdrop ──────────────────────────────────────────

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      if (this.showOpenModal()) this.cerrarModalApertura();
      if (this.showCloseModal()) this.cerrarModalCierre();
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showOpenModal()) this.cerrarModalApertura();
      if (this.showCloseModal()) this.cerrarModalCierre();
    }
  }

  // ── Internos ──────────────────────────────────────────

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

  logout(): void {
    this._auth.logout();
    this._router.navigateByUrl('/login');
  }
}
