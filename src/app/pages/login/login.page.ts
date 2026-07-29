import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import type { Jornada } from '../../models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ErrorAlertComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly jornadaService = inject(JornadaService);
  private readonly _electronFileService = inject(ElectronFileService);

  readonly username = signal('');
  readonly password = signal('');
  readonly loginError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly cargando = signal(false);

  /** Modal de reapertura — solo se muestra si hay journa del mismo usuario */
  readonly showReopenModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);
  private _jornadaPendiente: Jornada | null = null;

  async onSubmit(): Promise<void> {
    this.loginError.set(null);
    this.successMessage.set(null);
    this.cargando.set(true);

    try {
      const user = await firstValueFrom(this.auth.login(this.username(), this.password()));

      // Si hay una jornada abierta, verificar ownership
      const abierta = await firstValueFrom(this.jornadaService.obtenerAbierta());
      if (abierta) {
        const result = await this.jornadaService.autoCerrarSiOtroUsuario(user);
        if (result === null) {
          // Jornada de otro usuario fue auto-cerrada → descargar Excel + toast
          this._descargarExcel(abierta.id, abierta);
          this.successMessage.set('Jornada anterior cerrada automáticamente ✓');
          setTimeout(() => this.router.navigate(['/pos']), 1500);
        } else {
          // Jornada del MISMO usuario → modal de reapertura
          this._jornadaPendiente = result;
          this.showReopenModal.set(true);
        }
      } else {
        this.router.navigate(['/pos']);
      }
    } catch (e) {
      this.loginError.set(e instanceof Error ? e.message : 'Error al iniciar sesión');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Reabrir — jornada queda abierta, navegar a /pos */
  reabrirJornada(): void {
    this.showReopenModal.set(false);
    this._jornadaPendiente = null;
    this.router.navigate(['/pos']);
  }

  /** Cerrar y guardar — cerrar la jornada, descargar Excel, navegar a /pos */
  cerrarYGuardar(): void {
    const j = this._jornadaPendiente;
    if (!j) return;

    const uid = j.user_apertura_id ?? 0;

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, j.saldo_esperado, uid).subscribe({
      next: () => {
        this.showReopenModal.set(false);
        this._jornadaPendiente = null;
        this.cerrando.set(false);
        this._descargarExcel(j.id, j);
        this.router.navigate(['/pos']);
      },
      error: (err: unknown) => {
        this.cerrando.set(false);
        this.cerrarError.set(
          err instanceof Error ? err.message : 'Error al cerrar la jornada',
        );
      },
    });
  }

  onCloseReopenBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      // No permitir cerrar con click en backdrop — debe elegir
    }
  }

  onCloseReopenKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // No permitir cerrar con Escape — debe elegir
    }
  }

  private _descargarExcel(jornadaId: number, _jornada: { fecha: string; id: number }): void {
    this.jornadaService.obtenerReporte(jornadaId).subscribe({
      next: (reporte) => {
        if (!reporte) return;
        // Solo Blob download: ElectronFileService ya guardó en JornadaService
        this._electronFileService.downloadBlob(reporte.content_base64, reporte.filename);
      },
    });
  }
}
