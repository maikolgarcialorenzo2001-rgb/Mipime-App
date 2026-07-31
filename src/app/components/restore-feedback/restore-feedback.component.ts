import { Component, computed, inject } from '@angular/core';
import { DbStatusService } from '../../services/db-status.service';

const RESTORE_FROM_LABELS: Record<RestoreFrom, string> = {
  recover: 'recuperada en el lugar',
  rodante: 'copia rodante',
  timestamped: 'copia con fecha',
  adopt: 'backup adoptado',
};

/**
 * Aviso TRANSITORIO de restauración (T9, R4): superficie distinta de
 * db-error (bloqueante full-screen). Toast anclado abajo-derecha que NUNCA
 * bloquea la app: describe qué se restauró, desde cuándo y cuánto se perdió.
 * Descartable por botón (transient); se alimenta de dbStatus.restoreInfo.
 */
@Component({
  selector: 'app-restore-feedback',
  templateUrl: './restore-feedback.component.html',
  styleUrl: './restore-feedback.component.css',
})
export class RestoreFeedbackComponent {
  private readonly dbStatus = inject(DbStatusService);

  readonly restoreInfo = this.dbStatus.restoreInfo;

  readonly originLabel = computed(() => {
    const info = this.dbStatus.restoreInfo();
    return info ? RESTORE_FROM_LABELS[info.from] : '';
  });

  readonly whenLabel = computed(() => {
    const info = this.dbStatus.restoreInfo();
    if (!info?.when) return '';
    const d = new Date(info.when);
    if (Number.isNaN(d.getTime())) return '';
    // es-AR fijo: formato determinístico (d/m/yyyy, hora 24h) para toda la
    // app (UI en español) e independiente del locale del SO (review M2).
    return d.toLocaleString('es-AR');
  });

  /** Ventana de pérdida legible; null si no aplica (0 o sin info). */
  readonly lostWindowLabel = computed(() => {
    const info = this.dbStatus.restoreInfo();
    if (!info || info.lostWindowMs <= 0) return null;
    const min = Math.round(info.lostWindowMs / 60000);
    if (min < 60) return `${min} min`;
    return `${Math.round(min / 60)} h`;
  });

  descartar(): void {
    this.dbStatus.setRestoreInfo(null);
  }
}
