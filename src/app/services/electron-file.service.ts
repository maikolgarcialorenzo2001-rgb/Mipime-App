/// <reference path="../../../electron/types.d.ts" />
import { Injectable } from '@angular/core';
import type { PalmarRecord } from '../models/palmar-jornada';

/** Nombres de meses en español para los nombres de archivo. */
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable({ providedIn: 'root' })
export class ElectronFileService {
  /** `true` solo cuando corre dentro de un EXE empaquetado de Electron. */
  get isElectronPackaged(): boolean {
    return window.electronAPI?.isPackaged === true;
  }

  /**
   * Guarda el Excel de cierre individual de una jornada.
   * Path: {documents}/Tienda - App/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx
   */
  async saveIndividual(base64: string, jornada: { fecha: string; id: number }): Promise<void> {
    const fecha = new Date(jornada.fecha + 'T12:00:00');
    const year = fecha.getFullYear();
    const month = fecha.getMonth();
    const monthName = MONTH_NAMES[month];
    const monthPadded = String(month + 1).padStart(2, '0');
    const filePath = `${year}/${monthPadded} - ${monthName}/jornada_${jornada.fecha}_${jornada.id}.xlsx`;
    await this._save(base64, filePath);
  }

  /**
   * Guarda el Excel de exportación mensual.
   * Path: {documents}/Tienda - App/Tienda IPVE/Jornada Completa Mes {MonthName}.xlsx
   */
  async saveMonthly(base64: string, year: number, month: number): Promise<void> {
    const monthName = MONTH_NAMES[month];
    const filePath = `Jornada Completa Mes ${monthName}.xlsx`;
    await this._save(base64, filePath);
  }

  /**
   * Guarda el Excel de exportación por rango de fechas.
   * Path: {documents}/Tienda - App/Tienda IPVE/Jornada completa {dd/mm - YYYY} -- {dd/mm - YYYY}.xlsx
   */
  async saveRange(base64: string, desde: string, hasta: string): Promise<void> {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m} - ${y}`;
    };
    const filePath = `Jornada completa ${fmt(desde)} -- ${fmt(hasta)}.xlsx`;
    await this._save(base64, filePath);
  }

  /**
   * Ruta interna: si estamos empaquetados envía por IPC,
   * si no (dev browser o Electron dev), descarga como Blob.
   */
  private async _save(base64: string, filePath: string): Promise<void> {
    if (this.isElectronPackaged) {
      const api = window.electronAPI!;
      const result = await api.invoke('file:saveFile', { base64, filePath });
      const r = result as { success: boolean; error?: string };
      if (!r.success) {
        throw new Error(r.error ?? 'Error desconocido al guardar el archivo');
      }
    } else {
      this._blobFallback(base64, filePath);
    }
  }

  /**
   * Descarga un Blob en el navegador. En Electron empaquetado no hace
   * nada porque el save ya lo manejó JornadaService vía IPC.
   */
  downloadBlob(base64: string, fileName: string): void {
    if (this.isElectronPackaged) return;
    this._blobFallback(base64, fileName);
  }

  /** Fallback para navegador: descarga el archivo via Blob. */
  private _blobFallback(base64: string, fileName: string): void {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    // BACKLOG-5: diferir el revoke hasta después del click (Safari viejo
    // aborta el download si la URL se revoca en el mismo tick).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ---- Jornadas Palmar (PR4, Pana B): sobre canales IPC de PR3 ----
  // Abstracción del renderer sobre file:savePalmar / file:listPalmar /
  // file:readPalmar. Gate por PRESENCIA de electronAPI: en navegador plano
  // (ng serve) no hay IPC, así que savePalmar cae al Blob fallback,
  // listPalmar devuelve [] y readPalmar rechaza. CERO escrituras a DB.

  /**
   * Lista las jornadas Palmar desde el filesystem (solo .json), ordenadas
   * por createdAt descendente (lo ordena main). Sin Electron: historial
   * vacío.
   */
  async listPalmar(): Promise<PalmarHistoryEntry[]> {
    const api = window.electronAPI;
    if (!api) {
      return [];
    }
    const result = (await api.invoke('file:listPalmar')) as PalmarListResult;
    return result.ok ? (result.records ?? []) : [];
  }

  /**
   * Lee una jornada Palmar por fileName (basename terminado en .json; la
   * validación de path traversal la hace main). Sin Electron: rechaza.
   */
  async readPalmar(fileName: string): Promise<PalmarReadResult> {
    const api = window.electronAPI;
    if (!api) {
      throw new Error('readPalmar requires Electron (electronAPI not available)');
    }
    return (await api.invoke('file:readPalmar', { fileName })) as PalmarReadResult;
  }

  /**
   * Guarda una jornada Palmar: {base}.xlsx (+ {base}.json si viene json).
   * En Electron delega a main (que decide sufijos -2/-3); en navegador
   * descarga el xlsx como Blob.
   */
  async savePalmar(
    baseName: string,
    base64: string,
    json?: PalmarRecord,
  ): Promise<PalmarSaveResult> {
    const api = window.electronAPI;
    if (api) {
      const payload: PalmarSavePayload = { baseName, base64 };
      if (json !== undefined) {
        payload.json = json;
      }
      return (await api.invoke('file:savePalmar', payload)) as PalmarSaveResult;
    }
    this._blobFallback(base64, `${baseName}.xlsx`);
    return { ok: true };
  }
}
