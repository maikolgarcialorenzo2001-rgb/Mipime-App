import { environment } from '../environments/environment';
import type { SQLocal } from 'sqlocal';

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
