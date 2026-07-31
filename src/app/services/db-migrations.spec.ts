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

  async sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
    this.calls.push({ query, params });
    if (query.includes('COALESCE(MAX(version), 0)')) {
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

  it('inserts 16 schema versions in order on a fresh DB (v1..v16)', async () => {
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it('seeds productos in batches of 10 with lote seeds only when seedEnabled is true', async () => {
    await runMigrations(exec, { seedEnabled: true });

    const batches = exec.productSeedBatches();
    expect(batches.length).toBe(5);
    for (const batch of batches) {
      // 8 columnas x 10 filas por batch
      expect(batch.match(/\?/g)!.length).toBe(80);
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

  it('skips all migrations when schema_version is already 16', async () => {
    exec.version = 16;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([]);
    expect(exec.calls.some((c) => c.query.includes('CREATE TABLE'))).toBe(
      false,
    );
  });

  it('runs only pending migrations from version 5 and still seeds', async () => {
    exec.version = 5;
    await runMigrations(exec, { seedEnabled: true });

    expect(exec.versionNumbers()).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    expect(exec.productSeedBatches().length).toBe(5);
  });
});
