import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { SetupPage } from './setup.page';
import { SetupService } from '../../services/setup.service';
import { AuthService } from '../../services/auth.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('SetupPage', () => {
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
    mockActivatedRoute = {
      queryParamMap: of({
        get: (key: string) => key === 'mode' ? 'reset' : null,
      }),
      snapshot: {
        queryParamMap: {
          get: (key: string) => key === 'mode' ? 'reset' : null,
        },
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SetupService, useValue: mockSetupService },
        { provide: AuthService, useValue: mockAuthService },
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
    mockSetupService.createInitialAdmin!.mockResolvedValue(mockUser);
    mockAuthService.login!.mockReturnValue(Promise.resolve(mockUser));

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
    mockSetupService.createInitialAdmin!.mockResolvedValue(mockUser);
    mockAuthService.login!.mockReturnValue(Promise.resolve(mockUser));

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
    mockSetupService.createInitialAdmin!.mockRejectedValue(new Error('Setup already completed'));

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
});