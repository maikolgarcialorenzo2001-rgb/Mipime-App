import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DATABASE, type Database } from './database';
import { hashPassword } from './hash-password';
import type { Usuario, UsuarioPublico } from '../models';

function mockCrypto(): void {
  const subtleDigest = vi.fn().mockImplementation(
    async (_algorithm: string, data: ArrayBuffer) => {
      const decoder = new TextDecoder();
      const input = decoder.decode(data);
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const buf = new ArrayBuffer(32);
      const view = new DataView(buf);
      view.setInt32(0, hash);
      return buf;
    },
  );
  const subtle = { digest: subtleDigest };
  Object.defineProperty(globalThis, 'crypto', {
    value: { subtle, getRandomValues: (arr: Uint8Array) => arr },
    configurable: true,
    writable: true,
  });
}

function createMockDb(): Database {
  const sql = vi.fn().mockResolvedValue([]) as unknown as Database['sql'];
  return {
    sql,
    transaction: vi.fn((fn) => fn({ sql: (q: string, p?: unknown[]) => sql(q, p) })),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService - legacy password detection', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockCrypto();
    mockDb = createMockDb();
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should set legacyResetRequired signal when user has legacy password hash (softwarez)', async () => {
    const salt = 'test-salt-123';
    const legacyHash = await hashPassword('softwarez', salt);
    const mockUser: Usuario = {
      id: 1, nombre: 'e.z', password_hash: legacyHash, salt,
      rol: 'admin', activo: 1, created_at: '', updated_at: '',
    };

    vi.mocked(mockDb.sql)
      .mockResolvedValueOnce([mockUser]) // get user by id
      .mockResolvedValueOnce([]); // getConfig legacy_reset_done (not set)

    localStorage.setItem('mipime_session', JSON.stringify({
      id: 1, nombre: 'e.z', rol: 'admin', activo: 1,
      created_at: '', updated_at: '',
    }));
    sessionStorage.setItem('session_heartbeat', '1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    const service = TestBed.inject(AuthService);
    // Wait for async _restoreSession to complete
    await new Promise(r => setTimeout(r, 10));
    expect(service.legacyResetRequired()).toBe(true);
  });

  it('should set legacyResetRequired signal when user has legacy password hash (admin123)', async () => {
    const salt = 'test-salt-456';
    const legacyHash = await hashPassword('admin123', salt);
    const mockUser: Usuario = {
      id: 2, nombre: 'admin', password_hash: legacyHash, salt,
      rol: 'admin', activo: 1, created_at: '', updated_at: '',
    };

    vi.mocked(mockDb.sql)
      .mockResolvedValueOnce([mockUser]) // get user by id
      .mockResolvedValueOnce([]); // getConfig legacy_reset_done (not set)

    localStorage.setItem('mipime_session', JSON.stringify({
      id: 2, nombre: 'admin', rol: 'admin', activo: 1,
      created_at: '', updated_at: '',
    }));
    sessionStorage.setItem('session_heartbeat', '1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    const service = TestBed.inject(AuthService);
    // Wait for async _restoreSession to complete
    await new Promise(r => setTimeout(r, 10));
    expect(service.legacyResetRequired()).toBe(true);
  });

  it('should NOT set legacyResetRequired for non-legacy password', async () => {
    const salt = 'test-salt-789';
    const hash = await hashPassword('secure-password', salt);
    const mockUser: Usuario = {
      id: 3, nombre: 'user', password_hash: hash, salt,
      rol: 'trabajador', activo: 1, created_at: '', updated_at: '',
    };

    vi.mocked(mockDb.sql)
      .mockResolvedValueOnce([mockUser]) // get user by id
      .mockResolvedValueOnce([]); // getConfig legacy_reset_done

    localStorage.setItem('mipime_session', JSON.stringify({
      id: 3, nombre: 'user', rol: 'trabajador', activo: 1,
      created_at: '', updated_at: '',
    }));
    sessionStorage.setItem('session_heartbeat', '1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    const service = TestBed.inject(AuthService);
    // Wait for async _restoreSession to complete
    await new Promise(r => setTimeout(r, 10));
    expect(service.legacyResetRequired()).toBe(false);
  });

  it('should not check legacy when config.legacy_reset_done is true', async () => {
    const salt = 'test-salt-999';
    const legacyHash = await hashPassword('softwarez', salt);
    const mockUser: Usuario = {
      id: 4, nombre: 'e.z', password_hash: legacyHash, salt,
      rol: 'admin', activo: 1, created_at: '', updated_at: '',
    };

    vi.mocked(mockDb.sql)
      .mockResolvedValueOnce([mockUser]) // get user by id
      .mockResolvedValueOnce([{ valor: '1' }]); // getConfig legacy_reset_done = true

    localStorage.setItem('mipime_session', JSON.stringify({
      id: 4, nombre: 'e.z', rol: 'admin', activo: 1,
      created_at: '', updated_at: '',
    }));
    sessionStorage.setItem('session_heartbeat', '1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    const service = TestBed.inject(AuthService);
    // Wait for async _restoreSession to complete
    await new Promise(r => setTimeout(r, 10));
    expect(service.legacyResetRequired()).toBe(false);
  });
});