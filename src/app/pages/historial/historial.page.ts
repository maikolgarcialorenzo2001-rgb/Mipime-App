import { Component, computed, inject, signal, viewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PesosPipe } from '../../pipes/pesos.pipe';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { EstadoBadgeComponent } from '../../components/estado-badge/estado-badge.component';
import type { Jornada } from '../../models';
import type { JornadaReportData } from '../../services/excel.service';

export interface DiaCalendario {
  day: number | null;
  dateStr: string | null;
  jornadas: Jornada[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-historial',
  imports: [
    PesosPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ErrorAlertComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    EstadoBadgeComponent,
  ],
  templateUrl: './historial.page.html',
})
export class HistorialPage {
  private readonly _jornadaService = inject(JornadaService);
  private readonly _electronFileService = inject(ElectronFileService);

  readonly jornadas = signal<Jornada[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentMonth = signal(new Date());
  readonly selectedDateStr = signal<string | null>(null);

  /** Señal de carga para la exportación mensual. */
  readonly exportando = signal(false);

  /** Error de la exportación mensual. */
  readonly errorExport = signal<string | null>(null);

  /** Toast de confirmación. */
  readonly toastMessage = signal<string | null>(null);
  private _toastTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Controla la visibilidad del modal de vista previa. */
  readonly showPreview = signal(false);

  readonly previewBackdrop = viewChild<ElementRef<HTMLElement>>('previewBackdrop');

  private readonly _focusPreviewEffect = effect(() => {
    if (this.showPreview()) {
      setTimeout(() => this.previewBackdrop()?.nativeElement.focus());
    }
  });

  /** Controla la visibilidad del picker de rango de fechas. */
  readonly showRangePicker = signal(false);

  /** Fecha desde para exportar rango. */
  readonly rangeDesde = signal('');

  /** Fecha hasta para exportar rango. */
  readonly rangeHasta = signal('');

  /** Señal de carga para la exportación por rango. */
  readonly exportandoRango = signal(false);

  /** Jornada activa en el modal de vista previa. */
  readonly previewJornada = signal<Jornada | null>(null);

  /** Datos completos cargados para la vista previa. */
  readonly previewData = signal<JornadaReportData | null>(null);

  /** Señal de carga de datos de preview. */
  readonly previewLoading = signal(false);

  /** Detalles aplanados de productos vendidos para la tabla de preview. */
  readonly previewDetalles = computed(() => {
    const data = this.previewData();
    if (!data) return [];
    const items: {
      producto: string;
      cantidad: number;
      precioUnitario: number;
      precioBase: number | null;
      total: number;
      formaPago: string;
    }[] = [];
    for (const venta of data.ventas) {
      // Venta solo-money (cobro de pendiente, FR-7/AC8): sin detalles → fila
      // especial "Cobrar Pendiente #id" en lugar de quedar invisible en la
      // vista previa.
      if (venta.detalles.length === 0) {
        items.push({
          producto: `Cobrar Pendiente #${venta.cobro_de_venta_id ?? venta.id}`,
          cantidad: 1,
          precioUnitario: venta.total,
          precioBase: null,
          total: venta.total,
          formaPago: venta.forma_pago ?? 'efectivo',
        });
        continue;
      }
      for (const detalle of venta.detalles) {
        const info = data.productosMap?.get(detalle.producto_id);
        items.push({
          producto: info?.nombre ?? `Producto #${detalle.producto_id}`,
          cantidad: detalle.cantidad,
          precioUnitario: detalle.precio_unitario,
          precioBase: info?.precio_costo ?? null,
          total: detalle.subtotal,
          formaPago: venta.forma_pago ?? 'efectivo',
        });
      }
    }
    return items;
  });

  /** Movimientos de la jornada para la tabla de preview. */
  readonly previewMovimientos = computed(() => this.previewData()?.movimientos ?? []);

  /** `true` cuando el mes visible tiene al menos una jornada cerrada. */
  readonly tieneJornadasCerradas = computed(() => {
    const m = this.currentMonth();
    const lo = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().split('T')[0];
    const hi = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().split('T')[0];
    return this.jornadas().some((j) => j.estado === 'cerrada' && j.fecha >= lo && j.fecha <= hi);
  });

  /** Mapa fecha → jornada[] para lookup O(1). */
  private readonly _jornadasPorFecha = computed(() => {
    const map = new Map<string, Jornada[]>();
    for (const j of this.jornadas()) {
      const arr = map.get(j.fecha);
      if (arr) arr.push(j);
      else map.set(j.fecha, [j]);
    }
    return map;
  });

  /** Día seleccionado con sus jornadas (array). */
  readonly diaSeleccionado = computed<{ fecha: string; jornadas: Jornada[] } | null>(() => {
    const ds = this.selectedDateStr();
    if (!ds) return null;
    return { fecha: ds, jornadas: this._jornadasPorFecha().get(ds) ?? [] };
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
      cells.push({ day: null, dateStr: null, jornadas: [], isToday: false, isCurrentMonth: false });
    }

    // Días del mes
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(year, mes, d);
      const dateStr = date.toISOString().split('T')[0];
      const jornadas = jornadasMap.get(dateStr) ?? [];

      cells.push({
        day: d,
        dateStr,
        jornadas,
        isToday: dateStr === hoyStr,
        isCurrentMonth: true,
      });
    }

    // Completar la última semana
    const remaining = 7 - (cells.length % 7 || 7);
    for (let i = 0; i < remaining; i++) {
      cells.push({ day: null, dateStr: null, jornadas: [], isToday: false, isCurrentMonth: false });
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

  descargarExcel(j: Jornada): void {
    this._jornadaService.obtenerReporte(j.id).subscribe({
      next: (reporte) => {
        if (!reporte) return;
        this._electronFileService.saveIndividual(reporte.content_base64, j);
        this._mostrarToast('Guardado con éxito');
      },
    });
  }

  verPreview(j: Jornada): void {
    this.previewJornada.set(j);
    this.showPreview.set(true);
    this.previewLoading.set(true);
    this._jornadaService.obtenerDatosJornada(j.id, j.user_cierre_id).subscribe({
      next: (data) => {
        this.previewData.set(data);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
      },
    });
  }

  cerrarPreview(): void {
    this.showPreview.set(false);
    this.previewJornada.set(null);
    this.previewData.set(null);
  }

  /** Exporta todas las jornadas cerradas del mes visible como Excel multi-hoja. */
  async exportarMes(): Promise<void> {
    this.exportando.set(true);
    this.errorExport.set(null);
    const m = this.currentMonth();

    try {
      const base64 = await this._jornadaService.generarExportacionMensual(
        m.getFullYear(),
        m.getMonth(),
      );
      this._descargarBase64(base64, m);
      this._mostrarToast('Guardado con éxito');
    } catch (err: unknown) {
      this.errorExport.set(
        err instanceof Error ? err.message : 'Error al exportar',
      );
    } finally {
      this.exportando.set(false);
    }
  }

  /** Alterna la visibilidad del picker de rango. */
  toggleRangePicker(): void {
    this.showRangePicker.update((v) => !v);
  }

  /** Exporta todas las jornadas cerradas en el rango seleccionado. */
  async exportarRango(): Promise<void> {
    const desde = this.rangeDesde();
    const hasta = this.rangeHasta();

    if (!desde || !hasta) {
      this.errorExport.set('Seleccione fecha desde y hasta para exportar.');
      return;
    }

    this.exportandoRango.set(true);
    this.errorExport.set(null);

    try {
      const base64 = await this._jornadaService.generarExportacionPorRango(desde, hasta);
      this._descargarBase64Rango(base64, desde, hasta);
      this._mostrarToast('Guardado con éxito');
      this.showRangePicker.set(false);
    } catch (err: unknown) {
      this.errorExport.set(
        err instanceof Error ? err.message : 'Error al exportar',
      );
    } finally {
      this.exportandoRango.set(false);
    }
  }

  private _descargarBase64Rango(base64: string, desde: string, hasta: string): void {
    this._electronFileService.saveRange(base64, desde, hasta);
  }

  private _descargarBase64(base64: string, month: Date): void {
    this._electronFileService.saveMonthly(base64, month.getFullYear(), month.getMonth());
  }

  private _mostrarToast(mensaje: string): void {
    this.toastMessage.set(mensaje);
    if (this._toastTimeout !== null) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.toastMessage.set(null);
      this._toastTimeout = null;
    }, 2500);
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
