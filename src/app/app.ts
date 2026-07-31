import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavComponent } from './components/layout/app-nav.component';
import { TtlExpiredComponent } from './components/ttl-expired/ttl-expired.component';
import { DbErrorComponent } from './components/db-error/db-error.component';
import { RestoreFeedbackComponent } from './components/restore-feedback/restore-feedback.component';
import { DbStatusService } from './services/db-status.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    AppNavComponent,
    TtlExpiredComponent,
    DbErrorComponent,
    RestoreFeedbackComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly ttlExpired = signal(false);
  readonly dbStatus = inject(DbStatusService);

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
