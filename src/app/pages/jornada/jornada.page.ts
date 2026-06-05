import { Component, inject, signal } from '@angular/core';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { JornadaSummaryCardComponent } from '../../components/jornada-summary-card/jornada-summary-card.component';

@Component({
  selector: 'app-jornada-page',
  imports: [ErrorAlertComponent, EmptyStateComponent, JornadaSummaryCardComponent],
  templateUrl: './jornada.page.html',
  styleUrl: './jornada.page.css',
})
export class JornadaPage {
  protected readonly jornadaService = inject(JornadaService);
  private readonly _authService = inject(AuthService);

  readonly error = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  readonly usuario = this._authService.usuario;

  get isAdmin(): boolean {
    return this._authService.hasRole('admin');
  }

  get puedeCerrar(): boolean {
    const j = this.jornadaService.jornadaAbierta();
    return this.isAdmin && j !== null && j.estado === 'abierta';
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
