import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { setupGuard } from './guards/setup.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/pos',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [setupGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () => import('./pages/setup/setup.page').then((m) => m.SetupPage),
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
    path: 'palmar',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/palmar/palmar.page').then((m) => m.PalmarPage),
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