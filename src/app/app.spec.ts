import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { JornadaService } from './services/jornada.service';
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

describe('App - pending close', () => {
  const mockJornadaAbierta = {
    id: 1,
    fecha: '2026-06-05',
    hora_apertura: '09:00:00',
    hora_cierre: null,
    monto_inicial: 5000,
    total_ventas: 15000,
    total_gastos: 2000,
    saldo_esperado: 18000,
    saldo_real: null,
    estado: 'abierta' as const,
    user_cierre_id: null,
    created_at: '2026-06-05T09:00:00Z',
    updated_at: '2026-06-05T09:00:00Z',
  };

  const mockJornadaCerrada = {
    ...mockJornadaAbierta,
    estado: 'cerrada' as const,
    hora_cierre: '18:00:00',
    saldo_real: 18000,
    user_cierre_id: 1,
  };

  const mockReporte = {
    id: 1,
    jornada_id: 1,
    content_type: 'excel',
    content_base64: 'UEsDBQAAAAA...',
    filename: 'jornada_2026-06-05_1.xlsx',
    created_at: '2026-06-05T18:00:00Z',
  };

  interface MockJornadaSvc {
    jornadaAbierta: ReturnType<typeof vi.fn>;
    jornadaCargando: ReturnType<typeof vi.fn>;
    obtenerAbierta: ReturnType<typeof vi.fn>;
    cerrarSinAuth: ReturnType<typeof vi.fn>;
    obtenerReporte: ReturnType<typeof vi.fn>;
  }

  function createMockJornadaSvc(abierta: typeof mockJornadaAbierta | null): MockJornadaSvc {
    return {
      jornadaAbierta: vi.fn().mockReturnValue(abierta),
      jornadaCargando: vi.fn().mockReturnValue(false),
      obtenerAbierta: vi.fn().mockReturnValue(of(abierta)),
      cerrarSinAuth: vi.fn().mockReturnValue(of(mockJornadaCerrada)),
      obtenerReporte: vi.fn().mockReturnValue(of(mockReporte)),
    };
  }

  function createMockAuth(usuario: { id: number; nombre?: string } | null) {
    return {
      usuario: vi.fn().mockReturnValue(usuario ? { id: usuario.id, nombre: usuario.nombre ?? 'Admin' } : null),
      logout: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(usuario !== null),
      hasRole: vi.fn().mockReturnValue(true),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('4.1 RED: @HostListener beforeunload debería guardar pending_close si jornada está abierta', () => {
    const mockJornadaSvc = createMockJornadaSvc(mockJornadaAbierta);
    const mockAuth = createMockAuth({ id: 1 });

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: JornadaService, useValue: mockJornadaSvc },
        { provide: AuthService, useValue: mockAuth },
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });

    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;

    // Simular beforeunload
    const event = new Event('beforeunload');
    window.dispatchEvent(event);

    const raw = localStorage.getItem('mipime_pending_close');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.jornadaId).toBe(1);
    expect(parsed.userId).toBe(1);
    expect(parsed.timestamp).toBeTruthy();
  });

  it('4.2 RED: ngOnInit debería procesar pending_close → cerrarSinAuth → obtenerReporte → limpiar flag', () => {
    const mockJornadaSvc = createMockJornadaSvc(mockJornadaAbierta);
    const mockAuth = createMockAuth({ id: 1 });

    // Poner pending_close en localStorage antes de crear el componente
    const pendingPayload = JSON.stringify({
      jornadaId: 1,
      userId: 1,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('mipime_pending_close', pendingPayload);

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: JornadaService, useValue: mockJornadaSvc },
        { provide: AuthService, useValue: mockAuth },
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    // ngOnInit procesó pending_close
    expect(mockJornadaSvc.cerrarSinAuth).toHaveBeenCalledWith(1, 1);
    expect(mockJornadaSvc.obtenerReporte).toHaveBeenCalledWith(1);
    expect(mockAuth.logout).toHaveBeenCalled();
    expect(localStorage.getItem('mipime_pending_close')).toBeNull();
  });

  it('4.3a RED: stale pending_close (>24h) debería ignorarse y limpiarse', () => {
    const mockJornadaSvc = createMockJornadaSvc(mockJornadaAbierta);
    const mockAuth = createMockAuth({ id: 1 });

    // pending_close de hace 48 horas
    const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      'mipime_pending_close',
      JSON.stringify({ jornadaId: 1, userId: 1, timestamp: oldTimestamp }),
    );

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: JornadaService, useValue: mockJornadaSvc },
        { provide: AuthService, useValue: mockAuth },
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(mockJornadaSvc.cerrarSinAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem('mipime_pending_close')).toBeNull();
  });

  it('4.3b RED: pending_close con jornada ya cerrada debería limpiar flag sin acción', () => {
    const mockJornadaSvc = createMockJornadaSvc(null); // jornada abierta es null (ya cerrada)
    const mockAuth = createMockAuth({ id: 1 });

    localStorage.setItem(
      'mipime_pending_close',
      JSON.stringify({ jornadaId: 1, userId: 1, timestamp: new Date().toISOString() }),
    );

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: JornadaService, useValue: mockJornadaSvc },
        { provide: AuthService, useValue: mockAuth },
        { provide: DATABASE, useValue: createMockDb() },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(mockJornadaSvc.cerrarSinAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem('mipime_pending_close')).toBeNull();
  });
});
