import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { DATABASE, type Database } from './database';
import { hashPassword, generateSalt } from './hash-password';
import type { Usuario } from '../models';

/**
 * Mock de crypto.subtle.digest que computa un hash determinista.
 * En jsdom no está disponible Web Crypto API, así que simulamos
 * SHA-256 con un hash de string simple.
 */
function mockCrypto(): void {
  const subtleDigest = vi.fn().mockImplementation(
    async (_algorithm: string, data: ArrayBuffer) => {
      const decoder = new TextDecoder();
      const input = decoder.decode(data);
      // Hash simple (no criptográfico, solo para tests)
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a int32
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

function createMockUsuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'admin',
    password_hash: '',
    salt: '',
    rol: 'admin',
    activo: 1,
    created_at: '2026-06-04T00:00:00Z',
    updated_at: '2026-06-04T00:00:00Z',
    ...overrides,
  };
}

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockCrypto();
    mockDb = createMockDb();
    localStorage.clear();

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
  });

  describe('login', () => {
    it('debería iniciar sesión con credenciales válidas', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('admin123', salt);
      const mockUser = createMockUsuario({ salt, password_hash: hash });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      const usuario = await firstValueFrom(
        service.login('admin', 'admin123'),
      );

      expect(usuario.nombre).toBe('admin');
      expect(usuario.rol).toBe('admin');
      expect(usuario).not.toHaveProperty('password_hash');
      expect(usuario).not.toHaveProperty('salt');
      expect(service.isLoggedIn()).toBe(true);
    });

    it('debería rechazar usuario inexistente', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(AuthService);
      await expect(
        firstValueFrom(service.login('noexiste', 'pass')),
      ).rejects.toThrow('Credenciales inválidas');

      expect(service.isLoggedIn()).toBe(false);
    });

    it('debería rechazar contraseña incorrecta', async () => {
      const salt = 'test-salt-123';
      const hash = await hashPassword('correcta', salt);
      const mockUser = createMockUsuario({ salt, password_hash: hash });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      await expect(
        firstValueFrom(service.login('admin', 'incorrecta')),
      ).rejects.toThrow('Credenciales inválidas');

      expect(service.isLoggedIn()).toBe(false);
    });

    it('debería rechazar usuario desactivado', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('admin123', salt);
      const mockUser = createMockUsuario({
        salt,
        password_hash: hash,
        activo: 0,
      });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      await expect(
        firstValueFrom(service.login('admin', 'admin123')),
      ).rejects.toThrow('Usuario desactivado');

      expect(service.isLoggedIn()).toBe(false);
    });
  });

  describe('logout', () => {
    it('debería limpiar la sesión', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('admin123', salt);
      const mockUser = createMockUsuario({ salt, password_hash: hash });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      await firstValueFrom(service.login('admin', 'admin123'));
      expect(service.isLoggedIn()).toBe(true);

      service.logout();

      expect(service.isLoggedIn()).toBe(false);
      expect(service.usuario()).toBeNull();
      expect(localStorage.getItem('mipime_session')).toBeNull();
    });
  });

  describe('isLoggedIn / hasRole', () => {
    it('debería empezar como false', () => {
      const service = TestBed.inject(AuthService);
      expect(service.isLoggedIn()).toBe(false);
    });

    it('debería ser true después de login exitoso', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('admin123', salt);
      const mockUser = createMockUsuario({ salt, password_hash: hash });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      await firstValueFrom(service.login('admin', 'admin123'));

      expect(service.isLoggedIn()).toBe(true);
    });

    it('hasRole debería funcionar', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('admin123', salt);
      const mockUser = createMockUsuario({
        salt,
        password_hash: hash,
        rol: 'admin',
      });

      vi.mocked(mockDb.sql).mockResolvedValue([mockUser]);

      const service = TestBed.inject(AuthService);
      await firstValueFrom(service.login('admin', 'admin123'));

      expect(service.hasRole('admin')).toBe(true);
      expect(service.hasRole('trabajador')).toBe(false);
    });
  });
});

describe('AuthService - localStorage', () => {
  beforeEach(() => {
    mockCrypto();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debería restaurar sesión desde localStorage', () => {
    const session = {
      id: 1,
      nombre: 'admin',
      rol: 'admin' as const,
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    };
    localStorage.setItem('mipime_session', JSON.stringify(session));

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.usuario()?.nombre).toBe('admin');
  });

  it('debería ignorar localStorage corrupto', () => {
    localStorage.setItem('mipime_session', 'not-valid-json');

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.isLoggedIn()).toBe(false);
  });

  it('debería ignorar si no hay session en localStorage', () => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.isLoggedIn()).toBe(false);
    expect(service.usuario()).toBeNull();
  });
});
