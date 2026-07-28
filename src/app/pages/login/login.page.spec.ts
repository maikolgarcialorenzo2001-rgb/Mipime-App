import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router, RouterModule } from '@angular/router';
import { LoginPage } from './login.page';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import { Observable, of, throwError } from 'rxjs';
import type { UsuarioPublico } from '../../models';

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

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let authService: { login: ReturnType<typeof vi.fn>; usuario: ReturnType<typeof signal> };
  let router: Router;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      usuario: signal<UsuarioPublico | null>(null),
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
      ],
    });

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

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
});
