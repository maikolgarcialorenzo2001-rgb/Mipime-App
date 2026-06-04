import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink],
  templateUrl: './app-nav.component.html',
  styleUrl: './app-nav.component.css',
})
export class AppNavComponent {
  protected readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
