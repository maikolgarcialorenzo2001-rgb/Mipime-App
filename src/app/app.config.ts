import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { provideDatabase } from './services/database';
import { SqliteService } from './services/sqlite.service';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideDatabase(SqliteService),
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};
