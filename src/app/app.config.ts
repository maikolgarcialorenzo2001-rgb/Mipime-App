import { ApplicationConfig, LOCALE_ID, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations, provideNoopAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { provideDatabase } from './services/database';
import { SqliteService } from './services/sqlite.service';
import { NativeSqliteService } from './services/native-sqlite.service';
import { environment } from './environments/environment';
import { ttlCheckInitializer } from './initializers/ttl-check';

registerLocaleData(localeEs);

// D4: con prefers-reduced-motion: reduce el usuario NO recibe animaciones de
// ruta (provideNoopAnimations desde el boot, antes del primer render).
const motionProviders =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? provideNoopAnimations()
    : provideAnimations();

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // AD-1: la presencia de electronAPI (no isPackaged) decide el driver.
    provideDatabase(window.electronAPI ? NativeSqliteService : SqliteService),
    motionProviders,
    { provide: LOCALE_ID, useValue: 'es' },
    ...(environment.testMode
      ? [{ provide: APP_INITIALIZER, useFactory: ttlCheckInitializer, multi: true }]
      : []),
  ],
};
