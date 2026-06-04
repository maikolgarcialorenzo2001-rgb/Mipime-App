import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { EstadoBadgeComponent } from '../../components/estado-badge/estado-badge.component';
import type { Jornada } from '../../models';

export interface DiaCalendario {
  day: number | null;
  dateStr: string | null;
  jornada?: Jornada;
  isToday: boolean;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-historial',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ErrorAlertComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    EstadoBadgeComponent,
  ],
  templateUrl: './historial.page.html',
})
export class HistorialPage {
  private readonly _jornadaService = inject(JornadaService);

  readonly jornadas = signal<Jornada[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentMonth = signal(new Date());
  readonly selectedDateStr = signal<string | null>(null);

  /** Mapa fecha → jornada para lookup O(1). */
  private readonly _jornadasPorFecha = computed(() => {
    const map = new Map<string, Jornada>();
    for (const j of this.jornadas()) {
      map.set(j.fecha, j);
    }
    return map;
  });

  /** Día seleccionado con su jornada (si existe). */
  readonly diaSeleccionado = computed<{ fecha: string; jornada?: Jornada } | null>(() => {
    const ds = this.selectedDateStr();
    if (!ds) return null;
    return { fecha: ds, jornada: this._jornadasPorFecha().get(ds) };
  });

  readonly mesTitulo = computed(() =>
    this.currentMonth().toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    }),
  );

  readonly diasSemana = computed(() => {
    // Tomamos el lunes de la semana actual para obtener los nombres
    const d = new Date(this.currentMonth());
    d.setDate(1); // cualquier día, usamos el 1° del mes
    const dias: string[] = [];
    for (let i = 0; i < 7; i++) {
      // Ajustamos para que empiece en lunes (i=1 → martes, etc.)
      const day = new Date(2026, 0, 5 + i); // 5-ene-2026 es lunes
      dias.push(
        day.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
      );
    }
    return dias;
  });

  readonly grid = computed<DiaCalendario[]>(() => {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const mes = month.getMonth();

    const primerDia = new Date(year, mes, 1);
    const ultimoDia = new Date(year, mes + 1, 0);
    const totalDias = ultimoDia.getDate();

    // 0=domingo, 1=lunes, ..., 6=sábado
    // Queremos que la semana empiece en lunes → ajustamos
    let startOffset = primerDia.getDay() - 1;
    if (startOffset < 0) startOffset = 6; // domingo → último

    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const jornadasMap = this._jornadasPorFecha();

    const cells: DiaCalendario[] = [];

    // Celdas vacías antes del día 1
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateStr: null, isToday: false, isCurrentMonth: false });
    }

    // Días del mes
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(year, mes, d);
      const dateStr = date.toISOString().split('T')[0];
      const jornada = jornadasMap.get(dateStr);

      cells.push({
        day: d,
        dateStr,
        jornada,
        isToday: dateStr === hoyStr,
        isCurrentMonth: true,
      });
    }

    // Completar la última semana
    const remaining = 7 - (cells.length % 7 || 7);
    for (let i = 0; i < remaining; i++) {
      cells.push({ day: null, dateStr: null, isToday: false, isCurrentMonth: false });
    }

    return cells;
  });

  constructor() {
    this._cargarJornadas();
  }

  mesAnterior(): void {
    this.currentMonth.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.selectedDateStr.set(null);
  }

  mesSiguiente(): void {
    this.currentMonth.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.selectedDateStr.set(null);
  }

  seleccionarDia(dateStr: string | null): void {
    this.selectedDateStr.update((prev) => (prev === dateStr ? null : dateStr));
  }

  descargarExcel(_jornada: Jornada): void {
    // TODO: 4.3 — JornadaService.cerrar() guarda el Excel,
    // acá lo recuperamos de jornada_reportes y lo descargamos
  }

  verPreview(_jornada: Jornada): void {
    // TODO: 4.3 — Mostrar el Excel in-app (tabla readonly)
  }

  private _cargarJornadas(): void {
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
}
