import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavComponent } from './components/layout/app-nav.component';
import { TtlExpiredComponent } from './components/ttl-expired/ttl-expired.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavComponent, TtlExpiredComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly ttlExpired = signal(false);

  constructor() {
    try {
      const expired = localStorage.getItem('mipime_ttl_expired');
      if (expired) {
        this.ttlExpired.set(true);
      }
    } catch {
      // localStorage unavailable — don't block the app
    }
  }
}
