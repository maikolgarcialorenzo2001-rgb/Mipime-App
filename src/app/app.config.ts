import { ApplicationConfig, LOCALE_ID, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { provideDatabase } from './services/database';
import { SqliteService } from './services/sqlite.service';
import { NativeSqliteService } from './services/native-sqlite.service';
import { environment } from './environments/environment';
import { ttlCheckInitializer } from './initializers/ttl-check';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // AD-1: la presencia de electronAPI (no isPackaged) decide el driver.
    provideDatabase(window.electronAPI ? NativeSqliteService : SqliteService),
    { provide: LOCALE_ID, useValue: 'es' },
    ...(environment.testMode
      ? [{ provide: APP_INITIALIZER, useFactory: ttlCheckInitializer, multi: true }]
      : []),
  ],
};
