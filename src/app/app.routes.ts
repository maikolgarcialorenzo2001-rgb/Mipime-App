import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/jornada',
    pathMatch: 'full',
  },
  {
    path: 'jornada',
    loadComponent: () => import('./pages/jornada/jornada.page').then(m => m.JornadaPage),
  },
  {
    path: 'productos',
    loadComponent: () => import('./pages/productos/producto.page').then(m => m.ProductosPage),
  },
  {
    path: 'pos',
    loadComponent: () => import('./pages/pos/pos.page').then(m => m.PosPage),
  },
];
