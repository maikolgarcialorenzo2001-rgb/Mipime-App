import { TestBed } from '@angular/core/testing';
import { Routes } from '@angular/router';
import { routes } from './app.routes';

describe('app.routes', () => {
  type RouteWithGuard = {
    path: string;
    canActivate?: unknown[];
    loadComponent?: unknown;
    redirectTo?: string;
  };

  function findRoute(path: string): RouteWithGuard | undefined {
    return routes.find((r) => r.path === path) as RouteWithGuard | undefined;
  }

  it('debería redirigir / a /jornada', () => {
    const route = findRoute('');
    expect(route).toBeDefined();
    expect(route!.redirectTo).toBe('/jornada');
    expect(route!.pathMatch).toBe('full');
  });

  it('debería tener ruta /login sin guard', () => {
    const route = findRoute('login');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeUndefined();
  });

  it('debería tener ruta /jornada con authGuard', () => {
    const route = findRoute('jornada');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
    expect(route!.canActivate!.length).toBe(1);
  });

  it('debería tener ruta /productos con authGuard', () => {
    const route = findRoute('productos');
    expect(route).toBeDefined();
    expect(route!.canActivate).toBeDefined();
  });

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
      expect(typeof (r as any).loadComponent).toBe('function');
    }
  });

  it('debería tener exactamente 8 rutas', () => {
    expect(routes.length).toBe(8);
  });
});
