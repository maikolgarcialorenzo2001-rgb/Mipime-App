import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { DATABASE, type Database } from './services/database';
import { hashPassword, generateSalt } from './services/hash-password';
import { firstValueFrom } from 'rxjs';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

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

describe('App component nav', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockCrypto();
    mockDb = createMockDb();
    localStorage.clear();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        AuthService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('debería mostrar enlaces de navegación para admin logueado', async () => {
    // Login as admin
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      nombre: 'Admin',
      email: 'admin@mipime.com',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin@mipime.com', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const navLinks = fixture.nativeElement.querySelectorAll('nav a');
    const linkTexts = Array.from(navLinks).map((a: HTMLAnchorElement) => a.textContent?.trim());

    expect(linkTexts).toContain('POS');
    expect(linkTexts).toContain('Productos');
    expect(linkTexts).toContain('Jornada');
    expect(linkTexts).toContain('Inventario');
    expect(linkTexts).toContain('Historial');
    expect(linkTexts).toContain('Admin');
  });

  it('debería mostrar nombre de usuario y botón de logout cuando está logueado', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      nombre: 'Admin',
      email: 'admin@mipime.com',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin@mipime.com', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Admin');
    expect(text).toContain('Cerrar sesión');
  });

  it('no debería mostrar enlaces de Admin para rol trabajador', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('pass123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 2,
      nombre: 'Worker',
      email: 'worker@test.com',
      password_hash: hash,
      salt,
      rol: 'trabajador',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('worker@test.com', 'pass123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const navLinks = fixture.nativeElement.querySelectorAll('nav a');
    const linkTexts = Array.from(navLinks).map((a: HTMLAnchorElement) => a.textContent?.trim());

    expect(linkTexts).not.toContain('Admin');
    expect(linkTexts).toContain('POS');
  });

  it('no debería mostrar nav completo cuando no hay sesión', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav');
    // Should not show the full nav with links
    const links = nav?.querySelectorAll('a') ?? [];
    expect(links.length).toBe(0);
  });

  it('debería llamar a logout cuando se hace clic en el botón', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      nombre: 'Admin',
      email: 'admin@mipime.com',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin@mipime.com', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('button');
    expect(logoutBtn).toBeTruthy();

    logoutBtn.click();
    fixture.detectChanges();

    expect(auth.isLoggedIn()).toBe(false);
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeFalsy();
  });
});
