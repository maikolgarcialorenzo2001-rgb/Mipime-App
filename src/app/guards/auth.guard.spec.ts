import { TestBed } from '@angular/core/testing';
import {
  Router,
  type UrlTree,
  provideLocationMocks,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../services/auth.service';
import { DATABASE, type Database } from '../services/database';
import { hashPassword, generateSalt } from '../services/hash-password';
import { authGuard } from './auth.guard';
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

describe('authGuard', () => {
  let mockDb: Database;
  let router: Router;

  beforeEach(async () => {
    mockCrypto();
    mockDb = createMockDb();
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    router = TestBed.inject(Router);
    // Navigate to root so router has a usable state
    await router.navigate(['/']);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('debería retornar true si el usuario está logueado', async () => {
    // Login first
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    vi.mocked(mockDb.sql).mockResolvedValue([{
      id: 1,
      nombre: 'Admin',
      email: 'admin@mipime.com',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    } satisfies Usuario]);

    const auth = TestBed.inject(AuthService);
    await auth.login('admin@mipime.com', 'admin123').toPromise();

    const result = authGuard(undefined as any, undefined as any);
    expect(result).toBe(true);
  });

  it('debería redirigir a /login si no hay sesión', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(undefined as any, undefined as any),
    ) as UrlTree;

    expect(router.isUrlTree(result)).toBe(true);
    expect(result.toString()).toBe('/login');
  });
});
