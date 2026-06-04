import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { EstadoBadgeComponent } from '../../components/estado-badge/estado-badge.component';
import type { Jornada } from '../../models';

@Component({
  selector: 'app-historial',
  imports: [
    CurrencyPipe,
    ErrorAlertComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    EstadoBadgeComponent,
  ],
  templateUrl: './historial.page.html',
})
export class HistorialPage implements OnInit {
  private readonly _jornadaService = inject(JornadaService);

  readonly jornadas = signal<Jornada[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this._jornadaService.historial().subscribe({
      next: (jornadas) => {
        this.jornadas.set(jornadas);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(
          err instanceof Error ? err.message : 'Error al cargar el historial',
        );
        this.loading.set(false);
      },
    });
  }

  descargarExcel(_jornada: Jornada): void {
    // TODO: 4.3 — JornadaService.cerrar() guarda el Excel,
    // acá lo recuperamos de jornada_reportes y lo descargamos
  }

  verPreview(_jornada: Jornada): void {
    // TODO: 4.3 — Mostrar el Excel in-app (tabla readonly)
  }
}
