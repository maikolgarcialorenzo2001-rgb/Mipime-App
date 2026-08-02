import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  openNativeDb,
  validateDb,
  backupDb,
  pruneBackups,
  timestampedBackupName,
  backupRodanteSync,
  recoverInPlace,
  runStartupSequence,
  importDbFile,
  adoptOrFresh,
} from './db';

let dirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-spec-'));
  dirs.push(dir);
  return dir;
}

function createValidDb(dbPath: string, rows = 10, version = 16): void {
  const db = openNativeDb(dbPath);
  db.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  const ins = db.prepare('INSERT INTO t (v) VALUES (?)');
  for (let i = 0; i < rows; i++) ins.run('row-' + i);
  db.close();
}

function corruptFreelist(dbPath: string): void {
  const buf = fs.readFileSync(dbPath);
  buf.writeUInt32BE(0x7fffffff, 32);
  fs.writeFileSync(dbPath, buf);
}

function writeGarbage(dbPath: string): void {
  fs.writeFileSync(dbPath, Buffer.from('this is not a sqlite database at all'));
}

function docsRoot(dir: string): string {
  return path.join(dir, 'docs', 'Tienda - App', 'DataBase');
}

afterEach(() => {
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  dirs = [];
});

describe('openNativeDb', () => {
  it('creates a WAL database with foreign_keys ON and busy_timeout 5000', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'tienda-app.db');
    const db = openNativeDb(dbPath);

    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
    db.close();
  });

  it('throws when the file is not a database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'garbage.db');
    writeGarbage(dbPath);

    expect(() => openNativeDb(dbPath)).toThrow();
  });
});

describe('validateDb', () => {
  it('reports ok and the schema version for a valid database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'ok.db');
    createValidDb(dbPath, 5, 16);

    const db = openNativeDb(dbPath);
    const result = validateDb(db);
    db.close();

    expect(result).toEqual({ ok: true, integrity: 'ok', schemaVersion: 16 });
  });

  it('reports failure with the integrity message for a corrupt database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'corrupt.db');
    createValidDb(dbPath, 5, 16);
    corruptFreelist(dbPath);

    const db = openNativeDb(dbPath);
    const result = validateDb(db);
    db.close();

    expect(result.ok).toBe(false);
    expect(result.integrity).toContain('Freelist');
  });

  it('reports schemaVersion 0 when the schema_version table is missing', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'bare.db');
    const db = openNativeDb(dbPath);
    db.exec('CREATE TABLE t (v TEXT)');
    db.close();

    const check = openNativeDb(dbPath);
    const result = validateDb(check);
    check.close();

    expect(result.ok).toBe(true);
    expect(result.schemaVersion).toBe(0);
  });
});

describe('backupDb', () => {
  it('creates the destination with nested directories and copies data', async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'src.db');
    createValidDb(dbPath, 7, 16);

    const dest = path.join(dir, 'backups', 'nested', 'copy.db');
    const db = openNativeDb(dbPath);
    await backupDb(db, dest);
    db.close();

    const copy = openNativeDb(dest);
    const count = (copy.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number })
      .c;
    copy.close();

    expect(count).toBe(7);
  });
});

describe('pruneBackups', () => {
  it('keeps exactly the newest 30 backups and removes the oldest', () => {
    const dir = tmpDir();
    const backupsDir = path.join(dir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    for (let d = 1; d <= 31; d++) {
      const day = String(d).padStart(2, '0');
      fs.writeFileSync(
        path.join(backupsDir, `tienda_2026-01-${day}_1000.db`),
        'x',
      );
    }
    for (let d = 1; d <= 4; d++) {
      fs.writeFileSync(
        path.join(backupsDir, `tienda_2026-02-0${d}_1000.db`),
        'x',
      );
    }
    fs.writeFileSync(path.join(backupsDir, 'tienda-app.db'), 'x');
    fs.writeFileSync(path.join(backupsDir, 'readme.txt'), 'x');

    const removed = pruneBackups(backupsDir, 30);

    const remaining = fs
      .readdirSync(backupsDir)
      .filter((f) => /^tienda_\d{4}-\d{2}-\d{2}_\d{4}\.db$/.test(f));
    expect(remaining).toHaveLength(30);
    // oldest 5 removed
    expect(removed).toHaveLength(5);
    expect(removed[0]).toContain('2026-01-01');
    expect(remaining.some((f) => f.includes('2026-02-04'))).toBe(true);
    expect(remaining.some((f) => f.includes('2026-01-01'))).toBe(false);
    // non-backup files untouched
    expect(fs.existsSync(path.join(backupsDir, 'tienda-app.db'))).toBe(true);
    expect(fs.existsSync(path.join(backupsDir, 'readme.txt'))).toBe(true);
  });

  it('returns an empty list when the directory does not exist', () => {
    const dir = tmpDir();
    expect(pruneBackups(path.join(dir, 'missing'))).toEqual([]);
  });
});

describe('timestampedBackupName', () => {
  it('genera nombres con formato tienda_YYYY-MM-DD_HHmm.db (compatible con TIMESTAMPED_RE)', () => {
    const d = new Date(2026, 5, 2, 14, 7, 59);

    const name = timestampedBackupName(d);

    expect(name).toMatch(/^tienda_\d{4}-\d{2}-\d{2}_\d{4}\.db$/);
    expect(name).toBe('tienda_2026-06-02_1407.db');
  });

  it('los snapshots generados son detectados por pruneBackups (sin drift de formato)', () => {
    const dir = tmpDir();
    const backupsDir = path.join(dir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const name = timestampedBackupName(new Date(2026, 5, 2, 14, 7));
    fs.writeFileSync(path.join(backupsDir, name), 'x');

    const removed = pruneBackups(backupsDir, 0);

    expect(removed).toHaveLength(1);
    expect(removed[0]).toContain(name);
  });
});

describe('backupRodanteSync', () => {
  it('copia un snapshot consistente de la DB viva al destino rodante (AD-8)', () => {
    const dir = tmpDir();
    const live = path.join(dir, 'live.db');
    const rod = path.join(dir, 'rodante.db');
    createValidDb(live, 10, 16);

    backupRodanteSync(live, rod);

    const r = openNativeDb(rod);
    const rows = r.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number };
    const version = r.prepare('SELECT version FROM schema_version').get() as {
      version: number;
    };
    r.close();
    expect(rows.c).toBe(10);
    expect(version.version).toBe(16);
  });

  it('sobreescribe un rodante existente (destino en uso se reemplaza)', () => {
    const dir = tmpDir();
    const live = path.join(dir, 'live.db');
    const rod = path.join(dir, 'rodante.db');
    createValidDb(live, 3, 16);
    fs.writeFileSync(rod, 'stale');

    backupRodanteSync(live, rod);

    const r = openNativeDb(rod);
    const rows = r.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number };
    r.close();
    expect(rows.c).toBe(3);
  });

  it('nunca lanza (R6): DB viva inexistente, destino bajo un archivo, o mismo path', () => {
    const dir = tmpDir();
    const live = path.join(dir, 'live.db');
    createValidDb(live, 1, 16);
    const fileAsDir = path.join(dir, 'not-a-dir');
    fs.writeFileSync(fileAsDir, 'x');

    expect(() =>
      backupRodanteSync(path.join(dir, 'missing.db'), path.join(dir, 'x.db')),
    ).not.toThrow();
    expect(() =>
      backupRodanteSync(live, path.join(fileAsDir, 'x.db')),
    ).not.toThrow();
    expect(() => backupRodanteSync(live, live)).not.toThrow();
  });
});

describe('recoverInPlace', () => {
  it('repairs a corrupt database and preserves the original as .corrupt-<ts>', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'tienda-app.db');
    createValidDb(dbPath, 10, 16);
    corruptFreelist(dbPath);

    const result = recoverInPlace(dbPath);

    expect(result.recovered).toBe(true);
    expect(result.corruptPath).toBeDefined();
    expect(fs.existsSync(result.corruptPath!)).toBe(true);
    expect(path.basename(result.corruptPath!)).toMatch(
      /^tienda-app\.db\.corrupt-\d{4}-\d{2}-\d{2}_\d{6}$/,
    );

    // original path now opens clean with all data
    const db = openNativeDb(dbPath);
    const validation = validateDb(db);
    const count = (db.prepare('SELECT COUNT(*) AS c FROM t').get() as {
      c: number;
    }).c;
    db.close();

    expect(validation.ok).toBe(true);
    expect(validation.schemaVersion).toBe(16);
    expect(count).toBe(10);
  });

  it('fails without touching the file when it is not a database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'garbage.db');
    writeGarbage(dbPath);

    const result = recoverInPlace(dbPath);

    expect(result.recovered).toBe(false);
    expect(fs.readFileSync(dbPath, 'utf-8')).toContain(
      'this is not a sqlite database',
    );
  });
});

describe('runStartupSequence', () => {
  it('returns ok for a working database with no restore info', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    createValidDb(path.join(userData, 'tienda-app.db'), 3, 16);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('ok');
    expect(result.restoreInfo).toBeUndefined();
    expect(result.diagnostics).toBeUndefined();
  });

  it('restores in place from recoverable corruption and reports from recover', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    const dbPath = path.join(userData, 'tienda-app.db');
    createValidDb(dbPath, 4, 16);
    corruptFreelist(dbPath);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('restored');
    expect(result.restoreInfo?.from).toBe('recover');
    const db = openNativeDb(dbPath);
    expect(validateDb(db).ok).toBe(true);
    db.close();
  });

  it('falls through to the rodante backup when in-place recovery is impossible', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    writeGarbage(path.join(userData, 'tienda-app.db'));

    const docs = docsRoot(dir);
    fs.mkdirSync(docs, { recursive: true });
    createValidDb(path.join(docs, 'tienda-app.db'), 6, 16);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('restored');
    expect(result.restoreInfo?.from).toBe('rodante');
    const db = openNativeDb(path.join(userData, 'tienda-app.db'));
    expect(validateDb(db).ok).toBe(true);
    const count = (db.prepare('SELECT COUNT(*) AS c FROM t').get() as {
      c: number;
    }).c;
    db.close();
    expect(count).toBe(6);
  });

  it('preserves the corrupt working DB as .corrupt-<ts> when restoring from a backup (M1)', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    const dbPath = path.join(userData, 'tienda-app.db');
    writeGarbage(dbPath);

    const docs = docsRoot(dir);
    fs.mkdirSync(docs, { recursive: true });
    createValidDb(path.join(docs, 'tienda-app.db'), 6, 16);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('restored');
    expect(result.restoreInfo?.from).toBe('rodante');
    const preserved = fs
      .readdirSync(userData)
      .filter((f) => f.startsWith('tienda-app.db.corrupt-'));
    expect(preserved).toHaveLength(1);
    expect(preserved[0]).toMatch(
      /^tienda-app\.db\.corrupt-\d{4}-\d{2}-\d{2}_\d{6}$/,
    );
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('tries timestamped backups newest-first and records skipped candidates', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    writeGarbage(path.join(userData, 'tienda-app.db'));

    const docs = docsRoot(dir);
    const backups = path.join(docs, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    writeGarbage(path.join(docs, 'tienda-app.db'));
    writeGarbage(path.join(backups, 'tienda_2026-07-31_1400.db'));
    createValidDb(path.join(backups, 'tienda_2026-07-30_1000.db'), 8, 16);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('restored');
    expect(result.restoreInfo?.from).toBe('timestamped');
    expect(result.restoreInfo?.path).toContain('tienda_2026-07-30_1000.db');
    const db = openNativeDb(path.join(userData, 'tienda-app.db'));
    const count = (db.prepare('SELECT COUNT(*) AS c FROM t').get() as {
      c: number;
    }).c;
    db.close();
    expect(count).toBe(8);
  });

  it('returns fatal with diagnostics when every candidate fails', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    writeGarbage(path.join(userData, 'tienda-app.db'));

    const docs = docsRoot(dir);
    const backups = path.join(docs, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    writeGarbage(path.join(docs, 'tienda-app.db'));
    writeGarbage(path.join(backups, 'tienda_2026-07-31_1400.db'));

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('fatal');
    // RECOVERY RED-FLIP: cascade advanced past 'open' (recoverInPlace + rodante
    // + timestamped all failed) → stage MUST report 'recover', not hardcoded 'open'.
    expect(result.diagnostics?.stage).toBe('recover');
    expect(result.diagnostics?.appVersion).toBe('0.1.9-beta');
    expect(result.diagnostics?.sqliteError).toBeDefined();
    expect(result.diagnostics?.backupsTried.length).toBeGreaterThanOrEqual(3);
    for (const tried of result.diagnostics!.backupsTried) {
      expect(tried.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns import-needed when no database and no import flag exist', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('import-needed');
  });

  it('adopts the newest valid backup when the flag exists but no database', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'native-db-imported.flag'), '{}');

    const docs = docsRoot(dir);
    const backups = path.join(docs, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    createValidDb(path.join(backups, 'tienda_2026-07-29_0900.db'), 9, 16);
    createValidDb(path.join(backups, 'tienda_2026-07-31_1200.db'), 2, 16);

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('adopted');
    expect(result.restoreInfo?.from).toBe('adopt');
    expect(result.restoreInfo?.path).toContain('tienda_2026-07-31_1200.db');
  });

  it('creates a fresh database when the flag exists but no backups exist', () => {
    const dir = tmpDir();
    const userData = path.join(dir, 'userData');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'native-db-imported.flag'), '{}');

    const result = runStartupSequence({
      userDataPath: userData,
      documentsPath: path.join(dir, 'docs'),
      appVersion: '0.1.9-beta',
      platform: 'win32',
    });

    expect(result.status).toBe('fresh');
    expect(fs.existsSync(path.join(userData, 'tienda-app.db'))).toBe(true);
  });
});

describe('adoptOrFresh', () => {
  it('skips invalid backups and falls back to a fresh database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'userData', 'tienda-app.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const docs = docsRoot(dir);
    const backups = path.join(docs, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    writeGarbage(path.join(backups, 'tienda_2026-07-31_1400.db'));

    const result = adoptOrFresh(dbPath, path.join(docs, 'tienda-app.db'), backups);

    expect(result.status).toBe('fresh');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('usa el mtime del rodante como when al adoptar (no "ahora")', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'userData', 'tienda-app.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const docs = docsRoot(dir);
    const backups = path.join(docs, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    const rodante = path.join(docs, 'tienda-app.db');
    createValidDb(rodante, 2, 16);
    const past = new Date('2026-06-02T14:07:00Z');
    fs.utimesSync(rodante, past, past);

    const result = adoptOrFresh(dbPath, rodante, backups);

    expect(result.status).toBe('adopted');
    const mtime = fs.statSync(rodante).mtime.toISOString();
    expect(result.restoreInfo?.when).toBe(mtime);
    // ISO ordena cronológicamente: el when es del pasado, no "ahora".
    expect((result.restoreInfo?.when ?? '') < new Date().toISOString()).toBe(
      true,
    );
  });
});

describe('importDbFile', () => {
  it('writes the flag only after a successful import and validation', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'tienda-app.db');
    const flagPath = path.join(dir, 'native-db-imported.flag');
    const srcPath = path.join(dir, 'opfs.db');
    createValidDb(srcPath, 5, 16);
    const data = fs.readFileSync(srcPath);

    const result = importDbFile(data, dbPath, flagPath, '0.1.9-beta');

    expect(result.ok).toBe(true);
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.existsSync(flagPath)).toBe(true);
    const flag = JSON.parse(fs.readFileSync(flagPath, 'utf-8'));
    expect(flag.from).toBe('opfs');
    expect(flag.appVersion).toBe('0.1.9-beta');
    const db = openNativeDb(dbPath);
    expect(validateDb(db).schemaVersion).toBe(16);
    db.close();
  });

  it('does NOT write the flag when the data is not a database', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'tienda-app.db');
    const flagPath = path.join(dir, 'native-db-imported.flag');

    const result = importDbFile(
      Buffer.from('not a database at all'),
      dbPath,
      flagPath,
    );

    expect(result.ok).toBe(false);
    expect(fs.existsSync(flagPath)).toBe(false);
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it('does NOT write the flag when the imported database fails validation', () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, 'tienda-app.db');
    const flagPath = path.join(dir, 'native-db-imported.flag');
    const srcPath = path.join(dir, 'corrupt.db');
    createValidDb(srcPath, 5, 16);
    corruptFreelist(srcPath);
    const data = fs.readFileSync(srcPath);

    const result = importDbFile(data, dbPath, flagPath);

    expect(result.ok).toBe(false);
    expect(fs.existsSync(flagPath)).toBe(false);
    expect(fs.existsSync(dbPath)).toBe(false);
  });
});
