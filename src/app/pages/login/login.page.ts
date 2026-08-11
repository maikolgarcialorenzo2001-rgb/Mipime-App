import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { ArqueoBilletesFormComponent } from '../../components/arqueo-billetes-form/arqueo-billetes-form.component';
import type { Jornada, ArqueoCajaEntry } from '../../models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ErrorAlertComponent, ArqueoBilletesFormComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly jornadaService = inject(JornadaService);
  private readonly _electronFileService = inject(ElectronFileService);

  readonly username = signal('');
  readonly password = signal('');
  readonly loginError = signal<string | null>(null);
  readonly cargando = signal(false);

  /** Modal de reapertura — se muestra para CUALQUIER usuario autenticado si hay jornada abierta */
  readonly showReopenModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);
  readonly jornadaPendiente = signal<Jornada | null>(null);

  /** Modal de arqueo — paso intermedio entre "Cerrar y guardar" y el cierre efectivo */
  readonly showArqueoModal = signal(false);

  /** Entries de arqueo emitidos por <app-arqueo-billetes-form> (solo cantidad > 0). */
  readonly arqueoEntries = signal<ArqueoCajaEntry[]>([]);

  readonly arqueoTotal = computed(() =>
    this.arqueoEntries().reduce((sum, entry) => sum + entry.subtotal, 0),
  );

  readonly diferencia = computed(() => {
    return this.jornadaService.totalEnCaja() - this.arqueoTotal();
  });

  async onSubmit(): Promise<void> {
    this.loginError.set(null);
    this.cargando.set(true);

    try {
      await firstValueFrom(this.auth.login(this.username(), this.password()));

      // Si hay una jornada abierta (de hoy o de días previos), ofrecer reanudar
      const abierta = await firstValueFrom(this.jornadaService.obtenerAbierta());
      if (abierta) {
        this.jornadaPendiente.set(abierta);
        this.showReopenModal.set(true);
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
    this.jornadaPendiente.set(null);
    this.router.navigate(['/pos']);
  }

  /** Cerrar y guardar — abre el modal de arqueo; el cierre efectivo ocurre en confirmarArqueoYCierre */
  cerrarYGuardar(): void {
    const j = this.jornadaPendiente();
    if (!j) return;

    this.cerrarError.set(null);
    this.arqueoEntries.set([]);
    // Refresca el totalEnCaja recalculado antes de mostrar el arqueo (en login reciente puede estar en 0)
    this.jornadaService.refreshJornadaAbierta();
    this.showReopenModal.set(false);
    this.showArqueoModal.set(true);
  }

  /** Volver al modal de reapertura sin cerrar nada */
  cancelarArqueo(): void {
    this.showArqueoModal.set(false);
    this.showReopenModal.set(true);
  }

  /** Confirmar arqueo y cerrar la jornada con los entries contados (patrón app-nav.confirmarCierre) */
  confirmarArqueoYCierre(): void {
    const j = this.jornadaPendiente();
    const uid = this.auth.usuario()?.id;

    if (!j || uid === undefined) return;

    const entries = this.arqueoEntries();

    if (entries.length === 0) {
      this.cerrarError.set('Ingresa la cantidad de al menos una denominación');
      return;
    }

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, uid, entries).subscribe({
      next: () => {
        this.showArqueoModal.set(false);
        this.jornadaPendiente.set(null);
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

  /** Formatea una fecha ISO (YYYY-MM-DD) como DD-MM para el modal. */
  formatearFecha(fecha: string): string {
    const [, mes, dia] = fecha.split('-');
    return `${dia}-${mes}`;
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

  onCloseArqueoBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      // No permitir cerrar con click en backdrop — debe confirmar o cancelar
    }
  }

  onCloseArqueoKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // No permitir cerrar con Escape — debe confirmar o cancelar
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
