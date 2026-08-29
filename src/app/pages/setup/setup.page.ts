import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SetupService } from '../../services/setup.service';
import { AuthService } from '../../services/auth.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [FormsModule, ErrorAlertComponent],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.css',
})
export class SetupPage implements OnInit {
  private readonly setupService = inject(SetupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly nombre = signal('');
  readonly password = signal('');
  readonly nombreComercio = signal('');
  readonly seedProducts = signal(false);
  readonly modeReset = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly userId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap.subscribe((params) => {
      const mode = params.get('mode');
      const userId = params.get('userId');

      if (mode === 'reset') {
        this.modeReset.set(true);
        if (userId) {
          this.userId.set(parseInt(userId, 10));
        }
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);

    if (!this.modeReset()) {
      // Normal setup flow
      if (!this.nombre().trim() || !this.password().trim() || !this.nombreComercio().trim()) {
        this.error.set('Todos los campos son obligatorios');
        this.loading.set(false);
        return;
      }

      if (this.nombreComercio().length > 18) {
        this.error.set('El nombre del comercio no puede exceder 18 caracteres');
        this.loading.set(false);
        return;
      }

      try {
        await this.setupService.createInitialAdmin(
          this.nombre().trim(),
          this.password(),
          this.nombreComercio().trim(),
          this.seedProducts(),
        );

        // Login the new admin
        await firstValueFrom(this.auth.login(this.nombre().trim(), this.password()));

        this.router.navigate(['/pos']);
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : 'Error en la configuración inicial');
      } finally {
        this.loading.set(false);
      }
    } else {
      // Reset flow - only password reset
      if (!this.password().trim()) {
        this.error.set('La contraseña es obligatoria');
        this.loading.set(false);
        return;
      }

      if (!this.userId()) {
        this.error.set('Usuario no especificado para reset');
        this.loading.set(false);
        return;
      }

      try {
        // Update password for the legacy user
        // We need to use UserService.updatePassword, but for now just show error
        // In a real implementation, we'd inject UserService and call updatePassword
        this.error.set('Funcionalidad de reset de contraseña pendiente');
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : 'Error al resetear contraseña');
      } finally {
        this.loading.set(false);
      }
    }
  }
}