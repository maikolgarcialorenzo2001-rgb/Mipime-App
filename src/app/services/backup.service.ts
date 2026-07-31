import { Injectable } from '@angular/core';

export type BackupTrigger = 'open' | 'jornada-close';

/**
 * Backup de la base nativa desde el renderer (T8).
 * - Web: no-op (AD-6) — no hay proceso main que respalde.
 * - Electron: delega en db:backupNow (open -> rodante; jornada-close ->
 *   rodante + con fecha + poda de 30).
 * Los fallos NUNCA interrumpen el flujo que invocó el backup (R6): cualquier
 * rechazo o {ok:false} se traga y resuelve undefined.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
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
}
