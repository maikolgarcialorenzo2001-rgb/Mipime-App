import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SetupService } from './setup.service';
import { DATABASE, type Database } from './database';
import type { UsuarioPublico } from '../models';

// Mock crypto.subtle.digest for hashPassword
const mockSubtleDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: { digest: mockSubtleDigest },
    getRandomValues: (arr: Uint8Array) => arr,
  },
  configurable: true,
  writable: true,
});

// Mock seedProductosSiVacio at top level
vi.mock('./db-migrations', () => ({
  seedProductosSiVacio: vi.fn().mockResolvedValue(undefined),
}));

function createMockDb(): Database {
  const sql = vi.fn().mockResolvedValue([]) as unknown as Database['sql'];
  return {
    sql,
    transaction: vi.fn((fn) => fn({ sql: (q: string, p?: unknown[]) => sql(q, p) })),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SetupService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        SetupService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('countUsers', () => {
    it('should return the count of users', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ count: 5 }]);

      const service = TestBed.inject(SetupService);
      const count = await service.countUsers();

      expect(count).toBe(5);
      expect(mockDb.sql).toHaveBeenCalledWith('SELECT COUNT(*) AS count FROM usuarios');
    });

    it('should return 0 when no users exist', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ count: 0 }]);

      const service = TestBed.inject(SetupService);
      const count = await service.countUsers();

      expect(count).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return config value when key exists', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ valor: 'test-value' }]);

      const service = TestBed.inject(SetupService);
      const value = await service.getConfig('test-key');

      expect(value).toBe('test-value');
      expect(mockDb.sql).toHaveBeenCalledWith('SELECT valor FROM config WHERE clave = ?', ['test-key']);
    });

    it('should return null when key does not exist', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(SetupService);
      const value = await service.getConfig('non-existent');

      expect(value).toBeNull();
    });
  });

  describe('setConfig', () => {
    it('should insert or replace config value', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(SetupService);
      await service.setConfig('test-key', 'test-value');

      expect(mockDb.sql).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
        ['test-key', 'test-value'],
      );
    });
  });

  describe('createInitialAdmin', () => {
    it('should create admin user and persist nombreComercio and seedProducts config', async () => {
      const mockUser: UsuarioPublico = {
        id: 1,
        nombre: 'admin',
        rol: 'admin',
        activo: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([mockUser]);

      const service = TestBed.inject(SetupService);
      const result = await service.createInitialAdmin('admin', 'password123', 'Mi Negocio', true);

      expect(result).toEqual(mockUser);
      expect(mockDb.sql).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) AS count FROM usuarios');
      const insertCall = vi.mocked(mockDb.sql).mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO usuarios');
      expect(insertCall[1]).toEqual([
        'admin',
        expect.any(String), // password_hash
        expect.any(String), // salt
        expect.any(String), // created_at
        expect.any(String), // updated_at
      ]);
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
        ['nombre_comercio', 'Mi Negocio'],
      );
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
        ['seedProducts', '1'],
      );
      const { seedProductosSiVacio } = await import('./db-migrations');
      expect(seedProductosSiVacio).toHaveBeenCalled();
    });

    it('should persist seedProducts as 0 when seedProducts is false', async () => {
      const mockUser: UsuarioPublico = {
        id: 1,
        nombre: 'admin',
        rol: 'admin',
        activo: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([mockUser]);

      const service = TestBed.inject(SetupService);
      await service.createInitialAdmin('admin', 'password123', 'Mi Negocio', false);

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
        ['seedProducts', '0'],
      );
      const { seedProductosSiVacio } = await import('./db-migrations');
      expect(seedProductosSiVacio).not.toHaveBeenCalled();
    });

    it('should throw when users already exist', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ count: 1 }]);

      const service = TestBed.inject(SetupService);
      await expect(
        service.createInitialAdmin('admin', 'password123', 'Mi Negocio', true),
      ).rejects.toThrow('Setup already completed - users exist');

      const { seedProductosSiVacio } = await import('./db-migrations');
      expect(seedProductosSiVacio).not.toHaveBeenCalled();
    });
  });
});