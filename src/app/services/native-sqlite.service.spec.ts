import { TestBed } from '@angular/core/testing';
import { NativeSqliteService } from './native-sqlite.service';
import { DbStatusService } from './db-status.service';

const mockGetDatabaseFile = vi.hoisted(() => vi.fn());
const mockCreateSqlocalClient = vi.hoisted(() => vi.fn());

// M1: el roundtrip construye SQLocal vía la factoría compartida
// (sqlocal-client), NO con `new SQLocal(...)` directo: el Worker explícito
// procesado por Vite evita NS_ERROR_CORRUPTED_CONTENT en este build.
vi.mock('./sqlocal-client', () => ({
  createSqlocalClient: mockCreateSqlocalClient,
}));

describe('NativeSqliteService', () => {
  let service: NativeSqliteService;
  let dbStatus: DbStatusService;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // hash-password usa Web Crypto (jsdom no expone crypto.subtle.digest)
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
        getRandomValues: (arr: Uint8Array) => arr,
      },
      configurable: true,
      writable: true,
    });

    invokeMock = vi.fn();
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      invoke: invokeMock,
    } as unknown as ElectronAPI;

    mockCreateSqlocalClient.mockResolvedValue({
      getDatabaseFile: mockGetDatabaseFile,
    } as never);

    TestBed.configureTestingModule({
      providers: [NativeSqliteService, DbStatusService],
    });
    service = TestBed.inject(NativeSqliteService);
    dbStatus = TestBed.inject(DbStatusService);
  });

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    vi.clearAllMocks();
  });

  /**
   * Mock de invoke con respuestas inteligentes para db:sql:
   * los COUNT de migraciones devuelven 0 filas, el resto de sentencias [].
   * Para canales no-sql se consumen los statuses en orden (cola).
   */
  function mockInvokeSequence(statuses: unknown[]): void {
    invokeMock.mockImplementation(
      (channel: string, payload?: { query?: string }) => {
        if (channel === 'db:sql') {
          if (payload?.query?.includes('SELECT COUNT(')) {
            return Promise.resolve([{ count: 0 }]);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve(statuses.shift() ?? { status: 'ok' });
      },
    );
  }

  it('sql debería pasar query y params a db:sql y devolver las filas', async () => {
    invokeMock.mockResolvedValue([{ a: 1 }]);

    const rows = await service.sql<{ a: number }>('SELECT 1 AS a');

    expect(invokeMock).toHaveBeenCalledWith('db:sql', {
      query: 'SELECT 1 AS a',
      params: [],
    });
    expect(rows).toEqual([{ a: 1 }]);

    await service.sql('SELECT ? AS b', [7]);
    expect(invokeMock).toHaveBeenLastCalledWith('db:sql', {
      query: 'SELECT ? AS b',
      params: [7],
    });
  });

  it('initialize con status ok debería correr migraciones vía db:sql', async () => {
    mockInvokeSequence([{ status: 'ok' }]);

    await service.initialize();

    expect(dbStatus.fatal()).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('db:initialize');
    const sqlCalls = invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql');
    expect(sqlCalls.length).toBeGreaterThan(0);
    expect(sqlCalls[0][1]).toEqual({
      query: expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_version'),
      params: [],
    });
  });

  it('initialize con status fatal debería publicar diagnostics y resolver sin lanzar (RESOLVED-RISK-2)', async () => {
    const diagnostics: DbDiagnostics = {
      appVersion: '0.1.8-beta',
      platform: 'win32',
      sqliteError: 'integrity check failed: database disk image is malformed',
      stage: 'open',
      backupsTried: [{ path: 'x.db', reason: 'invalid' }],
    };
    mockInvokeSequence([{ status: 'fatal', diagnostics }]);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toEqual(diagnostics);
    // fatal corta antes de runMigrations
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize con status import-needed debería importar OPFS y re-inicializar', async () => {
    // getDatabaseFile devuelve un File web (jsdom lo implementa).
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' }, // db:initialize
      { ok: true }, // db:import
      { status: 'ok' }, // db:initialize re-run
    ]);

    await service.initialize();

    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:initialize').length,
    ).toBe(2);
    expect(invokeMock).toHaveBeenCalledWith('db:import', {
      file: expect.any(ArrayBuffer),
    });
    expect(dbStatus.fatal()).toBeNull();
  });

  it('initialize debería enviar file:null cuando no hay datos OPFS (CANTOPEN/empty)', async () => {
    mockGetDatabaseFile.mockRejectedValue(new Error('SQLITE_CANTOPEN'));
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'ok' },
    ]);

    await service.initialize();

    expect(invokeMock).toHaveBeenCalledWith('db:import', { file: null });
  });

  it('initialize con re-init fatal tras roundtrip debería publicar diagnostics y NO migrar (M1)', async () => {
    const diagnostics: DbDiagnostics = {
      appVersion: '0.1.8-beta',
      platform: 'win32',
      sqliteError: 'disk failure',
      stage: 'open',
      backupsTried: [],
    };
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'fatal', diagnostics },
    ]);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toEqual(diagnostics);
    // fatal tras el roundtrip corta ANTES de runMigrations
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize con re-init import-needed tras roundtrip debería publicar fatal stage import y NO migrar (M2)', async () => {
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'import-needed' },
    ]);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({
      stage: 'import',
      sqliteError: expect.any(String),
    });
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize debería publicar fatal stage import y NO migrar cuando db:import devuelve {ok:false} (M2)', async () => {
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: false, error: 'import validation failed: integrity=corrupt' },
    ]);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({
      stage: 'import',
      sqliteError: 'import validation failed: integrity=corrupt',
    });
    // import fallido: NO se re-ejecuta db:initialize ni se migra
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:initialize').length,
    ).toBe(1);
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize debería publicar fatal stage import cuando db:import rechaza el invoke (M1)', async () => {
    invokeMock.mockImplementation((channel: string) => {
      if (channel === 'db:initialize') {
        return Promise.resolve({ status: 'import-needed' });
      }
      if (channel === 'db:import') {
        return Promise.reject(new Error('ipc broken'));
      }
      return Promise.resolve([]);
    });

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({
      stage: 'import',
      sqliteError: 'ipc broken',
    });
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize debería publicar fatal stage open cuando el primer db:initialize rechaza (M1)', async () => {
    invokeMock.mockImplementation((channel: string) => {
      if (channel === 'db:initialize') {
        return Promise.reject(new Error('boot broken'));
      }
      return Promise.resolve([]);
    });

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({
      stage: 'open',
      sqliteError: 'boot broken',
    });
    expect(
      invokeMock.mock.calls.filter(([ch]) => ch === 'db:sql').length,
    ).toBe(0);
  });

  it('initialize debería enviar file:null cuando el archivo OPFS está vacío (0 bytes) (T7)', async () => {
    mockGetDatabaseFile.mockResolvedValue(new File([], 'tienda-app.db'));
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'ok' },
    ]);

    await service.initialize();

    // Archivo OPFS vacío = sin datos → mismo contrato que CANTOPEN (file:null)
    expect(invokeMock).toHaveBeenCalledWith('db:import', { file: null });
  });

  it('initialize debería publicar fatal stage open y resolver sin lanzar cuando db:sql rechaza durante runMigrations (C2)', async () => {
    invokeMock.mockImplementation((channel: string) => {
      if (channel === 'db:initialize') {
        return Promise.resolve({ status: 'ok' });
      }
      if (channel === 'db:sql') {
        return Promise.reject(new Error('sql failed'));
      }
      return Promise.resolve([]);
    });

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({
      stage: 'open',
      sqliteError: 'sql failed',
    });
  });

  it('el roundtrip debería construir SQLocal vía la factoría compartida (M1)', async () => {
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'ok' },
    ]);

    await service.initialize();

    expect(mockCreateSqlocalClient).toHaveBeenCalledTimes(1);
  });

  it('el diagnóstico sintetizado debería usar la versión real de app:getVersion (MINOR-5)', async () => {
    invokeMock.mockImplementation((channel: string) => {
      if (channel === 'app:getVersion') {
        return Promise.resolve('0.9.0');
      }
      if (channel === 'db:initialize') {
        return Promise.reject(new Error('boot broken'));
      }
      return Promise.resolve([]);
    });

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(dbStatus.fatal()).toMatchObject({ appVersion: '0.9.0' });
  });

  it('el roundtrip es no destructivo: solo lee OPFS vía getDatabaseFile y nunca invoca canales ajenos al contrato (R8)', async () => {
    mockGetDatabaseFile.mockResolvedValue(
      new File([new Uint8Array(16)], 'tienda-app.db'),
    );
    mockInvokeSequence([
      { status: 'import-needed' },
      { ok: true },
      { status: 'ok' },
    ]);

    await service.initialize();

    expect(mockGetDatabaseFile).toHaveBeenCalledTimes(1);
    const channels = invokeMock.mock.calls.map(([ch]) => ch);
    for (const ch of channels) {
      expect(['db:initialize', 'db:import', 'db:sql']).toContain(ch);
    }
  });

  it('sql debería rechazar cuando electronAPI no está disponible', async () => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;

    await expect(service.sql('SELECT 1')).rejects.toThrow(
      'Electron API no disponible',
    );
  });
});
