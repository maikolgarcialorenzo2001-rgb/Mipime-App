import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/jornada',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'jornada',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/jornada/jornada.page').then((m) => m.JornadaPage),
  },
  {
    path: 'productos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/productos/producto.page').then((m) => m.ProductosPage),
  },
  {
    path: 'pos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pos/pos.page').then((m) => m.PosPage),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
  },
  {
    path: 'inventario',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/inventario/inventario.page').then((m) => m.InventarioPage),
  },
  {
    path: 'historial',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/historial/historial.page').then((m) => m.HistorialPage),
  },
];
