import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { PalmarService } from '../../services/palmar.service';
import {
  PalmarJornadaModalComponent,
  PALMAR_JORNADA_SERVICE,
} from '../../components/palmar-jornada-modal/palmar-jornada-modal.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import type { PalmarHistoryEntry, PalmarRecord } from '../../models';

/**
 * Página de jornadas de la tienda externa "Palmar" (PR5, Pana A; PR8
 * integración E2E): consume PalmarService real (filesystem via IPC, PR4)
 * y provee el token PALMAR_JORNADA_SERVICE con `useExisting: PalmarService`
 * para el modal (contrato congelado PR6 — PR8 los conecta).
 */
@Component({
  selector: 'app-palmar-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    PalmarJornadaModalComponent,
  ],
  providers: [{ provide: PALMAR_JORNADA_SERVICE, useExisting: PalmarService }],
  templateUrl: './palmar.page.html',
  styleUrl: './palmar.page.css',
})
export class PalmarPage {
  private readonly _palmar = inject(PalmarService);

  readonly historial = signal<PalmarHistoryEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Modal de registro de jornada (PR8): abierto/cerrado. */
  readonly modalAbierta = signal(false);

  /** Detalle completo de la jornada seleccionada (PR8), null = oculto. */
  readonly detalle = signal<PalmarRecord | null>(null);
  readonly detalleError = signal<string | null>(null);

  /** Feedback transitorio de acciones (reimprimir). */
  readonly aviso = signal<string | null>(null);

  /** Gate D5: presencia de `window.electronAPI` (no isPackaged). */
  get esEscritorio(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
  }

  constructor() {
    void this.cargarHistorial();
  }

  /** Consume PalmarService.cargarHistorial() (filesystem via IPC, PR4). */
  async cargarHistorial(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const entries = await this._palmar.cargarHistorial();
      this.historial.set(entries);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cargar el historial',
      );
    } finally {
      this.loading.set(false);
    }
  }

  abrirModal(): void {
    this.modalAbierta.set(true);
  }

  /** `cerrar` del modal: solo lo cierra, no refresca. */
  cerrarModal(): void {
    this.modalAbierta.set(false);
  }

  /** `saved` del modal: cierra y refresca el historial (la jornada ya existe). */
  async onSaved(): Promise<void> {
    this.modalAbierta.set(false);
    await this.cargarHistorial();
  }

  /** "Ver detalle": lee el registro completo desde el filesystem (PR6). */
  async verDetalle(fileName: string): Promise<void> {
    this.detalleError.set(null);
    try {
      this.detalle.set(await this._palmar.verDetalle(fileName));
    } catch (e) {
      this.detalleError.set(
        e instanceof Error ? e.message : 'Error al leer el detalle',
      );
    }
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  /** "Reimprimir": reimprime la jornada como archivo NUEVO (sufijo -2/-3, PR3). */
  async reimprimir(fileName: string): Promise<void> {
    this.aviso.set(null);
    try {
      await this._palmar.volverAImprimir(fileName);
      this.aviso.set(`Reimpresión de ${fileName} guardada como archivo nuevo`);
    } catch (e) {
      this.aviso.set(
        e instanceof Error ? e.message : 'Error al reimprimir la jornada',
      );
    }
  }
}
