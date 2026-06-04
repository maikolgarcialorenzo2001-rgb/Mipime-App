import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    @if (auth.isLoggedIn()) {
      <nav class="border-b border-gray-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span class="text-lg font-bold text-gray-900">Mipime-Cuentas</span>
          <div class="flex items-center gap-4 text-sm font-medium">
            <a routerLink="/pos" class="font-semibold text-blue-600 hover:text-blue-800 transition-colors">POS</a>
            <a routerLink="/productos" class="text-gray-600 hover:text-blue-600 transition-colors">Productos</a>
            <a routerLink="/jornada" class="text-gray-600 hover:text-blue-600 transition-colors">Jornada</a>
            <a routerLink="/inventario" class="text-gray-600 hover:text-blue-600 transition-colors">Inventario</a>
            <a routerLink="/historial" class="text-gray-600 hover:text-blue-600 transition-colors">Historial</a>
            @if (auth.hasRole('admin')) {
              <a routerLink="/admin" class="text-gray-600 hover:text-blue-600 transition-colors">Admin</a>
            }
            <span class="ml-4 text-gray-500">{{ auth.usuario()?.nombre }}</span>
            <button (click)="logout()" class="text-red-600 hover:text-red-800 transition-colors">Cerrar sesión</button>
          </div>
        </div>
      </nav>
    }
    <router-outlet />
  `,
  styles: '',
})
export class App {
  protected readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
