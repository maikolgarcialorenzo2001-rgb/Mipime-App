import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ElectronFileService } from '../../services/electron-file.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import type { PalmarHistoryEntry } from '../../models';

/**
 * Contrato congelado PR4 (plan §Contratos): `listPalmar()` llega con
 * ElectronFileService. La página consume la firma, no el cuerpo — PR8
 * rewirea a PalmarService cuando exista.
 */
interface PalmarFileService {
  listPalmar(): Promise<PalmarHistoryEntry[]>;
}

@Component({
  selector: 'app-palmar-page',
  standalone: true,
  imports: [CurrencyPipe, EmptyStateComponent, LoadingSpinnerComponent],
  templateUrl: './palmar.page.html',
  styleUrl: './palmar.page.css',
})
export class PalmarPage {
  private readonly _electronFileService = inject(
    ElectronFileService,
  ) as unknown as PalmarFileService;

  readonly historial = signal<PalmarHistoryEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Gate D5: presencia de `window.electronAPI` (no isPackaged). */
  get esEscritorio(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
  }

  constructor() {
    void this.cargarHistorial();
  }

  /** Consume ElectronFileService.listPalmar() (contrato PR4, mockeado en specs). */
  async cargarHistorial(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const entries = await this._electronFileService.listPalmar();
      this.historial.set(entries);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cargar el historial',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
