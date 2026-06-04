import { InjectionToken, type Provider, type EnvironmentProviders, APP_INITIALIZER } from '@angular/core';

export interface Database {
  /** Run SQL and return rows. Use ? placeholders for params. */
  sql<T>(query: string, params?: unknown[]): Promise<T[]>;

  /** Create tables and run migrations if needed. */
  initialize(): Promise<void>;
}

export const DATABASE = new InjectionToken<Database>('Database');

type DatabaseConstructor = new (...args: never[]) => Database;

/**
 * Registers a Database implementation as the app-wide provider.
 * Automatically initializes on bootstrap via APP_INITIALIZER.
 */
export function provideDatabase(implClass: DatabaseConstructor): (Provider | EnvironmentProviders)[] {
  return [
    implClass,
    { provide: DATABASE, useExisting: implClass },
    {
      provide: APP_INITIALIZER,
      useFactory: (db: Database) => () => db.initialize(),
      deps: [DATABASE],
      multi: true,
    },
  ];
}
