import { Component, computed, inject } from '@angular/core';
import { DbStatusService } from '../../services/db-status.service';

/**
 * Pantalla bloqueante de arranque fatal (T6, R1/R5): la DB nativa no se
 * pudo abrir/recuperar. Publica el diagnóstico completo (RESOLVED-RISK-2)
 * y permite copiarlo para reportar al desarrollador. Estilo espejo de
 * ttl-expired (Tailwind, overlay full-screen z-50).
 */
@Component({
  selector: 'app-db-error',
  templateUrl: './db-error.component.html',
  styleUrl: './db-error.component.css',
})
export class DbErrorComponent {
  private readonly dbStatus = inject(DbStatusService);

  readonly diagnostics = this.dbStatus.fatal;

  readonly diagnosticsText = computed(() => {
    const diag = this.dbStatus.fatal();
    return diag ? JSON.stringify(diag, null, 2) : '';
  });

  async copiarDiagnostico(): Promise<void> {
    const text = this.diagnosticsText();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // MINOR-4: el portapapeles puede rechazar (permisos/privacidad);
      // no es fatal — evitar ruido en consola.
    }
  }
}
