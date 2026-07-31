import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Wrapper nativo de SQLite (better-sqlite3) para el proceso main de
 * Electron. Puro de Electron: recibe rutas por parámetro, no importa
 * `electron` — así es testeable bajo node vitest.
 *
 * Rutas de respaldo (spec db-backup):
 *   rodante:     <documents>/Tienda - App/DataBase/tienda-app.db
 *   timestamped: <documents>/Tienda - App/DataBase/backups/tienda_<YYYY-MM-DD_HHmm>.db
 */

export const DB_FILENAME = 'tienda-app.db';
export const IMPORT_FLAG_FILENAME = 'native-db-imported.flag';
/** Tope de payload para db:import (defensa en profundidad, S2/T7). */
export const MAX_IMPORT_BYTES = 512 * 1024 * 1024;
const TIMESTAMPED_RE = /^tienda_\d{4}-\d{2}-\d{2}_\d{4}\.db$/;
const MIN_SCHEMA_VERSION = 1;
const MAX_SCHEMA_VERSION = 16;

export interface DbValidation {
  ok: boolean;
  integrity: string;
  schemaVersion: number;
}

export type RestoreFrom = 'recover' | 'rodante' | 'timestamped' | 'adopt';

export interface DbRestoreInfo {
  from: RestoreFrom;
  path?: string;
  when?: string;
  lostWindowMs: number;
}

export interface DbBackupTried {
  path: string;
  reason: string;
}

export interface DbDiagnostics {
  appVersion: string;
  platform: string;
  sqliteError?: string;
  stage: 'open' | 'recover' | 'backup' | 'import';
  backupsTried: DbBackupTried[];
}

export type DbInitStatus =
  | 'ok'
  | 'restored'
  | 'adopted'
  | 'fresh'
  | 'import-needed'
  | 'fatal';

export interface StartupResult {
  status: DbInitStatus;
  restoreInfo?: DbRestoreInfo;
  diagnostics?: DbDiagnostics;
}

export interface StartupOptions {
  userDataPath: string;
  documentsPath: string;
  appVersion: string;
  platform: string;
}

export interface RecoverResult {
  recovered: boolean;
  corruptPath?: string;
  reason?: string;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
}

export interface AdoptResult {
  status: 'adopted' | 'fresh';
  restoreInfo?: DbRestoreInfo;
}

/** Abre la DB con WAL, foreign_keys ON y busy_timeout 5000. Lanza si falla. */
export function openNativeDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    // Fuerza detección temprana de corrupción: mejor-sqlite3 abre archivos
    // basura sin error y recién falla en la primera consulta (SQLITE_NOTADB).
    db.prepare('SELECT 1').get();
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

/** integrity_check + MAX(version) de schema_version. */
export function validateDb(db: Database.Database): DbValidation {
  const rows = db.pragma('integrity_check') as { integrity_check: string }[];
  const integrity = rows[0]?.integrity_check ?? 'unknown';
  let schemaVersion = 0;
  try {
    const row = db
      .prepare('SELECT MAX(version) AS version FROM schema_version')
      .get() as { version: number | null };
    schemaVersion = row?.version ?? 0;
  } catch {
    schemaVersion = 0;
  }
  return { ok: integrity === 'ok', integrity, schemaVersion };
}

function isAcceptable(v: DbValidation): boolean {
  return (
    v.ok && v.schemaVersion >= MIN_SCHEMA_VERSION && v.schemaVersion <= MAX_SCHEMA_VERSION
  );
}

/** Backup incremental vía db.backup() (helper también para export manual). */
export async function backupDb(db: Database.Database, destPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await db.backup(destPath);
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Destino `<dbPath>.corrupt-<ts>` libre de colisiones: si ya existe
 * (mismo segundo), se anexa un contador.
 */
function corruptTargetFor(dbPath: string): string {
  const base = `${dbPath}.corrupt-${stamp(new Date())}`;
  let target = base;
  let n = 1;
  while (fs.existsSync(target)) {
    target = `${base}-${n++}`;
  }
  return target;
}

function listTimestampedBackups(backupsDir: string): string[] {
  if (!fs.existsSync(backupsDir)) return [];
  return fs
    .readdirSync(backupsDir)
    .filter((f) => TIMESTAMPED_RE.test(f))
    .sort()
    .reverse(); // newest first (nombre fijo = orden cronológico)
}

function whenFromName(file: string): string {
  // tienda_2026-07-31_1430.db -> "2026-07-31 14:30"
  const m = file.match(/^tienda_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})\.db$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}` : file;
}

function lostWindowMs(candidatePath: string): number {
  try {
    return Math.max(0, Date.now() - fs.statSync(candidatePath).mtimeMs);
  } catch {
    return 0;
  }
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Recuperación in-place: VACUUM INTO tmp -> valida -> swap atómico.
 * Preserva el archivo corrupto como <dbPath>.corrupt-<ts> (AD-4).
 */
export function recoverInPlace(dbPath: string): RecoverResult {
  const ts = stamp(new Date());
  const tmpPath = `${dbPath}.recover-${ts}`;
  const corruptPath = corruptTargetFor(dbPath);
  try {
    const src = new Database(dbPath, { readonly: true });
    try {
      src.exec(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
    } finally {
      src.close();
    }
    const tmpDb = new Database(tmpPath);
    let validation: DbValidation;
    try {
      validation = validateDb(tmpDb);
    } finally {
      tmpDb.close();
    }
    if (!validation.ok) {
      fs.unlinkSync(tmpPath);
      return { recovered: false, reason: `integrity check failed: ${validation.integrity}` };
    }
    fs.renameSync(dbPath, corruptPath);
    fs.renameSync(tmpPath, dbPath);
    return { recovered: true, corruptPath };
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    return { recovered: false, reason: toMessage(err) };
  }
}

/** Copia un candidato validado sobre la DB de trabajo (restore). */
function tryRestore(
  candidatePath: string,
  dbPath: string,
  backupsTried: DbBackupTried[],
  from: 'rodante' | 'timestamped',
  when?: string,
): StartupResult | null {
  try {
    if (!fs.existsSync(candidatePath)) {
      backupsTried.push({ path: candidatePath, reason: 'not found' });
      return null;
    }
    const db = openNativeDb(candidatePath);
    let validation: DbValidation;
    try {
      validation = validateDb(db);
    } finally {
      db.close();
    }
    if (!isAcceptable(validation)) {
      backupsTried.push({
        path: candidatePath,
        reason: `invalid: integrity=${validation.integrity}, schemaVersion=${validation.schemaVersion}`,
      });
      return null;
    }
    // Preserva el original corrupto (puede contener datos recuperables) en
    // vez de destruirlo (AD-4, M1): renombrar antes de copiar el candidato.
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, corruptTargetFor(dbPath));
    }
    fs.copyFileSync(candidatePath, dbPath);
    return {
      status: 'restored',
      restoreInfo: {
        from,
        path: candidatePath,
        when: when ?? new Date().toISOString(),
        lostWindowMs: lostWindowMs(candidatePath),
      },
    };
  } catch (err) {
    backupsTried.push({ path: candidatePath, reason: toMessage(err) });
    return null;
  }
}

function tryRestoreFromTimestamped(
  backupsDir: string,
  dbPath: string,
  backupsTried: DbBackupTried[],
): StartupResult | null {
  for (const file of listTimestampedBackups(backupsDir)) {
    const full = path.join(backupsDir, file);
    const result = tryRestore(full, dbPath, backupsTried, 'timestamped', whenFromName(file));
    if (result) return result;
  }
  return null;
}

/**
 * Cascada de arranque (spec db-recovery R1): abrir -> recoverInPlace ->
 * rodante -> timestamped newest→oldest. Cada candidato validado
 * (integrity_check + schema_version 1..16, AD-5); fallos registrados.
 * Sin DB + sin flag -> import-needed (RESOLVED-RISK-1).
 * Sin DB + flag -> adoptOrFresh (ADOPT).
 */
export function runStartupSequence(opts: StartupOptions): StartupResult {
  const dbPath = path.join(opts.userDataPath, DB_FILENAME);
  const rodantePath = path.join(
    opts.documentsPath,
    'Tienda - App',
    'DataBase',
    DB_FILENAME,
  );
  const backupsDir = path.join(
    opts.documentsPath,
    'Tienda - App',
    'DataBase',
    'backups',
  );
  const backupsTried: DbBackupTried[] = [];

  if (!fs.existsSync(dbPath)) {
    const flagPath = path.join(opts.userDataPath, IMPORT_FLAG_FILENAME);
    if (!fs.existsSync(flagPath)) {
      return { status: 'import-needed' };
    }
    return adoptOrFresh(dbPath, rodantePath, backupsDir);
  }

  let sqliteError: string;
  try {
    const db = openNativeDb(dbPath);
    let validation: DbValidation;
    try {
      validation = validateDb(db);
    } finally {
      db.close();
    }
    if (validation.ok) {
      return { status: 'ok' };
    }
    // Abre pero falla integridad (ej. freelist corrupto): mejor-sqlite3 no
    // lanza al abrir corrupción de páginas, así que validamos al arranque
    // (fail-loud R1, AD-4) y seguimos a la cascada de recuperación.
    sqliteError = `integrity check failed: ${validation.integrity}`;
  } catch (openErr) {
    sqliteError = toMessage(openErr);
  }

  const rec = recoverInPlace(dbPath);
  if (rec.recovered) {
    return {
      status: 'restored',
      restoreInfo: {
        from: 'recover',
        path: dbPath,
        when: new Date().toISOString(),
        lostWindowMs: 0,
      },
    };
  }
  backupsTried.push({
    path: dbPath,
    reason: `open/validate failed (${sqliteError}); recoverInPlace: ${rec.reason ?? 'unknown'}`,
  });

  const rodante = tryRestore(rodantePath, dbPath, backupsTried, 'rodante');
  if (rodante) return rodante;

  const timestamped = tryRestoreFromTimestamped(backupsDir, dbPath, backupsTried);
  if (timestamped) return timestamped;

  return {
    status: 'fatal',
    diagnostics: {
      appVersion: opts.appVersion,
      platform: opts.platform,
      sqliteError,
      stage: 'open',
      backupsTried,
    },
  };
}

/**
 * ADOPT (spec db-backup R4): sin DB + flag, adopta el backup válido más
 * nuevo (rodante primero, luego timestamped); si ninguno, DB fresca.
 */
export function adoptOrFresh(
  dbPath: string,
  rodantePath: string,
  backupsDir: string,
): AdoptResult {
  const candidates: { path: string; when: string }[] = [];
  if (fs.existsSync(rodantePath)) {
    candidates.push({ path: rodantePath, when: new Date().toISOString() });
  }
  for (const file of listTimestampedBackups(backupsDir)) {
    candidates.push({ path: path.join(backupsDir, file), when: whenFromName(file) });
  }

  for (const candidate of candidates) {
    try {
      const db = openNativeDb(candidate.path);
      let validation: DbValidation;
      try {
        validation = validateDb(db);
      } finally {
        db.close();
      }
      if (!isAcceptable(validation)) continue;
      fs.copyFileSync(candidate.path, dbPath);
      return {
        status: 'adopted',
        restoreInfo: {
          from: 'adopt',
          path: candidate.path,
          when: candidate.when,
          lostWindowMs: lostWindowMs(candidate.path),
        },
      };
    } catch {
      /* probar siguiente candidato */
    }
  }

  const db = openNativeDb(dbPath); // DB fresca vacía
  db.close();
  return { status: 'fresh' };
}

/**
 * Import one-shot OPFS→native (RESOLVED-RISK-1): escribe tmp+rename,
 * valida, y recién tras éxito escribe el flag. Sin flag en fallo:
 * reintento en el próximo arranque.
 */
export function importDbFile(
  data: ArrayBuffer,
  dbPath: string,
  flagPath: string,
  appVersion = 'unknown',
): ImportResult {
  const tmpPath = `${dbPath}.import-${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, Buffer.from(data));
    const db = new Database(tmpPath);
    let validation: DbValidation;
    try {
      validation = validateDb(db);
    } finally {
      db.close();
    }
    if (!isAcceptable(validation)) {
      fs.unlinkSync(tmpPath);
      return {
        ok: false,
        error: `import validation failed: integrity=${validation.integrity}, schemaVersion=${validation.schemaVersion}`,
      };
    }
    fs.renameSync(tmpPath, dbPath);
    fs.writeFileSync(
      flagPath,
      JSON.stringify(
        { importedAt: new Date().toISOString(), from: 'opfs', appVersion },
        null,
        2,
      ),
    );
    return { ok: true };
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: toMessage(err) };
  }
}

/** Retención: borra los backups timestamped más viejos dejando `keep`. */
export function pruneBackups(dir: string, keep = 30): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => TIMESTAMPED_RE.test(f)).sort();
  const removed: string[] = [];
  const excess = files.length - keep;
  for (let i = 0; i < excess; i++) {
    const file = path.join(dir, files[i]);
    fs.unlinkSync(file);
    removed.push(file);
  }
  return removed;
}
