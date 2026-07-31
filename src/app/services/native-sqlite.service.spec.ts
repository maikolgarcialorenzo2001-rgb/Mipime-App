import { TestBed } from '@angular/core/testing';
import { NativeSqliteService } from './native-sqlite.service';
import { DbStatusService } from './db-status.service';

const mockGetDatabaseFile = vi.hoisted(() => vi.fn());

vi.mock('sqlocal', () => ({
  // Clase real (no vi.fn): el servicio hace `new SQLocal(...)` y una arrow
  // function no es constructor → lanzaría y el catch enviaría file:null.
  SQLocal: class {
    getDatabaseFile = mockGetDatabaseFile;
  },
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

  it('sql debería rechazar cuando electronAPI no está disponible', async () => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;

    await expect(service.sql('SELECT 1')).rejects.toThrow(
      'Electron API no disponible',
    );
  });
});
