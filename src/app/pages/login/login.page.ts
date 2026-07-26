import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { JornadaService } from '../../services/jornada.service';
import { ErrorAlertComponent } from '../../components/error-alert/error-alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ErrorAlertComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly jornadaService = inject(JornadaService);

  readonly username = signal('');
  readonly password = signal('');
  readonly loginError = signal<string | null>(null);
  readonly cargando = signal(false);

  async onSubmit(): Promise<void> {
    this.loginError.set(null);
    this.cargando.set(true);

    try {
      const user = await firstValueFrom(this.auth.login(this.username(), this.password()));

      // Si hay una jornada abierta de otro usuario, cerrarla automáticamente
      const abierta = await firstValueFrom(this.jornadaService.obtenerAbierta());
      if (abierta) {
        const result = await this.jornadaService.autoCerrarSiOtroUsuario(user);
        if (result === null) {
          // Jornada de otro usuario fue auto-cerrada → flag para toast en próxima página
          sessionStorage.setItem('mipime_jornada_auto_cerrada', 'true');
        }
      }

      this.router.navigate(['/pos']);
    } catch (e) {
      this.loginError.set(e instanceof Error ? e.message : 'Error al iniciar sesión');
    } finally {
      this.cargando.set(false);
    }
  }
}
