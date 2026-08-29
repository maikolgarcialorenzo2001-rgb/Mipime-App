import { routes } from './app.routes';
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
});