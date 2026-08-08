import { environment } from '../environments/environment';
import { runMigrations, type MigrationExecutor } from './db-migrations';

/**
 * Fake executor que captura cada SQL ejecutado y responde consultas de
 * estado (schema_version, conteos) de forma controlada.
 */
class FakeExecutor implements MigrationExecutor {
  calls: { query: string; params: unknown[] }[] = [];
  version = 0;
  adminCount = 0;
  productCount = 0;
  /** true => imita sqlite real: el SELECT de schema_version falla si la tabla no existe. */
  strictSchema = false;
  private createdSchemaTable = false;

  async sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
    this.calls.push({ query, params });
    if (query.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
      this.createdSchemaTable = true;
      return [] as T[];
    }
    if (query.includes('COALESCE(MAX(version), 0)')) {
      if (this.strictSchema && !this.createdSchemaTable) {
        throw new Error('no such table: schema_version');
      }
      return [{ version: this.version }] as T[];
    }
    if (
      query.includes('SELECT COUNT(*) AS count FROM usuarios WHERE nombre = ?')
    ) {
      return [{ count: this.adminCount }] as T[];
    }
    if (query.includes('SELECT COUNT(*) AS count FROM productos')) {
      return [{ count: this.productCount }] as T[];
    }
    return [] as T[];
  }

  versionNumbers(): number[] {
    return this.calls
      .filter((c) => c.query.includes('INSERT INTO schema_version'))
      .map((c) => Number(c.query.match(/\((\d+)\)/)![1]));
  }

  productSeedBatches(): string[] {
    return this.calls
      .filter(
        (c) =>
          c.query.includes('INSERT INTO productos') &&
          c.query.includes('VALUES (?'),
      )
      .map((c) => c.query);
  }
}

describe('runMigrations', () => {
  let exec: FakeExecutor;

  beforeEach(() => {
    exec = new FakeExecutor();
    // hash-password usa Web Crypto (jsdom no expone crypto.subtle.digest)
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
        getRandomValues: (arr: Uint8Array) => arr,
      },
      configurable: true,
      writable: true,
    });
  });

  it('inserts 17 schema versions in order on a fresh DB (v1..v17)', async () => {
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it('1.2 RED: desde la versión 16 aplica la migración v17 de forma aditiva (2 ALTERs + índice parcial)', async () => {
    exec.version = 16;
    await runMigrations(exec, { seedEnabled: false });

    const alters = exec.calls.filter((c) =>
      c.query.includes('ALTER TABLE ventas ADD COLUMN'),
    );
    expect(alters.some((a) => a.query.includes('cobro_de_venta_id'))).toBe(true);
    expect(alters.some((a) => a.query.includes('pagado_en'))).toBe(true);
    expect(
      exec.calls.some((c) =>
        c.query.includes(
          'CREATE INDEX IF NOT EXISTS idx_ventas_pendientes',
        ),
      ),
    ).toBe(true);
    expect(exec.versionNumbers()).toEqual([17]);
    // La seed no debe ejecutarse sin seedEnabled
    expect(exec.productSeedBatches().length).toBe(0);
  });

  it('1.2 RED: re-ejecutar sobre una DB ya en 17 es idempotente (no repite ALTERs ni vuelve a insertar versión)', async () => {
    exec.version = 17;
    await runMigrations(exec, { seedEnabled: false });

    // v17 ya existe: el runner NO re-ejecuta la migración
    expect(exec.versionNumbers()).toEqual([]);
    const legCoales = exec.calls.filter((c) =>
      c.query.includes('ALTER TABLE ventas ADD COLUMN'),
    );
    expect(legCoales.length).toBe(0);
    expect(
      exec.calls.some((c) =>
        c.query.includes('CREATE INDEX IF NOT EXISTS idx_ventas_pendientes'),
      ),
    ).toBe(false);
  });

  it('seeds productos in batches of 10 with lote seeds only when seedEnabled is true', async () => {
    await runMigrations(exec, { seedEnabled: true });

    const batches = exec.productSeedBatches();
    // 74 productos / 10 por batch = 8 batches (el último con 4)
    expect(batches.length).toBe(8);
    for (const batch of batches) {
      // 8 columnas x 10 filas por batch (el último puede tener menos)
      expect(batch.match(/\?/g)!.length % 8).toBe(0);
      expect(batch.match(/\?/g)!.length).toBeLessThanOrEqual(80);
    }
    const loteSeed = exec.calls.find(
      (c) =>
        c.query.includes('INSERT INTO lotes_stock') &&
        c.query.includes('SELECT id, stock_almacen'),
    );
    expect(loteSeed).toBeDefined();
  });

  it('does NOT seed productos when seedEnabled is false', async () => {
    await runMigrations(exec, { seedEnabled: false });

    expect(exec.productSeedBatches().length).toBe(0);
    expect(
      exec.calls.some(
        (c) =>
          c.query.includes('INSERT INTO lotes_stock') &&
          c.query.includes('SELECT id, stock_almacen'),
      ),
    ).toBe(false);
  });

  it('inserts the admin seed (part of v2) even when seedEnabled is false', async () => {
    await runMigrations(exec, { seedEnabled: false });

    const adminInsert = exec.calls.find(
      (c) =>
        c.query.includes('INSERT INTO usuarios') &&
        c.params.includes(environment.adminUser),
    );
    expect(adminInsert).toBeDefined();
    expect(adminInsert!.params).toContain(environment.adminUser);
  });

  it('skips all migrations when schema_version is already 17', async () => {
    exec.version = 17;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([]);
    // el runner crea schema_version siempre, pero NO ejecuta migraciones v1-v17
    expect(exec.calls[0].query).toContain(
      'CREATE TABLE IF NOT EXISTS schema_version',
    );
    expect(
      exec.calls.some((c) => c.query.includes('CREATE TABLE IF NOT EXISTS jornadas')),
    ).toBe(false);
  });

  it('works on a completely fresh DB without a pre-created schema_version (M2)', async () => {
    exec.strictSchema = true;
    await runMigrations(exec, { seedEnabled: true });

    // el runner es autocontenido: la primera sentencia crea schema_version
expect(exec.calls[0].query).toContain(
      'CREATE TABLE IF NOT EXISTS schema_version',
    );
    expect(exec.versionNumbers()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it('runs only pending migrations from version 5 and still seeds', async () => {
    exec.version = 5;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
    expect(exec.productSeedBatches().length).toBe(8);
  });
});
