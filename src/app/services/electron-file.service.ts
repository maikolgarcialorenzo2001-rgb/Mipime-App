import { Injectable } from '@angular/core';

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
   * Path: {documents}/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx
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
   * Path: {documents}/Tienda IPVE/Jornada Completa Mes {MonthName}.xlsx
   */
  async saveMonthly(base64: string, year: number, month: number): Promise<void> {
    const monthName = MONTH_NAMES[month];
    const filePath = `Jornada Completa Mes ${monthName}.xlsx`;
    await this._save(base64, filePath);
  }

  /**
   * Guarda el Excel de exportación por rango de fechas.
   * Path: {documents}/Tienda IPVE/Jornada completa {dd/mm - YYYY} -- {dd/mm - YYYY}.xlsx
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
   * Descarga un Blob en el navegador. Útil para el fallback cuando
   * el save ya fue manejado por la capa de servicio (login, app-nav).
   */
  downloadBlob(base64: string, fileName: string): void {
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
    URL.revokeObjectURL(url);
  }
}
