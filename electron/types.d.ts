/** API expuesta por el preload script al renderer vía contextBridge. */
interface ElectronAPI {
  readonly platform: string;
  /** true when running in a packaged Electron app (installed via exe/msi). */
  readonly isPackaged: boolean;
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): void;
  removeAllListeners(channel: string): void;
}

// ---- Contrato IPC de la DB nativa (T3, design IPC section) ----
// Globales de solo lectura para el renderer; el proceso main define las
// mismas formas como exports en electron/db.ts (fuente única del runtime).

type DbInitStatus =
  | 'ok'
  | 'restored'
  | 'adopted'
  | 'fresh'
  | 'import-needed'
  | 'fatal';

type RestoreFrom = 'recover' | 'rodante' | 'timestamped' | 'adopt';

interface DbRestoreInfo {
  from: RestoreFrom;
  path?: string;
  when?: string;
  lostWindowMs: number;
}

interface DbBackupTried {
  path: string;
  reason: string;
}

interface DbDiagnostics {
  appVersion: string;
  platform: string;
  sqliteError?: string;
  stage: 'open' | 'recover' | 'backup' | 'import';
  backupsTried: DbBackupTried[];
}

interface DbInitResult {
  status: DbInitStatus;
  restoreInfo?: DbRestoreInfo;
  diagnostics?: DbDiagnostics;
}

interface DbBackupResult {
  ok: boolean;
  rodantePath?: string;
  timestampedPath?: string;
  error?: string;
}

interface DbImportResult {
  ok: boolean;
  /** Presente cuando file:null y adoptOrFresh adoptó un backup (T9). */
  restoreInfo?: DbRestoreInfo;
  error?: string;
}

interface DbExportResult {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
