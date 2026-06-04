import { TestBed } from '@angular/core/testing';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { DATABASE, type Database } from './database';
import { hashPassword, generateSalt } from './hash-password';
import type { Usuario, UsuarioPublico } from '../models';

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

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UserService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockCrypto();
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('debería retornar todos los usuarios sin password_hash ni salt', async () => {
      const mockUsers: UsuarioPublico[] = [
        {
          id: 1, nombre: 'admin', rol: 'admin', activo: 1,
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2, nombre: 'trabajador1', rol: 'trabajador', activo: 1,
          created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
        },
      ];
      vi.mocked(mockDb.sql).mockResolvedValue(mockUsers);

      const service = TestBed.inject(UserService);
      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].nombre).toBe('admin');
      expect(result[0].rol).toBe('admin');
      expect(result[0]).not.toHaveProperty('password_hash');
      expect(result[0]).not.toHaveProperty('salt');
      expect(result[1].nombre).toBe('trabajador1');
      expect(result[1].rol).toBe('trabajador');
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
      );
    });
  });

  describe('create', () => {
    it('debería insertar un nuevo usuario con contraseña hasheada', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // No existing user
      const mockCreated: UsuarioPublico = {
        id: 1, nombre: 'nuevo', rol: 'trabajador', activo: 1,
        created_at: '2026-06-04T00:00:00Z', updated_at: '2026-06-04T00:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValueOnce([mockCreated]);

      const service = TestBed.inject(UserService);
      const result = await service.create('nuevo', 'pass123', 'trabajador');

      expect(result.nombre).toBe('nuevo');
      expect(result.rol).toBe('trabajador');
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('salt');
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT'),
        ['nuevo'],
      );
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT'),
        ['nuevo', expect.any(String), expect.any(String), 'trabajador', expect.any(String), expect.any(String)],
      );
    });

    it('debería rechazar mismo nombre y misma contraseña', async () => {
      const salt = 'test-salt-123';
      const hash = await hashPassword('pass123', salt);
      const existing: Usuario = {
        id: 1, nombre: 'test', password_hash: hash, salt, rol: 'trabajador',
        activo: 1, created_at: '', updated_at: '',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([existing]);

      const service = TestBed.inject(UserService);
      await expect(
        service.create('test', 'pass123', 'trabajador'),
      ).rejects.toThrow('Ya existe un usuario con ese nombre y contraseña');

      // Solo debe haber hecho el SELECT, nunca el INSERT
      expect(mockDb.sql).toHaveBeenCalledTimes(1);
    });

    it('debería permitir mismo nombre con diferente contraseña', async () => {
      const salt = 'test-salt-456';
      const hash = await hashPassword('existing-pass', salt);
      const existing: Usuario = {
        id: 1, nombre: 'test', password_hash: hash, salt, rol: 'trabajador',
        activo: 1, created_at: '', updated_at: '',
      };
      vi.mocked(mockDb.sql).mockResolvedValueOnce([existing]);
      const mockCreated: UsuarioPublico = {
        id: 2, nombre: 'test', rol: 'trabajador', activo: 1,
        created_at: '', updated_at: '',
      };
      vi.mocked(mockDb.sql).mockResolvedValueOnce([mockCreated]);

      const service = TestBed.inject(UserService);
      const result = await service.create('test', 'different-pass', 'trabajador');

      expect(result.id).toBe(2);
      expect(result.nombre).toBe('test');
      expect(mockDb.sql).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleActivo', () => {
    it('debería cambiar activo de 1 a 0', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserService,
          { provide: DATABASE, useValue: mockDb },
          { provide: AuthService, useValue: { usuario: vi.fn().mockReturnValue({ id: 2 }) } },
        ],
      });

      vi.mocked(mockDb.sql).mockResolvedValue([]); // seed admin query: no match

      const service = TestBed.inject(UserService);
      await service.toggleActivo(1);

      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        [expect.any(String), 1],
      );
    });

    it('debería lanzar error al desactivar al usuario administrador semilla', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserService,
          { provide: DATABASE, useValue: mockDb },
          { provide: AuthService, useValue: { usuario: vi.fn().mockReturnValue({ id: 2 }) } },
        ],
      });

      vi.mocked(mockDb.sql).mockResolvedValue([{ id: 1 }]); // seed admin id = 1

      const service = TestBed.inject(UserService);
      await expect(service.toggleActivo(1)).rejects.toThrow(
        'No puedes desactivar al usuario administrador',
      );
    });

    it('debería lanzar error al desactivarse a sí mismo', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserService,
          { provide: DATABASE, useValue: mockDb },
          { provide: AuthService, useValue: { usuario: vi.fn().mockReturnValue({ id: 5 }) } },
        ],
      });

      const service = TestBed.inject(UserService);
      await expect(service.toggleActivo(5)).rejects.toThrow(
        'No puedes desactivarte a ti mismo',
      );

      // No debe haber consultas a la DB (la validación es previa)
      expect(mockDb.sql).not.toHaveBeenCalled();
    });
  });

  describe('updateRol', () => {
    it('debería cambiar el rol del usuario', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]); // seed admin query: no match

      const service = TestBed.inject(UserService);
      await service.updateRol(2, 'admin');

      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['admin', expect.any(String), 2],
      );
    });

    it('debería lanzar error al cambiar rol del administrador semilla', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ id: 1 }]); // seed admin id = 1

      const service = TestBed.inject(UserService);
      await expect(service.updateRol(1, 'trabajador')).rejects.toThrow(
        'No puedes cambiar el rol del usuario administrador',
      );
    });
  });

  describe('updatePassword', () => {
    it('debería actualizar password_hash y salt', async () => {
      const service = TestBed.inject(UserService);
      await service.updatePassword(1, 'new-password');

      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE usuarios SET password_hash'),
        [expect.any(String), expect.any(String), expect.any(String), 1],
      );
    });

    it('debería lanzar error si la contraseña está vacía', async () => {
      const service = TestBed.inject(UserService);
      await expect(service.updatePassword(1, '')).rejects.toThrow(
        'La contraseña no puede estar vacía',
      );

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('debería lanzar error si la contraseña es solo espacios', async () => {
      const service = TestBed.inject(UserService);
      await expect(service.updatePassword(1, '   ')).rejects.toThrow(
        'La contraseña no puede estar vacía',
      );

      expect(mockDb.sql).not.toHaveBeenCalled();
    });
  });
});
