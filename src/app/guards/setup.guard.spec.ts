import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { setupGuard } from './setup.guard';
import { SetupService } from '../services/setup.service';
import { AuthService } from '../services/auth.service';
import { DATABASE } from '../services/database';

describe('setupGuard', () => {
  let mockSetupService: { countUsers: ReturnType<typeof vi.fn> };
  let mockAuthService: Partial<AuthService>;
  let mockRouter: Partial<Router>;
  let parseUrlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetupService = {
      countUsers: vi.fn(),
    };

    mockAuthService = {
      isLoggedIn: vi.fn(),
    };

    parseUrlSpy = vi.fn();
    mockRouter = {
      parseUrl: parseUrlSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: SetupService, useValue: mockSetupService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DATABASE, useValue: { sql: vi.fn(), transaction: vi.fn(), initialize: vi.fn() } },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access to /setup when 0 users exist', async () => {
    mockSetupService.countUsers.mockResolvedValue(0);

    const route = { routeConfig: { path: 'setup' } } as any;
    const result = await TestBed.runInInjectionContext(() => setupGuard(route));

    expect(result).toBe(true);
    expect(mockSetupService.countUsers).toHaveBeenCalled();
  });

  it('should redirect to /setup when navigating to /login with 0 users', async () => {
    mockSetupService.countUsers.mockResolvedValue(0);

    const route = { routeConfig: { path: 'login' } } as any;
    const result = await TestBed.runInInjectionContext(() => setupGuard(route));

    expect(result).toEqual(mockRouter.parseUrl('/setup'));
    expect(parseUrlSpy).toHaveBeenCalledWith('/setup');
  });

  it('should allow access to /login when users exist', async () => {
    mockSetupService.countUsers.mockResolvedValue(1);

    const route = { routeConfig: { path: 'login' } } as any;
    const result = await TestBed.runInInjectionContext(() => setupGuard(route));

    expect(result).toBe(true);
  });

  it('should redirect authenticated user from /setup to /pos when users exist', async () => {
    mockSetupService.countUsers.mockResolvedValue(1);
    mockAuthService.isLoggedIn.mockReturnValue(true);

    const route = { routeConfig: { path: 'setup' } } as any;
    const result = await TestBed.runInInjectionContext(() => setupGuard(route));

    expect(result).toEqual(mockRouter.parseUrl('/pos'));
    expect(parseUrlSpy).toHaveBeenCalledWith('/pos');
  });

  it('should redirect unauthenticated user from /setup to /login when users exist', async () => {
    mockSetupService.countUsers.mockResolvedValue(1);
    mockAuthService.isLoggedIn.mockReturnValue(false);

    const route = { routeConfig: { path: 'setup' } } as any;
    const result = await TestBed.runInInjectionContext(() => setupGuard(route));

    expect(result).toEqual(mockRouter.parseUrl('/login'));
    expect(parseUrlSpy).toHaveBeenCalledWith('/login');
  });
});