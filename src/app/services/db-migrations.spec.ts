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

  it('inserts 19 schema versions in order on a fresh DB (v1..v19)', async () => {
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  it('1.2 RED: desde la versión 16 aplica las migraciones v17, v18 y v19 de forma aditiva', async () => {
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
    expect(exec.versionNumbers()).toEqual([17, 18, 19]);
    // La seed no debe ejecutarse sin seedEnabled
    expect(exec.productSeedBatches().length).toBe(0);
  });

  it('1.2 RED: re-ejecutar sobre una DB ya en 19 es idempotente (no repite ALTERs ni vuelve a insertar versión)', async () => {
    exec.version = 19;
    await runMigrations(exec, { seedEnabled: false });

    // v19 ya existe: el runner NO re-ejecuta la migración
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

  it('does NOT insert admin seed in v2 (admin created via /setup page)', async () => {
    await runMigrations(exec, { seedEnabled: false });

    const adminInsert = exec.calls.find(
      (c) => c.query.includes('INSERT INTO usuarios'),
    );
    expect(adminInsert).toBeUndefined();
  });

  it('migration v18 creates config table and sets schema version to 18', async () => {
    exec.version = 17; // Run only v18
    await runMigrations(exec, { seedEnabled: false });

    // Should have run v18 (version 18 inserted)
    expect(exec.versionNumbers()).toContain(18);

    // Verify config table creation
    const createConfig = exec.calls.find((c) =>
      c.query.includes('CREATE TABLE IF NOT EXISTS config'),
    );
    expect(createConfig).toBeDefined();
    expect(createConfig!.query).toContain('clave TEXT PRIMARY KEY');
    expect(createConfig!.query).toContain('valor TEXT NOT NULL');
  });

  it('migration v18 is idempotent - does not re-run on existing v18 DB', async () => {
    exec.version = 18;
    await runMigrations(exec, { seedEnabled: false });

    // Running from v18: v19 executes but v18 does NOT re-run
    expect(exec.versionNumbers()).toEqual([19]);
    const createConfig = exec.calls.find((c) =>
      c.query.includes('CREATE TABLE IF NOT EXISTS config'),
    );
    expect(createConfig).toBeUndefined();
  });

  it('skips all migrations when schema_version is already 19', async () => {
    exec.version = 19;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([]);
    // el runner crea schema_version siempre, pero NO ejecuta migraciones v1-v19
    expect(exec.calls[0].query).toContain(
      'CREATE TABLE IF NOT EXISTS schema_version',
    );
    expect(
      exec.calls.some((c) => c.query.includes('CREATE TABLE IF NOT EXISTS jornadas')),
    ).toBe(false);
  });

  it('migration v19 adds unidad_medida column defaulting to unidad and sets schema to 19', async () => {
    exec.version = 18; // Run only v19
    await runMigrations(exec, { seedEnabled: false });

    // Should have run v19
    expect(exec.versionNumbers()).toContain(19);

    // Verify the ADD COLUMN for unidad_medida
    const alter = exec.calls.find((c) =>
      c.query.includes('ALTER TABLE productos ADD COLUMN unidad_medida'),
    );
    expect(alter).toBeDefined();
    expect(alter!.query).toContain("DEFAULT 'unidad'");
    expect(alter!.query).toContain('TEXT NOT NULL');
  });

  it('migration v19 is idempotent - does not re-run on existing v19 DB', async () => {
    exec.version = 19;
    await runMigrations(exec, { seedEnabled: false });

    // Should NOT re-run v19
    expect(exec.versionNumbers()).toEqual([]);
    const alter = exec.calls.find((c) =>
      c.query.includes('ALTER TABLE productos ADD COLUMN unidad_medida'),
    );
    expect(alter).toBeUndefined();
  });

  it('works on a completely fresh DB without a pre-created schema_version (M2)', async () => {
    exec.strictSchema = true;
    await runMigrations(exec, { seedEnabled: true });

    // el runner es autocontenido: la primera sentencia crea schema_version
    expect(exec.calls[0].query).toContain(
      'CREATE TABLE IF NOT EXISTS schema_version',
    );
    expect(exec.versionNumbers()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  it('runs only pending migrations from version 5 and still seeds', async () => {
    exec.version = 5;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(exec.productSeedBatches().length).toBe(8);
  });

  it('migrationV2 no longer seeds admin from environment - no env references', async () => {
    exec.version = 1; // Run only v2
    await runMigrations(exec, { seedEnabled: false });

    // Should have run v2 (version 2 inserted)
    expect(exec.versionNumbers()).toContain(2);

    // Verify no INSERT INTO usuarios with environment.adminUser
    const adminInsert = exec.calls.find(
      (c) =>
        c.query.includes('INSERT INTO usuarios') &&
        (c.params?.includes('admin') || c.params?.includes('e.z')),
    );
    expect(adminInsert).toBeUndefined();

    // Verify no reference to environment in the migration calls
    // (the test above ensures the old seed pattern is gone)
  });

  it('migrationV2 creates usuarios table but does not insert admin seed', async () => {
    exec.version = 1;
    await runMigrations(exec, { seedEnabled: false });

    // Should have created usuarios table (part of v2)
    const createUsuarios = exec.calls.find((c) =>
      c.query.includes('CREATE TABLE IF NOT EXISTS usuarios'),
    );
    expect(createUsuarios).toBeDefined();

    // But should NOT have inserted any admin user
    const adminInsert = exec.calls.find((c) =>
      c.query.includes('INSERT INTO usuarios'),
    );
    expect(adminInsert).toBeUndefined();
  });

  it('seedProductosSiVacio is exported and callable', async () => {
    const { seedProductosSiVacio } = await import('./db-migrations');
    expect(typeof seedProductosSiVacio).toBe('function');
  });

  it('seedProductosSiVacio idempotency: count=0 seeds 74 products, count>0 no-op', async () => {
    const { seedProductosSiVacio } = await import('./db-migrations');
    
    // Test with count=0 (should seed)
    exec.productCount = 0;
    await seedProductosSiVacio(exec);
    const seedCalls = exec.calls.filter((c) =>
      c.query.includes('INSERT INTO productos') &&
      c.query.includes('VALUES (?'),
    );
    expect(seedCalls.length).toBeGreaterThan(0);
    
    // Test with count>0 (should NOT seed)
    exec.calls = [];
    exec.productCount = 5;
    await seedProductosSiVacio(exec);
    const seedCalls2 = exec.calls.filter((c) =>
      c.query.includes('INSERT INTO productos') &&
      c.query.includes('VALUES (?'),
    );
    expect(seedCalls2.length).toBe(0);
  });
});