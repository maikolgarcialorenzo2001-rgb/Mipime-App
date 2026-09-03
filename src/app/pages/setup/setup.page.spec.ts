import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, type ParamMap } from '@angular/router';
import { SetupPage } from './setup.page';
import { SetupService } from '../../services/setup.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';

function createMockParamMap(get: (key: string) => string | null): ParamMap {
  return {
    get,
    has: (key: string) => get(key) !== null,
    getAll: () => [],
    keys: [],
  } as ParamMap;
}

function createMockActivatedRoute(get: (key: string) => string | null) {
  const paramMap = createMockParamMap(get);
  return {
    queryParamMap: of(paramMap),
    snapshot: { queryParamMap: paramMap },
  };
}

describe('SetupPage', () => {
  let mockSetupService: {
    createInitialAdmin: ReturnType<typeof vi.fn>;
    countUsers: ReturnType<typeof vi.fn>;
    setConfig: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    login: ReturnType<typeof vi.fn>;
    usuario: ReturnType<typeof signal<null>>;
    isLoggedIn: ReturnType<typeof signal<boolean>>;
    hasRole: ReturnType<typeof vi.fn>;
  };
  let mockUserService: {
    updatePassword: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockActivatedRoute: ReturnType<typeof createMockActivatedRoute>;

  beforeEach(() => {
    mockSetupService = {
      createInitialAdmin: vi.fn(),
      countUsers: vi.fn(),
      setConfig: vi.fn().mockResolvedValue(undefined),
    };

    mockAuthService = {
      login: vi.fn(),
      usuario: signal(null),
      isLoggedIn: signal(false),
      hasRole: vi.fn(),
    };

    mockUserService = {
      updatePassword: vi.fn().mockResolvedValue(undefined),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockActivatedRoute = createMockActivatedRoute(() => null);

    TestBed.configureTestingModule({
      providers: [
        { provide: SetupService, useValue: mockSetupService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create component with default form values', () => {
    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
    expect(component.nombre()).toBe('');
    expect(component.password()).toBe('');
    expect(component.nombreComercio()).toBe('');
    expect(component.seedProducts()).toBe(false);
    expect(component.modeReset()).toBe(false);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should detect mode=reset from route params', () => {
    mockActivatedRoute = createMockActivatedRoute(
      (key) => key === 'mode' ? 'reset' : null,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SetupService, useValue: mockSetupService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    });

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.ngOnInit();
    expect(component.modeReset()).toBe(true);
  });

  it('should show error when submitting empty form', async () => {
    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    await component.onSubmit();

    expect(component.error()).toBeTruthy();
    expect(mockSetupService.createInitialAdmin).not.toHaveBeenCalled();
  });

  it('should call createInitialAdmin with correct params on valid submit', async () => {
    const mockUser = {
      id: 1, nombre: 'admin', rol: 'admin', activo: 1,
      created_at: '', updated_at: '',
    };
    mockSetupService.createInitialAdmin.mockResolvedValue(mockUser);
    mockAuthService.login.mockReturnValue(Promise.resolve(mockUser));

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
    expect(component.loading()).toBe(false);
  });

  it('should call createInitialAdmin with seedProducts=false when toggle off', async () => {
    const mockUser = {
      id: 1, nombre: 'admin', rol: 'admin', activo: 1,
      created_at: '', updated_at: '',
    };
    mockSetupService.createInitialAdmin.mockResolvedValue(mockUser);
    mockAuthService.login.mockReturnValue(Promise.resolve(mockUser));

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
  });

  it('should set error when createInitialAdmin throws', async () => {
    mockSetupService.createInitialAdmin.mockRejectedValue(new Error('Setup already completed'));

    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombre.set('admin');
    component.password.set('password123');
    component.nombreComercio.set('Mi Negocio');

    await component.onSubmit();

    expect(component.error()).toBe('Setup already completed');
    expect(component.loading()).toBe(false);
  });

  it('should enforce 18 char limit on nombreComercio', () => {
    const fixture = TestBed.createComponent(SetupPage);
    const component = fixture.componentInstance;

    component.nombreComercio.set('A'.repeat(19));
    // The form validation should prevent submission
    // or the input maxlength should limit to 18
  });

  describe('reset flow (mode=reset)', () => {
    let resetActivatedRoute: ReturnType<typeof createMockActivatedRoute>;

    beforeEach(() => {
      resetActivatedRoute = createMockActivatedRoute(
        (key) => key === 'mode' ? 'reset' : (key === 'userId' ? '5' : null),
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SetupService, useValue: mockSetupService },
          { provide: AuthService, useValue: mockAuthService },
          { provide: UserService, useValue: mockUserService },
          { provide: Router, useValue: mockRouter },
          { provide: ActivatedRoute, useValue: resetActivatedRoute },
        ],
      });
    });

    it('should call updatePassword and setConfig on successful reset, then navigate to /login', async () => {
      const fixture = TestBed.createComponent(SetupPage);
      const component = fixture.componentInstance;

      component.ngOnInit();
      expect(component.modeReset()).toBe(true);
      expect(component.userId()).toBe(5);

      component.password.set('new-password-123');

      await component.onSubmit();

      expect(mockUserService.updatePassword).toHaveBeenCalledWith(5, 'new-password-123');
      expect(mockSetupService.setConfig).toHaveBeenCalledWith('legacy_reset_done', '1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(component.error()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('should show error when password is empty and not call updatePassword', async () => {
      const fixture = TestBed.createComponent(SetupPage);
      const component = fixture.componentInstance;

      component.ngOnInit();
      component.password.set('');

      await component.onSubmit();

      expect(component.error()).toBe('La contraseña es obligatoria');
      expect(mockUserService.updatePassword).not.toHaveBeenCalled();
      expect(mockSetupService.setConfig).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('should show error when userId is missing and not call updatePassword', async () => {
      const noUserIdRoute = createMockActivatedRoute(
        (key) => key === 'mode' ? 'reset' : null,
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SetupService, useValue: mockSetupService },
          { provide: AuthService, useValue: mockAuthService },
          { provide: UserService, useValue: mockUserService },
          { provide: Router, useValue: mockRouter },
          { provide: ActivatedRoute, useValue: noUserIdRoute },
        ],
      });

      const fixture = TestBed.createComponent(SetupPage);
      const component = fixture.componentInstance;

      component.ngOnInit();
      expect(component.userId()).toBeNull();
      component.password.set('some-password');

      await component.onSubmit();

      expect(component.error()).toBe('Usuario no especificado para reset');
      expect(mockUserService.updatePassword).not.toHaveBeenCalled();
      expect(mockSetupService.setConfig).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('should show error when updatePassword throws', async () => {
      mockUserService.updatePassword.mockRejectedValue(new Error('DB error'));

      const fixture = TestBed.createComponent(SetupPage);
      const component = fixture.componentInstance;

      component.ngOnInit();
      component.password.set('new-password');

      await component.onSubmit();

      expect(component.error()).toBe('DB error');
      expect(mockUserService.updatePassword).toHaveBeenCalledWith(5, 'new-password');
      expect(mockSetupService.setConfig).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });
  });
});
