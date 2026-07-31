import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { DbStatusService } from './services/db-status.service';
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
      nombre: 'admin',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const navLinks = fixture.nativeElement.querySelectorAll('nav a');
    const linkTexts = Array.from(navLinks as NodeListOf<HTMLAnchorElement>).map((a) => a.textContent?.trim());

    expect(linkTexts.some((t) => t?.includes('POS'))).toBe(true);
    expect(linkTexts.some((t) => t?.includes('Productos'))).toBe(true);
    expect(linkTexts.some((t) => t?.includes('Jornada'))).toBe(true);
    expect(linkTexts.some((t) => t?.includes('Inventario'))).toBe(true);
    expect(linkTexts.some((t) => t?.includes('Historial'))).toBe(true);
    expect(linkTexts.some((t) => t?.includes('Admin'))).toBe(true);
  });

  it('debería mostrar nombre de usuario y botón de logout cuando está logueado', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      nombre: 'admin',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('admin');
    expect(text).toContain('Cerrar sesión');
  });

  it('no debería mostrar enlaces de Admin para rol trabajador', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('pass123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 2,
      nombre: 'worker',
      password_hash: hash,
      salt,
      rol: 'trabajador',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('worker', 'pass123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const navLinks = fixture.nativeElement.querySelectorAll('nav a');
    const linkTexts = Array.from(navLinks as NodeListOf<HTMLAnchorElement>).map((a) => a.textContent?.trim());

    expect(linkTexts.some((t) => t?.includes('Admin'))).toBe(false);
    expect(linkTexts.some((t) => t?.includes('POS'))).toBe(true);
  });

  it('no debería mostrar nav completo cuando no hay sesión', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav');
    // Should not show the full nav with links
    const links = nav?.querySelectorAll('a') ?? [];
    expect(links.length).toBe(0);
  });

  it('debería renderizar router-outlet cuando ttl no ha expirado', () => {
    localStorage.removeItem('mipime_ttl_expired');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const routerOutlet = fixture.nativeElement.querySelector('router-outlet');
    expect(routerOutlet).toBeTruthy();

    const ttlExpired = fixture.nativeElement.querySelector('app-ttl-expired');
    expect(ttlExpired).toBeFalsy();
  });

  it('debería renderizar app-ttl-expired cuando la prueba expiró', () => {
    localStorage.setItem('mipime_ttl_expired', 'true');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const routerOutlet = fixture.nativeElement.querySelector('router-outlet');
    expect(routerOutlet).toBeFalsy();

    const ttlExpired = fixture.nativeElement.querySelector('app-ttl-expired');
    expect(ttlExpired).toBeTruthy();
  });

  it('debería renderizar app-db-error (y no router-outlet) cuando la DB reporta fatal', () => {
    const dbStatus = TestBed.inject(DbStatusService);
    dbStatus.setFatal({
      appVersion: '0.1.8-beta',
      platform: 'win32',
      sqliteError: 'integrity check failed: database disk image is malformed',
      stage: 'open',
      backupsTried: [],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-db-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-ttl-expired')).toBeFalsy();
  });

  it('debería priorizar app-db-error sobre app-ttl-expired cuando ambos aplican', () => {
    localStorage.setItem('mipime_ttl_expired', 'true');
    const dbStatus = TestBed.inject(DbStatusService);
    dbStatus.setFatal({
      appVersion: '0.1.8-beta',
      platform: 'win32',
      sqliteError: 'disk full',
      stage: 'open',
      backupsTried: [],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-db-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-ttl-expired')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeFalsy();
  });

  it('debería llamar a logout cuando se hace clic en el botón', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('admin123', salt);
    (mockDb.sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: 1,
      nombre: 'admin',
      password_hash: hash,
      salt,
      rol: 'admin',
      activo: 1,
      created_at: '2026-06-04T00:00:00Z',
      updated_at: '2026-06-04T00:00:00Z',
    }]);

    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.login('admin', 'admin123'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('nav button:last-child');
    expect(logoutBtn).toBeTruthy();

    logoutBtn.click();
    fixture.detectChanges();

    expect(auth.isLoggedIn()).toBe(false);
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeFalsy();
  });
});
