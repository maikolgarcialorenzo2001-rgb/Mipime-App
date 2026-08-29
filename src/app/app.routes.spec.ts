import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Routes } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { SetupService } from './services/setup.service';
import { setupGuard } from './guards/setup.guard';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

describe('app routes', () => {
  it('should have a /setup route with lazy loading', () => {
    const setupRoute = routes.find((r) => r.path === 'setup');
    expect(setupRoute).toBeDefined();
    expect(setupRoute!.loadComponent).toBeDefined();
    expect(setupRoute!.canActivate).toContain(setupGuard);
  });

  it('should apply setupGuard to /login route', () => {
    const loginRoute = routes.find((r) => r.path === 'login');
    expect(loginRoute).toBeDefined();
    expect(loginRoute!.canActivate).toContain(setupGuard);
  });

  it('should apply setupGuard to /setup route', () => {
    const setupRoute = routes.find((r) => r.path === 'setup');
    expect(setupRoute).toBeDefined();
    expect(setupRoute!.canActivate).toContain(setupGuard);
  });

  it('should keep existing routes unchanged', () => {
    const expectedPaths = ['login', 'jornada', 'productos', 'pos', 'admin', 'inventario', 'historial', 'setup'];
    const actualPaths = routes.map((r) => r.path).filter(Boolean);
    expectedPaths.forEach((p) => expect(actualPaths).toContain(p));
  });

  interface RouteWithGuard {
    path: string;
    pathMatch?: string;
    canActivate?: unknown[];
    loadComponent?: unknown;
    redirectTo?: string;
  }

  function findRoute(path: string): RouteWithGuard | undefined {
    return routes.find((r) => r.path === path) as RouteWithGuard | undefined;
  }

  it('debería tener ruta /pos con authGuard', () => {
    const route = findRoute('pos');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
  });

  it('debería tener ruta /admin con authGuard y adminGuard', () => {
    const route = findRoute('admin');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
    expect(route!.canActivate!.length).toBe(2);
  });

  it('debería tener ruta /palmar con authGuard y adminGuard', () => {
    const route = findRoute('palmar');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
    expect(route!.canActivate!.length).toBe(2);
  });

  it('debería tener ruta /inventario con authGuard', () => {
    const route = findRoute('inventario');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
  });

  it('debería tener ruta /historial con authGuard', () => {
    const route = findRoute('historial');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
  });

  it('todas las rutas protegidas deberían ser lazy-loaded', () => {
    const protectedRoutes = routes.filter(
      (r) => r.path !== '' && r.path !== 'login',
    );
    for (const r of protectedRoutes) {
      expect(typeof (r as unknown as RouteWithGuard).loadComponent).toBe('function');
    }
  });

  describe('ruta /palmar — protección end-to-end', () => {
    function setup(mockAuth: {
      isLoggedIn: ReturnType<typeof vi.fn>;
      hasRole: ReturnType<typeof vi.fn>;
    }): void {
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes),
          { provide: AuthService, useValue: mockAuth },
          {
            provide: SetupService,
            useValue: { countUsers: vi.fn().mockResolvedValue(1) },
          },
        ],
      });
    }

    it('debería redirigir a / (resuelve /pos) si el usuario no es admin', async () => {
      setup({
        isLoggedIn: vi.fn().mockReturnValue(true),
        hasRole: vi.fn().mockReturnValue(false),
      });
      const router = TestBed.inject(Router);
      const navigated = await router.navigateByUrl('/palmar');
      expect(navigated).toBe(true);
      expect(router.url).toBe('/pos');
    });

    it('debería redirigir a /login si no hay sesión', async () => {
      setup({
        isLoggedIn: vi.fn().mockReturnValue(false),
        hasRole: vi.fn().mockReturnValue(false),
      });
      const router = TestBed.inject(Router);
      const navigated = await router.navigateByUrl('/palmar');
      expect(navigated).toBe(true);
      expect(router.url).toBe('/login');
    });
  });

  it('debería tener exactamente 10 rutas', () => {
    expect(routes.length).toBe(10);
  });
});
