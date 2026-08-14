import { TestBed } from '@angular/core/testing';
import { SqliteService } from './sqlite.service';
import { PLATFORM_ID } from '@angular/core';
import { environment } from '../environments/environment';

// Track all SQL calls made through the mock client
const sqlCalls: { query: string; params: unknown[] }[] = [];

/** Override para controlar qué versión devuelve el mock de schema_version. */
let mockSchemaVersion: number | null = null;

class MockSQLocalClient {
  sql = vi.fn().mockImplementation((query: string, ...params: unknown[]) => {
    sqlCalls.push({ query, params });
    // Check schema_version: return version 1 so v1 is skipped, then v2 runs
    if (query.includes('COALESCE(MAX(version), 0)')) {
      return [{ version: mockSchemaVersion ?? 1 }];
    }
    // Check if admin user exists: return count 0 so seed runs
    if (query.includes("SELECT COUNT(*) AS count FROM usuarios WHERE nombre = ?") &&
        params.includes(environment.adminUser)) {
      return [{ count: 0 }];
    }
    // Seed check for productos (after migration)
    if (query.includes('SELECT COUNT(*) AS count FROM productos')) {
      return [{ count: 1 }];
    }
    return [];
  });

  // Simula la semántica de client.transaction() de SQLocal 0.18: ejecuta
  // BEGIN/COMMIT/ROLLBACK internos (registrados en sqlCalls para trazabilidad)
  // y pasa el handle { sql } al callback.
  transaction = vi.fn().mockImplementation(
    async (fn: (tx: { sql: (q: string, ...p: unknown[]) => Promise<unknown[]> }) => Promise<unknown>) => {
      sqlCalls.push({ query: 'BEGIN (client.transaction)', params: [] });
      try {
        const result = await fn({ sql: (q: string, ...p: unknown[]) => this.sql(q, ...p) });
        sqlCalls.push({ query: 'COMMIT (client.transaction)', params: [] });
        return result;
      } catch (err) {
        sqlCalls.push({ query: 'ROLLBACK (client.transaction)', params: [] });
        throw err;
      }
    },
  );
}

let mockClientInstance: MockSQLocalClient | null = null;
let mockDbName: string | null = null;

interface SQLocalConfig {
  databasePath: string;
  processor: Worker;
}

class MockSQLocal {
  constructor(config: SQLocalConfig) {
    mockDbName = config.databasePath;
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
    expect(sql).toContain("CHECK(tipo IN ('entrada', 'salida', 'ajuste', 'merma')");
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
        c.params.some((p) => p === 'admin'),
    );
    expect(adminInsert).toBeDefined();
    // El seed ya no incluye email, solo nombre ('admin') + hash + salt + rol + timestamps
    expect(adminInsert!.params).toContain('admin');
  });

  it('debería saltar migration v1 y ejecutar v2 directo si version >= 1', async () => {
    await service.initialize();

    // Should NOT have created v1 tables (they were already there)
    const v1TableCreates = sqlCalls.filter(
      (c) => c.query.includes('CREATE TABLE IF NOT EXISTS jornadas'),
    );
    expect(v1TableCreates.length).toBe(0);
  });

  it('debería usar dbName del environment en lugar de hardcode', async () => {
    await service.initialize();
    expect(mockDbName).toBe(environment.dbName);
  });
});

describe('SqliteService migration v5', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('1.1 RED: migration v5 debería recrear ventas con CHECK(forma_pago IN)', async () => {
    mockSchemaVersion = 4;
    await service.initialize();

    // Debería crear ventas_v5 con CHECK(forma_pago IN ('efectivo', 'transferencia'))
    const createV5 = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('ventas_v5'),
    );
    expect(createV5).toBeDefined();
    expect(createV5!.query).toContain(
      "CHECK(forma_pago IN ('efectivo', 'transferencia')",
    );

    // Debería migrar datos existentes
    const insertV5 = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO ventas_v5') &&
        c.query.includes('SELECT'),
    );
    expect(insertV5).toBeDefined();

    // Debería dropear tabla vieja y renombrar
    expect(
      sqlCalls.some((c) => c.query.includes('DROP TABLE ventas')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) =>
        c.query.includes('ALTER TABLE ventas_v5 RENAME TO ventas'),
      ),
    ).toBe(true);

    // Debería insertar version 5
    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (5)'),
      ),
    ).toBe(true);

    // Debería estar envuelto en transacción
    expect(
      sqlCalls.some((c) => c.query.includes('BEGIN TRANSACTION')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) => c.query.includes('COMMIT')),
    ).toBe(true);
  });
});

describe('SqliteService migration v6', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('1.6 RED: migration v6 debería recrear ventas con CHECK actualizado + cuenta_cosas', async () => {
    mockSchemaVersion = 5;
    await service.initialize();

    // Debería crear ventas_v6 con CHECK(forma_pago IN) actualizado
    const createV6 = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('ventas_v6'),
    );
    expect(createV6).toBeDefined();
    expect(createV6!.query).toContain(
      "CHECK(forma_pago IN ('efectivo','transferencia','divisas','pendiente')",
    );

    // Debería incluir las 6 columnas nuevas
    expect(createV6!.query).toContain('divisa_tipo TEXT');
    expect(createV6!.query).toContain('monto_divisa REAL');
    expect(createV6!.query).toContain('tasa_cambio REAL');
    expect(createV6!.query).toContain('comprador_nombre TEXT');
    expect(createV6!.query).toContain('autorizado_por TEXT');
    expect(createV6!.query).toContain('descripcion TEXT');

    // Debería migrar datos existentes
    const insertV6 = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO ventas_v6') &&
        c.query.includes('SELECT'),
    );
    expect(insertV6).toBeDefined();
    // Verificar que preserva columnas v5 y pone NULL en las nuevas
    expect(insertV6!.query).toContain('NULL, NULL, NULL, NULL, NULL, NULL');

    // Debería dropear tabla vieja y renombrar
    expect(
      sqlCalls.some((c) => c.query.includes('DROP TABLE ventas')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) =>
        c.query.includes('ALTER TABLE ventas_v6 RENAME TO ventas'),
      ),
    ).toBe(true);

    // Debería crear tabla cuenta_cosas
    const createCC = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('cuenta_cosas'),
    );
    expect(createCC).toBeDefined();
    expect(createCC!.query).toContain('jornada_id INTEGER NOT NULL REFERENCES jornadas(id)');
    expect(createCC!.query).toContain('producto_id INTEGER NOT NULL REFERENCES productos(id)');
    expect(createCC!.query).toContain('cantidad REAL NOT NULL');
    expect(createCC!.query).toContain('descripcion TEXT');
    expect(createCC!.query).toContain('autorizado_por TEXT NOT NULL');

    // Debería insertar version 6
    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (6)'),
      ),
    ).toBe(true);

    // Debería estar envuelto en transacción
    expect(
      sqlCalls.some((c) => c.query.includes('BEGIN TRANSACTION')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) => c.query.includes('COMMIT')),
    ).toBe(true);
  });

  it('1.6 RED: migration v6 debería preservar datos de v5', async () => {
    mockSchemaVersion = 5;
    await service.initialize();

    const insertV6 = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO ventas_v6') &&
        c.query.includes('SELECT'),
    );
    expect(insertV6).toBeDefined();
    // Verifica que el SELECT preserva columnas de v5 en orden
    expect(insertV6!.query).toContain('SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago');
  });
});

describe('SqliteService migration v7', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('C1 RED: migration v7 debería agregar columna jornada_id a stock_movimientos', async () => {
    mockSchemaVersion = 6;
    await service.initialize();

    // Debería ejecutar ALTER TABLE con jornada_id
    const alterTable = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('stock_movimientos') &&
        c.query.includes('ADD COLUMN'),
    );
    expect(alterTable).toBeDefined();
    expect(alterTable!.query).toContain('jornada_id');
    expect(alterTable!.query).toContain('REFERENCES jornadas(id)');

    // Debería insertar version 7
    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (7)'),
      ),
    ).toBe(true);
  });

  it('C1 RED: migration v7 debería ser segura con try/catch si columna ya existe', async () => {
    mockSchemaVersion = 6;
    await service.initialize();

    // El ALTER TABLE no debería romper si la columna ya existe (envuelto en try/catch)
    const alterCalls = sqlCalls.filter(
      (c) => c.query.includes('ALTER TABLE') && c.query.includes('stock_movimientos'),
    );
    // En condiciones normales debe ejecutarse al menos una vez
    expect(alterCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('C1 RED: migration v7 no debería ejecutarse si version >= 7', async () => {
    mockSchemaVersion = 7;
    await service.initialize();

    // Solo la ALTER que agrega jornada_id pertenece a v7 (no la de costo_total de v9)
    const v7AlterCalls = sqlCalls.filter(
      (c) => c.query.includes('ALTER TABLE') && c.query.includes('jornada_id'),
    );
    expect(v7AlterCalls.length).toBe(0);
  });
});

describe('SqliteService migration v11', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('T2 RED: v11 debería recrear productos con stock_almacen + stock_shop', async () => {
    mockSchemaVersion = 10;
    await service.initialize();

    // Verificar CREATE TABLE productos_v11 con nuevas columnas
    const createV11 = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('productos_v11'),
    );
    expect(createV11).toBeDefined();
    expect(createV11!.query).toContain('stock_almacen REAL NOT NULL DEFAULT 0');
    expect(createV11!.query).toContain('stock_shop REAL NOT NULL DEFAULT 0');

    // Verificar migración de datos: stock_actual → stock_almacen, stock_shop=0
    const insertV11 = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO productos_v11') &&
        c.query.includes('SELECT'),
    );
    expect(insertV11).toBeDefined();
    expect(insertV11!.query).toContain('stock_actual');
    expect(insertV11!.query).toContain('0'); // stock_shop default

    // DROP y RENAME
    expect(
      sqlCalls.some((c) => c.query.includes('DROP TABLE productos')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) =>
        c.query.includes('ALTER TABLE productos_v11 RENAME TO productos'),
      ),
    ).toBe(true);
  });

  it('T2 RED: v11 debería agregar ubicacion a lotes_stock vía ALTER TABLE', async () => {
    mockSchemaVersion = 10;
    await service.initialize();

    const alterLotes = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('lotes_stock') &&
        c.query.includes('ubicacion'),
    );
    expect(alterLotes).toBeDefined();
    expect(alterLotes!.query).toContain("DEFAULT 'almacen'");
    expect(alterLotes!.query).toContain("CHECK(ubicacion IN ('almacen','shop')");
  });

  it('T2 RED: v11 debería recrear stock_movimientos con traslado en CHECK', async () => {
    mockSchemaVersion = 10;
    await service.initialize();

    const createSM = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') &&
        c.query.includes('stock_movimientos_v11'),
    );
    expect(createSM).toBeDefined();
    expect(createSM!.query).toContain("'traslado'");

    const dropSM = sqlCalls.find(
      (c) => c.query.includes('DROP TABLE') && c.query.includes('stock_movimientos'),
    );
    expect(dropSM).toBeDefined();

    const renameSM = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('stock_movimientos_v11') &&
        c.query.includes('RENAME TO'),
    );
    expect(renameSM).toBeDefined();
  });

  it('T2 RED: v11 debería ejecutarse dentro de transacción y registrar version 11', async () => {
    mockSchemaVersion = 10;
    await service.initialize();

    expect(
      sqlCalls.some((c) => c.query.includes('BEGIN TRANSACTION')),
    ).toBe(true);

    expect(
      sqlCalls.some((c) => c.query.includes('COMMIT')),
    ).toBe(true);

    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (11)'),
      ),
    ).toBe(true);
  });

  it('T2 RED: v11 no debería ejecutarse si schema_version >= 11', async () => {
    mockSchemaVersion = 11;
    await service.initialize();

    const createV11 = sqlCalls.filter(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('productos_v11'),
    );
    expect(createV11.length).toBe(0);
  });

  it('T2 RED: fresh DB debería ejecutar v11 (schema_version=0)', async () => {
    mockSchemaVersion = 0;
    await service.initialize();

    // Should run all migrations including v11
    const v11Insert = sqlCalls.find(
      (c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (11)'),
    );
    expect(v11Insert).toBeDefined();
  });
});

describe('SqliteService migration v13', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('T1 RED: v13 debería crear tabla arqueo_caja con estructura correcta', async () => {
    mockSchemaVersion = 12;
    await service.initialize();

    const createTable = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('arqueo_caja'),
    );
    expect(createTable).toBeDefined();
    expect(createTable!.query).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(createTable!.query).toContain('jornada_id INTEGER NOT NULL REFERENCES jornadas(id)');
    expect(createTable!.query).toContain('denominacion INTEGER NOT NULL');
    expect(createTable!.query).toContain('cantidad INTEGER NOT NULL DEFAULT 0');
    expect(createTable!.query).toContain('created_at TEXT NOT NULL');
  });

  it('T1 RED: v13 debería crear índice idx_arqueo_jornada', async () => {
    mockSchemaVersion = 12;
    await service.initialize();

    const createIndex = sqlCalls.find(
      (c) =>
        c.query.includes('CREATE INDEX') && c.query.includes('idx_arqueo_jornada'),
    );
    expect(createIndex).toBeDefined();
    expect(createIndex!.query).toContain('arqueo_caja(jornada_id)');
  });

  it('T1 RED: v13 debería registrar versión 13 en schema_version', async () => {
    mockSchemaVersion = 12;
    await service.initialize();

    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (13)'),
      ),
    ).toBe(true);
  });

  it('T1 RED: v13 no debería ejecutarse si schema_version >= 13', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const createTable = sqlCalls.filter(
      (c) =>
        c.query.includes('CREATE TABLE') && c.query.includes('arqueo_caja'),
    );
    expect(createTable.length).toBe(0);
  });
});

describe('SqliteService migration v14', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  afterEach(() => {
    mockSchemaVersion = null;
  });

  it('T2 RED: v14 debería agregar divisa_tipo a movimientos', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const alterDivisaTipo = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('movimientos') &&
        c.query.includes('divisa_tipo'),
    );
    expect(alterDivisaTipo).toBeDefined();
    expect(alterDivisaTipo!.query).toContain('divisa_tipo TEXT');
  });

  it('T2 RED: v14 debería agregar monto_divisa a movimientos', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const alterMontoDivisa = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('movimientos') &&
        c.query.includes('monto_divisa'),
    );
    expect(alterMontoDivisa).toBeDefined();
    expect(alterMontoDivisa!.query).toContain('monto_divisa REAL');
  });

  it('T2 RED: v14 debería agregar tasa_cambio a movimientos', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const alterTasaCambio = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('movimientos') &&
        c.query.includes('tasa_cambio'),
    );
    expect(alterTasaCambio).toBeDefined();
    expect(alterTasaCambio!.query).toContain('tasa_cambio REAL');
  });

  it('T2 RED: v14 debería agregar total_usd a jornadas', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const alterTotalUsd = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('jornadas') &&
        c.query.includes('total_usd'),
    );
    expect(alterTotalUsd).toBeDefined();
    expect(alterTotalUsd!.query).toContain('total_usd REAL DEFAULT 0');
  });

  it('T2 RED: v14 debería agregar total_eur a jornadas', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    const alterTotalEur = sqlCalls.find(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('jornadas') &&
        c.query.includes('total_eur'),
    );
    expect(alterTotalEur).toBeDefined();
    expect(alterTotalEur!.query).toContain('total_eur REAL DEFAULT 0');
  });

  it('T2 RED: v14 debería registrar versión 14 en schema_version', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    expect(
      sqlCalls.some((c) =>
        c.query.includes('INSERT INTO schema_version') &&
        c.query.includes('VALUES (14)'),
      ),
    ).toBe(true);
  });

  it('T2 RED: v14 no debería ejecutarse si schema_version >= 14', async () => {
    mockSchemaVersion = 14;
    await service.initialize();

    const alterCalls = sqlCalls.filter(
      (c) =>
        c.query.includes('ALTER TABLE') &&
        c.query.includes('movimientos') &&
        c.query.includes('divisa_tipo'),
    );
    expect(alterCalls.length).toBe(0);
  });

  it('T2 RED: v14 debería usar try/catch para ALTER TABLE seguros', async () => {
    mockSchemaVersion = 13;
    await service.initialize();

    // ALTER TABLE calls should be present in the log (wrapped with try/catch in impl)
    const movAlters = sqlCalls.filter(
      (c) =>
        c.query.includes('ALTER TABLE') && c.query.includes('movimientos'),
    );
    expect(movAlters.length).toBeGreaterThanOrEqual(3);

    const jornadaAlters = sqlCalls.filter(
      (c) =>
        c.query.includes('ALTER TABLE') && c.query.includes('jornadas'),
    );
    expect(jornadaAlters.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SqliteService persist web (T11/R9)', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  it('T11 RED: debería solicitar persist() tras initialize exitoso (R9)', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', {
      value: { persist: persistMock },
      configurable: true,
    });

    await service.initialize();

    expect(persistMock).toHaveBeenCalled();
  });

  it('T11 RED: no debería lanzar si navigator.storage no está disponible (R9)', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      configurable: true,
    });

    await expect(service.initialize()).resolves.toBeUndefined();
  });
});

describe('SqliteService transaction (T-07 / FR-05 / D1)', () => {
  let service: SqliteService;

  beforeEach(() => {
    sqlCalls.length = 0;
    vi.clearAllMocks();

    globalThis.Worker = vi.fn().mockImplementation(function () {
      return {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
    }) as unknown as typeof Worker;

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

  it('8.1 RED: transaction() delega en client.transaction (éxito → COMMIT)', async () => {
    const result = await service.transaction(async (tx) => {
      await tx.sql(
        'INSERT INTO stock_movimientos (producto_id, cantidad, tipo, motivo, created_at) VALUES (1, 10, \'entrada\', NULL, \'2026-01-01\')',
      );
      return 42;
    });

    expect(result).toBe(42);
    expect(mockClientInstance!.transaction).toHaveBeenCalledTimes(1);
    // El SQL de la txn pasó por el client (handle de SQLocal)
    expect(
      sqlCalls.some((c) => c.query.includes('INSERT INTO stock_movimientos')),
    ).toBe(true);
    // Simulación del mock: commit y sin rollback
    expect(sqlCalls.some((c) => c.query.includes('COMMIT'))).toBe(true);
    expect(sqlCalls.some((c) => c.query.includes('ROLLBACK'))).toBe(false);
  });

  it('8.2 RED: fallo dentro de fn → ROLLBACK y transaction() rechaza (DB sin cambios)', async () => {
    await expect(
      service.transaction(async (tx) => {
        await tx.sql('UPDATE productos SET stock_shop = 0 WHERE id = 1');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(mockClientInstance!.transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls.some((c) => c.query.includes('ROLLBACK'))).toBe(true);
    expect(sqlCalls.some((c) => c.query.includes('COMMIT'))).toBe(false);
  });

  it('8.3 RED: JOIN bajo BEGIN raw — sin segundo BEGIN, fn corre desnuda vía sql()', async () => {
    await service.sql('BEGIN TRANSACTION');
    const result = await service.transaction(async (tx) => {
      await tx.sql('UPDATE productos SET stock_shop = 5 WHERE id = 1');
      return 'ok';
    });
    await service.sql('COMMIT');

    expect(result).toBe('ok');
    // JOIN: client.transaction NO se llama (evita "transaction within a transaction")
    expect(mockClientInstance!.transaction).not.toHaveBeenCalled();
    expect(
      sqlCalls.some((c) => c.query.includes('UPDATE productos SET stock_shop = 5')),
    ).toBe(true);
  });

  it('8.4 RED TRIANGULATE: JOIN anidado transaction() dentro de transaction() — client.transaction una sola vez', async () => {
    const result = await service.transaction(async (outer) => {
      await outer.sql('UPDATE productos SET stock_almacen = 3 WHERE id = 1');
      return service.transaction(async (inner) => {
        await inner.sql('UPDATE lotes_stock SET cantidad = 2 WHERE id = 1');
        return 'inner';
      });
    });

    expect(result).toBe('inner');
    expect(mockClientInstance!.transaction).toHaveBeenCalledTimes(1);
    expect(
      sqlCalls.some((c) => c.query.includes('UPDATE productos SET stock_almacen = 3')),
    ).toBe(true);
    expect(
      sqlCalls.some((c) => c.query.includes('UPDATE lotes_stock SET cantidad = 2')),
    ).toBe(true);
  });

  it('8.5 RED TRIANGULATE: tras COMMIT del BEGIN raw, una transaction() nueva abre txn propia', async () => {
    await service.sql('BEGIN TRANSACTION');
    await service.sql('COMMIT');

    await service.transaction(async (tx) => {
      await tx.sql('SELECT 1');
    });

    // depth volvió a 0 → client.transaction se usa de nuevo (no JOIN)
    expect(mockClientInstance!.transaction).toHaveBeenCalledTimes(1);
  });
});
