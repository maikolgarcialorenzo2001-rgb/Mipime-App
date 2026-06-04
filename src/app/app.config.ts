import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideDatabase } from './services/database';
import { SqliteService } from './services/sqlite.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideDatabase(SqliteService),
  ],
};
