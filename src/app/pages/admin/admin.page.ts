import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import type { UsuarioPublico } from '../../models';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    ErrorAlertComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.css',
})
export class AdminPage implements OnInit {
  private readonly userService = inject(UserService);
  readonly auth = inject(AuthService);

  readonly usuarios = signal<UsuarioPublico[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreateForm = signal(false);
  readonly activeAdminCount = signal(0);

  // Create form signals
  readonly newNombre = signal('');
  readonly newPassword = signal('');
  readonly newRol = signal<'admin' | 'trabajador'>('trabajador');

  // Reset password inline
  readonly resetPasswordUserId = signal<number | null>(null);
  readonly resetPasswordValue = signal('');

  // Computed
  readonly currentUserId = computed(() => this.auth.usuario()?.id ?? null);
  readonly isLastAdmin = computed(() => {
    if (this.activeAdminCount() !== 1) return false;
    const soleAdmin = this.usuarios().find(u => u.rol === 'admin' && u.activo === 1);
    return !!soleAdmin;
  });

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [users, adminCount] = await Promise.all([
        this.userService.list(),
        this.userService.getActiveAdminCount(),
      ]);
      this.usuarios.set(users);
      this.activeAdminCount.set(adminCount);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cargar usuarios',
      );
    } finally {
      this.loading.set(false);
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    this.error.set(null);
  }

  async onCreate(): Promise<void> {
    if (!this.newNombre().trim() || !this.newPassword().trim()) return;
    this.error.set(null);
    try {
      await this.userService.create(
        this.newNombre().trim(),
        this.newPassword(),
        this.newRol(),
      );
      this.newNombre.set('');
      this.newPassword.set('');
      this.newRol.set('trabajador');
      this.showCreateForm.set(false);
      await this.loadUsers();
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al crear usuario',
      );
    }
  }

  async onToggle(id: number): Promise<void> {
    this.error.set(null);
    try {
      await this.userService.toggleActivo(id);
      await this.loadUsers();
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cambiar estado',
      );
    }
  }

  async onUpdateRol(id: number, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const rol = select.value as 'admin' | 'trabajador';
    this.error.set(null);
    try {
      await this.userService.updateRol(id, rol);
      await this.loadUsers();
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al cambiar rol',
      );
    }
  }

  startResetPass(id: number): void {
    this.resetPasswordUserId.set(id);
    this.resetPasswordValue.set('');
    this.error.set(null);
  }

  async onResetPass(id: number): Promise<void> {
    if (!this.resetPasswordValue().trim()) return;
    this.error.set(null);
    try {
      await this.userService.updatePassword(id, this.resetPasswordValue().trim());
      this.resetPasswordUserId.set(null);
      this.resetPasswordValue.set('');
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Error al resetear contraseña',
      );
    }
  }
}