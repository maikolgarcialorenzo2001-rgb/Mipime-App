import { environment } from '../environments/environment';
import { InjectionToken } from '@angular/core';
import type { SQLocal } from 'sqlocal';

export type SqlocalClientFactory = () => Promise<SQLocal>;

/**
 * Token de la factoría compartida de clientes SQLocal (M1). Inyectable para
 * poder mockearla con TestBed (el sistema de unit-test de Angular no permite
 * `vi.mock` con imports relativos). El default usa la factoría real.
 */
export const SQLOCAL_CLIENT = new InjectionToken<SqlocalClientFactory>(
  'SQLocal client factory',
  { providedIn: 'root', factory: () => createSqlocalClient },
);

/**
 * Factoría compartida de clientes SQLocal (M1). SqliteService y el roundtrip
 * de import OPFS→native (NativeSqliteService) usan el MISMO patrón: el
 * Worker se crea desde nuestro código para que Vite/Angular lo procese
 * correctamente (type: module). Si dejamos que SQLocal cree el Worker
 * internamente, Vite no configura worker.format: 'es' y el worker falla con
 * NS_ERROR_CORRUPTED_CONTENT en este build.
 */
export async function createSqlocalClient(): Promise<SQLocal> {
  // Dynamic import: sqlocal se carga solo en el browser,
  // Vite nunca lo bundlea para SSR y no rompe el dev server.
  const { SQLocal: SQLocalClass } = await import('sqlocal');

  const worker = new Worker(
    new URL('../../../node_modules/sqlocal/dist/worker', import.meta.url),
    { type: 'module' },
  );

  return new SQLocalClass({
    databasePath: environment.dbName,
    processor: worker,
  });
}
