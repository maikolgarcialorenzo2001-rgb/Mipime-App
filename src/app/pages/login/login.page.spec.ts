import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router, RouterModule } from '@angular/router';
import { LoginPage } from './login.page';
import { AuthService } from '../../services/auth.service';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import { DATABASE, type Database } from '../../services/database';
import { Observable, of, throwError } from 'rxjs';
import type { UsuarioPublico, Jornada } from '../../models';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

const mockUser: UsuarioPublico = {
  id: 1,
  nombre: 'admin',
  rol: 'admin',
  activo: 1,
  created_at: '',
  updated_at: '',
};

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-07-28',
  hora_apertura: '08:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_movimientos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  user_apertura_id: 1,
  total_merma: 0,
  created_at: '2026-07-28T08:00:00Z',
  updated_at: '2026-07-28T08:00:00Z',
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let authService: { login: ReturnType<typeof vi.fn>; usuario: ReturnType<typeof signal> };
  let jornadaService: {
    obtenerAbierta: ReturnType<typeof vi.fn>;
    autoCerrarSiOtroUsuario: ReturnType<typeof vi.fn>;
    cerrar: ReturnType<typeof vi.fn>;
    obtenerReporte: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      usuario: signal<UsuarioPublico | null>(null),
    };

    jornadaService = {
      obtenerAbierta: vi.fn().mockReturnValue(of(null)),
      autoCerrarSiOtroUsuario: vi.fn(),
      cerrar: vi.fn().mockReturnValue(of(undefined)),
      obtenerReporte: vi.fn().mockReturnValue(of(null)),
    };

    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([
          { path: '', component: LoginPage },
          { path: 'pos', component: LoginPage }, // dummy route for navigate test
        ]),
        { provide: DATABASE, useValue: createMockDb() },
        { provide: AuthService, useValue: authService },
        { provide: JornadaService, useValue: jornadaService },
        {
          provide: ElectronFileService,
          useValue: {
            isElectronPackaged: false,
            saveIndividual: vi.fn().mockResolvedValue(undefined),
            downloadBlob: vi.fn(),
          },
        },
      ],
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza el formulario con inputs de usuario y contraseña', () => {
    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll('input');
    expect(inputs.length).toBe(2);
    expect(inputs[0].id).toBe('username');
    expect(inputs[1].id).toBe('password');
  });

  it('renderiza el botón de login', () => {
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button[type="submit"]');
    expect(button).toBeTruthy();
    expect(button!.textContent).toContain('Iniciar sesión');
  });

  it('renderiza el título Mipime POS', () => {
    expect(fixture.nativeElement.textContent).toContain('Mipime POS');
  });

  it('username y password inician vacíos', () => {
    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
  });

  it('loginError inicia null (no muestra error)', () => {
    expect(component.loginError()).toBeNull();
    const alert = fixture.nativeElement.querySelector('app-error-alert');
    expect(alert).toBeNull();
  });

  it('cargando inicia false y el botón NO está deshabilitado', () => {
    expect(component.cargando()).toBe(false);
    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button!.hasAttribute('disabled')).toBe(false);
  });

  it('al enviar con credenciales válidas llama a auth.login y navega a /pos', async () => {
    authService.login.mockReturnValue(of(mockUser));
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.username.set('admin');
    component.password.set('1234');

    await component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith('admin', '1234');
    expect(navigateSpy).toHaveBeenCalledWith(['/pos']);
  });

  it('al enviar con credenciales inválidas muestra el error', async () => {
    authService.login.mockReturnValue(
      throwError(() => new Error('Credenciales inválidas')),
    );

    component.username.set('wrong');
    component.password.set('wrong');

    await component.onSubmit();

    expect(component.loginError()).toBe('Credenciales inválidas');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('app-error-alert');
    expect(alert).toBeTruthy();
  });

  it('cargando se pone true durante el login y vuelve a false después', async () => {
    let resolveLogin!: (v: UsuarioPublico) => void;
    authService.login.mockReturnValue(
      new Observable((sub) => {
        resolveLogin = (v) => { sub.next(v); sub.complete(); };
      }),
    );

    component.username.set('admin');
    component.password.set('1234');

    const promise = component.onSubmit();
    fixture.detectChanges();

    expect(component.cargando()).toBe(true);
    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button!.hasAttribute('disabled')).toBe(true);
    expect(button!.textContent).toContain('Ingresando');

    resolveLogin(mockUser);
    await promise;

    expect(component.cargando()).toBe(false);
  });

  it('loginError se limpia al enviar', async () => {
    authService.login
      .mockReturnValueOnce(throwError(() => new Error('Fallo')))
      .mockReturnValueOnce(of(mockUser));

    component.username.set('admin');
    component.password.set('1234');

    await component.onSubmit();
    expect(component.loginError()).toBe('Fallo');

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.onSubmit();
    expect(component.loginError()).toBeNull();
  });

  describe('jornada en login', () => {
    const mockUserB: UsuarioPublico = {
      id: 2,
      nombre: 'beto',
      rol: 'trabajador',
      activo: 1,
      created_at: '',
      updated_at: '',
    };

    const jornadaDeA = (overrides: Partial<Jornada> = {}): Jornada => ({
      ...mockJornada,
      ...overrides,
    });

    it('onSubmit: jornada de OTRO usuario → modal, sin auto-cierre, sin toast, sin navegar', async () => {
      authService.login.mockReturnValue(of(mockUserB));
      authService.usuario.set(mockUserB);
      // Jornada abierta por el usuario A (id=1); se loguea B (id=2)
      jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ user_apertura_id: 1 })));
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await component.onSubmit();

      expect(component.showReopenModal()).toBe(true);
      // Nunca se auto-cierra la jornada de otro usuario
      expect(jornadaService.autoCerrarSiOtroUsuario).not.toHaveBeenCalled();
      // Sin toast de cierre automático
      expect(component.successMessage()).toBeNull();
      // No navega automáticamente
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('onSubmit: mismo usuario → showReopenModal true (comportamiento preservado)', async () => {
      authService.login.mockReturnValue(of(mockUser));
      authService.usuario.set(mockUser);
      jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ user_apertura_id: 1 })));

      await component.onSubmit();

      expect(component.showReopenModal()).toBe(true);
      expect(jornadaService.autoCerrarSiOtroUsuario).not.toHaveBeenCalled();
    });

    it('onSubmit: sin jornada abierta → navega directo a /pos', async () => {
      authService.login.mockReturnValue(of(mockUser));
      jornadaService.obtenerAbierta.mockReturnValue(of(null)); // no hay jornada
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await component.onSubmit();

      expect(navigateSpy).toHaveBeenCalledWith(['/pos']);
    });

    describe('cerrarYGuardar usa el usuario autenticado (FR-4)', () => {
      it('B cierra jornada de A → cerrar(j.id, B.id), NUNCA user_apertura_id', async () => {
        authService.login.mockReturnValue(of(mockUserB));
        authService.usuario.set(mockUserB);
        // Jornada de A (user_apertura_id=1), la cierra B (id=2)
        jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ user_apertura_id: 1 })));

        await component.onSubmit();
        expect(component.showReopenModal()).toBe(true);

        component.cerrarYGuardar();

        expect(jornadaService.cerrar).toHaveBeenCalledWith(mockJornada.id, 2);
        expect(jornadaService.cerrar).not.toHaveBeenCalledWith(
          mockJornada.id,
          mockJornada.user_apertura_id,
        );
      });

      it('legacy sin apertura (NULL) → cerrar con el id del usuario autenticado', async () => {
        authService.login.mockReturnValue(of(mockUserB));
        authService.usuario.set(mockUserB);
        jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ user_apertura_id: null })));

        await component.onSubmit();

        component.cerrarYGuardar();

        expect(jornadaService.cerrar).toHaveBeenCalledWith(mockJornada.id, 2);
      });

      it('auth.usuario() null → NO llama cerrar (aborta sin crash)', async () => {
        authService.login.mockReturnValue(of(mockUser));
        authService.usuario.set(null); // sin sesión activa
        jornadaService.obtenerAbierta.mockReturnValue(of(mockJornada));

        await component.onSubmit();
        expect(component.showReopenModal()).toBe(true);

        component.cerrarYGuardar();

        expect(jornadaService.cerrar).not.toHaveBeenCalled();
        expect(component.cerrando()).toBe(false);
      });
    });

    describe('modal muestra la fecha real de la jornada (FR-3)', () => {
      it('jornada del 2026-08-07 → título "Reanudar jornada del 07-08" y copy sin "de hoy"', async () => {
        authService.login.mockReturnValue(of(mockUserB));
        authService.usuario.set(mockUserB);
        jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ fecha: '2026-08-07' })));

        await component.onSubmit();
        fixture.detectChanges();

        const modal = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
        expect(modal).toBeTruthy();
        const text = modal.textContent ?? '';
        expect(text).toContain('Reanudar jornada del 07-08');
        expect(text).toContain('Hay una jornada sin cerrar');
        expect(text).not.toContain('de hoy');
      });

      it('jornada del 2026-08-08 (hoy) → fecha formateada DD-MM y copy genérico', async () => {
        authService.login.mockReturnValue(of(mockUserB));
        authService.usuario.set(mockUserB);
        jornadaService.obtenerAbierta.mockReturnValue(of(jornadaDeA({ fecha: '2026-08-08' })));

        await component.onSubmit();
        fixture.detectChanges();

        const modal = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
        const text = modal?.textContent ?? '';
        expect(text).toContain('Reanudar jornada del 08-08');
        expect(text).toContain('Hay una jornada sin cerrar');
        expect(text).not.toContain('de hoy');
      });
    });

    describe('Electron auto-save', () => {
      let electronService: { isElectronPackaged: boolean; saveIndividual: ReturnType<typeof vi.fn>; downloadBlob: ReturnType<typeof vi.fn> };

      beforeEach(() => {
        electronService = TestBed.inject(ElectronFileService) as unknown as typeof electronService;
      });

      it('debería llamar ElectronFileService.downloadBlob en cerrarYGuardar', async () => {
        jornadaService.obtenerReporte.mockReturnValue(of({
          id: 1,
          jornada_id: 1,
          content_type: 'excel',
          content_base64: 'dGVzdA==',
          filename: 'jornada_test.xlsx',
          created_at: '',
        }));

        authService.login.mockReturnValue(of(mockUser));
        authService.usuario.set(mockUser);
        jornadaService.obtenerAbierta.mockReturnValue(of(mockJornada));

        await component.onSubmit();
        component.cerrarYGuardar();

        expect(electronService.downloadBlob).toHaveBeenCalledWith(
          'dGVzdA==',
          'jornada_test.xlsx',
        );
      });
    });

    it('reabrirJornada cierra modal y navega a /pos', async () => {
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.reabrirJornada();

      expect(component.showReopenModal()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/pos']);
    });
  });
});
