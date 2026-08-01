import { Injectable, inject } from '@angular/core';
import { SQLOCAL_CLIENT_FACTORY } from './sqlocal-client';

export type BackupTrigger = 'open' | 'jornada-close';

/**
 * Backup de la base nativa desde el renderer (T8) + export manual (T12).
 * - Web: auto-backup no-op (AD-6) — no hay proceso main que respalde; el
 *   export manual descarga el archivo vía getDatabaseFile() (AD-6 confirmado).
 * - Electron: backup delega en db:backupNow (open -> rodante; jornada-close ->
 *   rodante + con fecha + poda de 30); exportarRespaldo delega en db:export
 *   (diálogo guardar + backupDb al destino, R5).
 * Los fallos de BACKUP nunca interrumpen el flujo que invocó (R6). El export
 * manual, en cambio, devuelve el resultado para que la UI informe al usuario.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly _createSqlocalClient = inject(SQLOCAL_CLIENT_FACTORY);

  async backup(trigger: BackupTrigger): Promise<void> {
    if (!window.electronAPI) {
      return; // web: no-op (AD-6)
    }
    try {
      await window.electronAPI.invoke('db:backupNow', { trigger });
    } catch {
      // R6: los fallos de backup no interrumpen el cierre de jornada ni el close.
    }
  }

  /**
   * Export manual (T12, R5): copia de seguridad a elección del usuario.
   * - Electron: db:export → main abre diálogo guardar y copia la DB al
   *   destino (backupDb incremental). Cancelado → {ok:false, canceled:true}.
   * - Web: descarga un archivo SQLite vía getDatabaseFile() (AD-6, confirmado
   *   en apply). Usa la factoría compartida (M1), nunca SQLocal crudo.
   * A diferencia de backup(), aquí SÍ se propaga el error: el usuario pidió
   * el export y merece feedback real.
   */
  async exportarRespaldo(): Promise<DbExportResult> {
    if (window.electronAPI) {
      try {
        return (await window.electronAPI.invoke(
          'db:export',
        )) as DbExportResult;
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    // Web (AD-6): blob download del archivo OPFS (lectura no destructiva).
    try {
      const client = await this._createSqlocalClient();
      const file = await client.getDatabaseFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = this._webExportName(new Date());
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private _webExportName(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `tienda_export_${d.getFullYear()}${p(d.getMonth() + 1)}${p(
      d.getDate(),
    )}_${p(d.getHours())}${p(d.getMinutes())}.db`;
  }
}
