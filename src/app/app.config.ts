import { ApplicationConfig, LOCALE_ID, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { provideDatabase } from './services/database';
import { SqliteService } from './services/sqlite.service';
import { environment } from './environments/environment';
import { ttlCheckInitializer } from './initializers/ttl-check';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideDatabase(SqliteService),
    { provide: LOCALE_ID, useValue: 'es' },
    ...(environment.testMode
      ? [{ provide: APP_INITIALIZER, useFactory: ttlCheckInitializer, multi: true }]
      : []),
  ],
};
