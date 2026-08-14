import { InjectionToken, type Provider, type EnvironmentProviders, APP_INITIALIZER } from '@angular/core';

/** Ejecutor SQL restringido que se pasa al callback de `transaction()`. */
export interface SqlExecutor {
  /** Run SQL and return rows. Use ? placeholders for params. */
  sql<T>(query: string, params?: unknown[]): Promise<T[]>;
}

export interface Database {
  /** Run SQL and return rows. Use ? placeholders for params. */
  sql<T>(query: string, params?: unknown[]): Promise<T[]>;

  /**
   * Ejecuta `fn` dentro de una transacción atómica (BEGIN/COMMIT/ROLLBACK).
   * RE-ENTRANTE (JOIN, D1): si ya hay una transacción activa en esta instancia
   * (BEGIN raw vía `sql()` o una `transaction()` externa), `fn` se ejecuta
   * desnuda y el commit/rollback queda a cargo del dueño externo. Esto permite
   * que VentaService (BEGIN raw) anide `registrarSalida` sin "cannot start a
   * transaction within a transaction" en ninguna plataforma.
   */
  transaction<Result>(fn: (tx: SqlExecutor) => Promise<Result>): Promise<Result>;

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
