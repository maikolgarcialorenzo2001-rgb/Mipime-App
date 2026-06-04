import { Component, inject, signal } from '@angular/core';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { JornadaSummaryCardComponent } from '../../components/jornada-summary-card/jornada-summary-card.component';
import type { Jornada } from '../../models';

@Component({
  selector: 'app-jornada-page',
  imports: [ErrorAlertComponent, EmptyStateComponent, JornadaSummaryCardComponent],
  templateUrl: './jornada.page.html',
  styleUrl: './jornada.page.css',
})
export class JornadaPage {
  private readonly _jornadaService = inject(JornadaService);
  private readonly _authService = inject(AuthService);

  readonly jornada = signal<Jornada | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly saldoReal = signal<number | null>(null);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  readonly usuario = this._authService.usuario;

  constructor() {
    this._cargarJornada();
  }

  get isAdmin(): boolean {
    return this._authService.hasRole('admin');
  }

  get puedeCerrar(): boolean {
    return this.isAdmin && this.jornada() !== null && this.jornada()!.estado === 'abierta';
  }

  abrirModalCierre(): void {
    this.cerrarError.set(null);
    this.saldoReal.set(null);
    this.showCloseModal.set(true);
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
  }

  onSaldoRealChange(value: string): void {
    const num = value === '' ? null : Number(value);
    this.saldoReal.set(Number.isNaN(num) ? null : num);
  }

  confirmarCierre(): void {
    const j = this.jornada();
    const sr = this.saldoReal();
    const uid = this.usuario()?.id;

    if (!j || sr === null || uid === undefined) return;

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this._jornadaService.cerrar(j.id, sr, uid).subscribe({
      next: () => {
        // Recargar jornada (ahora cerrada)
        this._cargarJornada();
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

  private _cargarJornada(): void {
    this.cargando.set(true);
    this.error.set(null);

    this._jornadaService.obtenerAbierta().subscribe({
      next: (j) => {
        this.jornada.set(j);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Error al cargar la jornada');
        this.cargando.set(false);
      },
    });
  }

  private _descargarExcel(jornadaId: number): void {
    this._jornadaService.obtenerReporte(jornadaId).subscribe({
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
