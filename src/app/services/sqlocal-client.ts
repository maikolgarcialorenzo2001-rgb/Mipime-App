import { InjectionToken } from '@angular/core';
import { environment } from '../environments/environment';
import type { SQLocal } from 'sqlocal';

export type SqlocalClientFactory = () => Promise<SQLocal>;

/**
 * Token DI de la factoría compartida de clientes SQLocal (M1). Los servicios
 * inyectan la factoría en vez de importar la función directamente, lo que
 * permite reemplazarla con un mock en los tests vía TestBed (el unit-test
 * builder prohíbe vi.mock con imports relativos). El factory del token
 * mantiene el comportamiento de producción idéntico al import directo.
 */
export const SQLOCAL_CLIENT_FACTORY = new InjectionToken<SqlocalClientFactory>(
  'SQLOCAL_CLIENT_FACTORY',
  {
    providedIn: 'root',
    factory: () => createSqlocalClient,
  },
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
