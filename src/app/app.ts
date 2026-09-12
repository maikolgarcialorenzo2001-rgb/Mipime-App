import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { routeAnimations } from './animations/route.transitions';
import { AppNavComponent } from './components/layout/app-nav.component';
import { TtlExpiredComponent } from './components/ttl-expired/ttl-expired.component';
import { DbErrorComponent } from './components/db-error/db-error.component';
import { RestoreFeedbackComponent } from './components/restore-feedback/restore-feedback.component';
import { AppToastComponent } from './components/app-toast/app-toast.component';
import { DbStatusService } from './services/db-status.service';
import { FontScaleService } from './services/font-scale.service';
import { ActivePageService } from './services/active-page.service';

@Component({
  selector: 'app-root',
  animations: [routeAnimations],
  imports: [
    RouterOutlet,
    AppNavComponent,
    TtlExpiredComponent,
    DbErrorComponent,
    RestoreFeedbackComponent,
    AppToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly ttlExpired = signal(false);
  readonly dbStatus = inject(DbStatusService);
  readonly fontScale = inject(FontScaleService);
  readonly activePage = inject(ActivePageService);

  /**
   * Shell: pt-16 reserva el nav fijo para todas las páginas; el padding lateral
   * solo para páginas "tarjeteado"; POS es full-bleed (su drawer fijo ya es
   * full-width y su propia calc gobierna el alto).
   */
  readonly mainClass = computed(() => clasesMain(this.activePage.pagina()));

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

export function clasesMain(pagina: string): string {
  const base = 'min-h-screen bg-gray-50 dark:bg-gray-950 pt-16';
  return pagina === 'pos' ? base : `${base} px-2 lg:px-4`;
}
