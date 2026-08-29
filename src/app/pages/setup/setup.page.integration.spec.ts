import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { SetupPage } from './setup.page';
import { SetupService } from '../../services/setup.service';
import { AuthService } from '../../services/auth.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('SetupPage - Integration', () => {
  let mockSetupService: Partial<SetupService>;
  let mockAuthService: Partial<AuthService>;
  let mockRouter: Partial<Router>;
  let mockActivatedRoute: Partial<ActivatedRoute>;

  beforeEach(() => {
    mockSetupService = {
      createInitialAdmin: vi.fn(),
      countUsers: vi.fn(),
    };

    mockAuthService = {
      login: vi.fn(),
      usuario: signal(null),
      isLoggedIn: signal(false),
      hasRole: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockActivatedRoute = {
      queryParamMap: of({
        get: (key: string) => null,
      }),
      snapshot: {
        queryParamMap: {
          get: (key: string) => null,
        },
      },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: SetupService, useValue: mockSetupService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full setup flow: form submit → service → login → redirect to /pos', async () => {
    const mockUser = {
      id: 1, nombre: 'admin', rol: 'admin', activo: 1,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    mockSetupService.createInitialAdmin!.mockResolvedValue(mockUser);
    mockAuthService.login!.mockReturnValue(of(mockUser));

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('Mi Negocio');
    component.seedProducts.set(true);

    await component.onSubmit();

    expect(mockSetupService.createInitialAdmin).toHaveBeenCalledWith(
      'admin', 'password123', 'Mi Negocio', true
    );
    expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'password123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pos']);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should complete setup flow with seedProducts=false', async () => {
    const mockUser = {
      id: 1, nombre: 'admin', rol: 'admin', activo: 1,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };

    mockSetupService.createInitialAdmin!.mockResolvedValue(mockUser);
    mockAuthService.login!.mockReturnValue(of(mockUser));

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('Mi Negocio');
    component.seedProducts.set(false);

    await component.onSubmit();

    expect(mockSetupService.createInitialAdmin).toHaveBeenCalledWith(
      'admin', 'password123', 'Mi Negocio', false
    );
    expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'password123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pos']);
  });

  it('should set error when createInitialAdmin fails', async () => {
    mockSetupService.createInitialAdmin!.mockRejectedValue(new Error('Setup already completed'));

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('Mi Negocio');

    await component.onSubmit();

    expect(component.error()).toBe('Setup already completed');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should validate required fields before calling service', async () => {
    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    // Empty form
    await component.onSubmit();
    expect(component.error()).toBeTruthy();
    expect(mockSetupService.createInitialAdmin).not.toHaveBeenCalled();

    // Missing password
    component.nombre.set('admin');
    component.nombreComercio.set('Mi Negocio');
    await component.onSubmit();
    expect(component.error()).toBeTruthy();
    expect(mockSetupService.createInitialAdmin).not.toHaveBeenCalled();

    // Missing nombreComercio
    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('');
    await component.onSubmit();
    expect(component.error()).toBeTruthy();
    expect(mockSetupService.createInitialAdmin).not.toHaveBeenCalled();
  });

  it('should enforce 18 char limit on nombreComercio', async () => {
    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('A'.repeat(19));

    await component.onSubmit();

    expect(component.error()).toBe('El nombre del comercio no puede exceder 18 caracteres');
    expect(mockSetupService.createInitialAdmin).not.toHaveBeenCalled();
  });

  it('should show loading state during submit', async () => {
    let resolveCreate: (value: any) => void;
    const createPromise = new Promise((resolve) => { resolveCreate = resolve; });
    mockSetupService.createInitialAdmin!.mockReturnValue(createPromise);
    mockAuthService.login!.mockReturnValue(of({
      id: 1, nombre: 'admin', rol: 'admin', activo: 1, created_at: '', updated_at: '',
    }));

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('Mi Negocio');

    const submitPromise = component.onSubmit();
    // Loading should be true during submit
    expect(component.loading()).toBe(true);

    resolveCreate!({
      id: 1, nombre: 'admin', rol: 'admin', activo: 1, created_at: '', updated_at: '',
    });
    await submitPromise;

    expect(component.loading()).toBe(false);
  });
});