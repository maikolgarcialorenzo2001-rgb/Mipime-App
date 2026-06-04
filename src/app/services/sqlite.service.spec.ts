import { TestBed } from '@angular/core/testing';
import { SqliteService } from './sqlite.service';
import { PLATFORM_ID } from '@angular/core';

// Track all SQL calls made through the mock client
const sqlCalls: { query: string; params: unknown[] }[] = [];

class MockSQLocalClient {
  sql = vi.fn().mockImplementation((query: string, ...params: unknown[]) => {
    sqlCalls.push({ query, params });
    // Check schema_version: return version 1 so v1 is skipped, then v2 runs
    if (query.includes('COALESCE(MAX(version), 0)')) {
      return [{ version: 1 }];
    }
    // Check if admin user exists: return count 0 so seed runs
    if (query.includes("SELECT COUNT(*) AS count FROM usuarios WHERE email = 'admin@mipime.com'")) {
      return [{ count: 0 }];
    }
    // Seed check for productos (after migration)
    if (query.includes('SELECT COUNT(*) AS count FROM productos')) {
      return [{ count: 1 }];
    }
    return [];
  });
}

let mockClientInstance: MockSQLocalClient | null = null;

class MockSQLocal {
  constructor(_dbName: string) {
    mockClientInstance = new MockSQLocalClient();
    return mockClientInstance;
  }
}

vi.mock('sqlocal', () => ({
  SQLocal: MockSQLocal,
}));

describe('SqliteService migration v2', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    mockClientInstance = null;
    vi.clearAllMocks();

    // Mock Worker para el processor custom (jsdom no tiene Worker)
    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

    // Mock Web Crypto API para hashPassword (jsdom no tiene crypto.subtle.digest)
    const subtleDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: { digest: subtleDigest },
        getRandomValues: (arr: Uint8Array) => arr,
      },
      configurable: true,
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        SqliteService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(SqliteService);
  });

  it('debería crear tabla usuarios en migration v2', async () => {
    await service.initialize();

    const createTableCalls = sqlCalls.filter(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('usuarios'),
    );

    expect(createTableCalls.length).toBeGreaterThanOrEqual(1);
    const usuariosSql = createTableCalls[0].query;
    expect(usuariosSql).toContain('usuarios');
    expect(usuariosSql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(usuariosSql).toContain('nombre TEXT NOT NULL');
    expect(usuariosSql).toContain('email TEXT NOT NULL UNIQUE');
    expect(usuariosSql).toContain('password_hash TEXT NOT NULL');
    expect(usuariosSql).toContain('salt TEXT NOT NULL');
    expect(usuariosSql).toContain('rol TEXT NOT NULL DEFAULT');
    expect(usuariosSql).toContain('CHECK(rol IN');
    expect(usuariosSql).toContain('activo INTEGER NOT NULL DEFAULT 1');
    expect(usuariosSql).toContain('created_at TEXT NOT NULL');
    expect(usuariosSql).toContain('updated_at TEXT NOT NULL');
  });

  it('debería crear tabla stock_movimientos en migration v2', async () => {
    await service.initialize();

    const createTableCalls = sqlCalls.filter(
      (c) =>
        c.query.includes('CREATE TABLE') &&
        c.query.includes('stock_movimientos'),
    );

    expect(createTableCalls.length).toBeGreaterThanOrEqual(1);
    const sql = createTableCalls[0].query;
    expect(sql).toContain('producto_id INTEGER NOT NULL REFERENCES productos(id)');
    expect(sql).toContain('cantidad REAL NOT NULL');
    expect(sql).toContain("CHECK(tipo IN ('entrada', 'salida', 'ajuste')");
    expect(sql).toContain('motivo TEXT');
  });

  it('debería crear tabla jornada_reportes en migration v2', async () => {
    await service.initialize();

    const createTableCalls = sqlCalls.filter(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('jornada_reportes'),
    );

    expect(createTableCalls.length).toBeGreaterThanOrEqual(1);
    const sql = createTableCalls[0].query;
    expect(sql).toContain('jornada_id INTEGER NOT NULL REFERENCES jornadas(id)');
    expect(sql).toContain('content_type TEXT NOT NULL DEFAULT');
    expect(sql).toContain('content_base64 TEXT NOT NULL');
    expect(sql).toContain('filename TEXT NOT NULL');
  });

  it('debería ejectuar ALTER TABLE para user_cierre_id en jornadas', async () => {
    await service.initialize();

    const alterCalls = sqlCalls.filter((c) =>
      c.query.includes('ALTER TABLE'),
    );

    expect(alterCalls.length).toBeGreaterThanOrEqual(1);
    const userCierreAlter = alterCalls.find((c) =>
      c.query.includes('user_cierre_id'),
    );
    expect(userCierreAlter).toBeDefined();
    expect(userCierreAlter!.query).toContain('jornadas');
  });

  it('debería ejectuar ALTER TABLE para usuario_id en ventas', async () => {
    await service.initialize();

    const alterCalls = sqlCalls.filter((c) =>
      c.query.includes('ALTER TABLE'),
    );

    const usuarioIdAlter = alterCalls.find((c) =>
      c.query.includes('usuario_id'),
    );
    expect(usuarioIdAlter).toBeDefined();
    expect(usuarioIdAlter!.query).toContain('ventas');
  });

  it('debería ejectuar ALTER TABLE para forma_pago en ventas', async () => {
    await service.initialize();

    const alterCalls = sqlCalls.filter((c) =>
      c.query.includes('ALTER TABLE'),
    );

    const formaPagoAlter = alterCalls.find((c) =>
      c.query.includes('forma_pago'),
    );
    expect(formaPagoAlter).toBeDefined();
    expect(formaPagoAlter!.query).toContain('ventas');
    expect(formaPagoAlter!.query).toContain("'efectivo'");
    expect(formaPagoAlter!.query).toContain('CHECK(forma_pago IN');
  });

  it('debería insertar version 2 en schema_version', async () => {
    await service.initialize();

    const versionInsert = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (2)'),
    );
    expect(versionInsert).toBeDefined();
  });

  it('debería insertar seed admin si no existe', async () => {
    await service.initialize();

    const adminInsert = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO usuarios') &&
        c.params.some((p) => p === 'Admin'),
    );
    expect(adminInsert).toBeDefined();
    expect(adminInsert!.params).toContain('admin@mipime.com');
  });

  it('debería saltar migration v1 y ejecutar v2 directo si version >= 1', async () => {
    await service.initialize();

    // Should NOT have created v1 tables (they were already there)
    const v1TableCreates = sqlCalls.filter(
      (c) => c.query.includes('CREATE TABLE IF NOT EXISTS jornadas'),
    );
    expect(v1TableCreates.length).toBe(0);
  });
});
