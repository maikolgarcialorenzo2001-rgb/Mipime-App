import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DATABASE, type Database } from '../services/database';
import { hashPassword, generateSalt } from '../services/hash-password';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { firstValueFrom } from 'rxjs';
import type { Usuario } from '../models';

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
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockUsuario(salt: string, hash: string): Usuario {
  return {
    id: 1,
    nombre: 'Admin',
    email: 'admin@mipime.com',
    password_hash: hash,
    salt,
    rol: 'admin',
    activo: 1,
    created_at: '2026-06-04T00:00:00Z',
    updated_at: '2026-06-04T00:00:00Z',
  };
}

async function setupLoggedInUser(): Promise<AuthService> {
  const salt = generateSalt();
  const hash = await hashPassword('admin123', salt);
  const mockDb = TestBed.inject(DATABASE) as unknown as { sql: ReturnType<typeof vi.fn> };
  mockDb.sql.mockResolvedValue([createMockUsuario(salt, hash)]);
  const auth = TestBed.inject(AuthService);
  await firstValueFrom(auth.login('admin@mipime.com', 'admin123'));
  return auth;
}

describe('authGuard', () => {
  beforeEach(() => {
    mockCrypto();
    localStorage.clear();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('debería retornar true si el usuario está logueado', async () => {
    await setupLoggedInUser();
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any),
    );
    expect(result).toBe(true);
  });

  it('debería redirigir a /login si no hay sesión', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any),
    ) as UrlTree;

    expect(result.toString()).toBe('/login');
  });
});

describe('adminGuard', () => {
  beforeEach(() => {
    mockCrypto();
    localStorage.clear();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('debería retornar true si el usuario es admin', async () => {
    await setupLoggedInUser();
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, {} as any),
    );
    expect(result).toBe(true);
  });

  it('debería redirigir a / si el usuario no es admin', async () => {
    // Login as trabajador
    const mockDb = TestBed.inject(DATABASE) as unknown as { sql: ReturnType<typeof vi.fn> };
    const salt = generateSalt();
    const hash = await hashPassword('pass123', salt);
    mockDb.sql.mockResolvedValue([{
      ...createMockUsuario(salt, hash),
      rol: 'trabajador',
    }]);
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('worker@test.com', 'pass123'));

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, {} as any),
    ) as UrlTree;

    expect(result.toString()).toBe('/');
  });
});
