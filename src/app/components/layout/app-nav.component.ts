import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JornadaService } from '../../services/jornada.service';

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
    this.showCloseModal.set(true);
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
    this.cerrarError.set(null);
  }

  confirmarCierre(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.auth.usuario()?.id;

    if (!j || uid === undefined) return;
    const sr = j.saldo_esperado;

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, sr, uid).subscribe({
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
