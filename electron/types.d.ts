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

// ---- Contrato IPC Palmar (PR3, Pana B) ----
// Espejos de src/app/models/palmar-jornada.ts (PR1) + arqueo-caja.ts:
// el proceso main no importa desde src (rootDir electron/tsconfig.json),
// así que las formas globales acá son la fuente de tipos para main.ts y
// para el renderer. Reconciliar con los modelos en el merge si cambian.

interface PalmarProductoEntry {
  nombre: string;
  cantidad: number;
  precio_venta: number;
  precio_costo: number;
  subtotal: number;
  costo_subtotal: number;
}

interface PalmarDivisa {
  usd: number;
  eur: number;
  tasa_usd: number;
  tasa_eur: number;
  usd_cup: number;
  eur_cup: number;
  divisa_cup: number;
}

/** Espejo de ArqueoCajaEntry (src/app/models/arqueo-caja.ts). */
interface PalmarArqueoCajaEntry {
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

/** Registro completo de una jornada de Palmar (espejo PR1). */
interface PalmarRecord {
  version: 1;
  id: string;
  fecha: string;
  created_at: string;
  usuario: string | null;
  productos: PalmarProductoEntry[];
  arqueo: PalmarArqueoCajaEntry[];
  divisa: PalmarDivisa;
  transferencia: number;
  total_ventas: number;
  total_arqueo: number;
  total_recibido: number;
  invertido: number;
  ganancia: number;
  diferencia: number;
}

/** Entrada del historial de jornadas listadas desde el filesystem. */
interface PalmarHistoryEntry {
  fileName: string;
  createdAt: string;
  totalVentas: number;
  totalArqueo: number;
  totalRecibido: number;
  usuario: string | null;
}

interface PalmarSavePayload {
  /** Fecha de la jornada en formato dd-mm-yyyy (única entrada permitida). */
  baseName: string;
  /** Contenido del xlsx en base64. */
  base64: string;
  /** Registro completo en JSON; omitido en reprint (solo xlsx). */
  json?: PalmarRecord;
}

interface PalmarSaveResult {
  ok: boolean;
  xlsxPath?: string;
  jsonPath?: string;
  error?: string;
}

interface PalmarListResult {
  ok: boolean;
  records?: PalmarHistoryEntry[];
  error?: string;
}

interface PalmarReadPayload {
  /** Basename puro, termina en .json (se rechaza path traversal). */
  fileName: string;
}

interface PalmarReadResult {
  ok: boolean;
  record?: PalmarRecord;
  error?: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
