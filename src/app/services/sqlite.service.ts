import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SQLocal } from 'sqlocal';
import type { Database } from './database';
import { environment } from '../environments/environment';
import { runMigrations } from './db-migrations';

@Injectable()
export class SqliteService implements Database {
  private _client: SQLocal | null = null;
  private readonly _isBrowser: boolean;

  constructor() {
    this._isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  private async _getClient(): Promise<SQLocal> {
    if (!this._client) {
      if (!this._isBrowser) {
        throw new Error('SqliteService solo está disponible en el navegador');
      }
      // Dynamic import: sqlocal se carga solo en el browser,
      // Vite nunca lo bundlea para SSR y no rompe el dev server.
      const { SQLocal: SQLocalClass } = await import('sqlocal');

      // Creamos el Worker desde nuestro código para que Vite/Angular
      // lo procese correctamente (type: module). Si dejamos que SQLocal
      // cree el Worker internamente, Vite no configura worker.format: 'es'
      // y el worker falla con NS_ERROR_CORRUPTED_CONTENT.
      const worker = new Worker(
        new URL(
          '../../../node_modules/sqlocal/dist/worker',
          import.meta.url,
        ),
        { type: 'module' },
      );

      this._client = new SQLocalClass({
        databasePath: environment.dbName,
        processor: worker,
      });
    }
    return this._client;
  }

  async sql<T>(query: string, params?: unknown[]): Promise<T[]> {
    const client = await this._getClient();
    const result = await client.sql(query, ...(params ?? []));
    return this._mapRows<T>(result);
  }

  /**
   * Convierte el resultado crudo de SQLocal (Record<string, unknown>[])
   * al tipo esperado T. Es un cast necesario porque SQLocal no conoce
   * nuestras tablas. Nosotros controlamos el schema, así que es seguro.
   */
  private _mapRows<T>(rows: Record<string, unknown>[]): T[] {
    return rows as unknown as T[];
  }

  async initialize(): Promise<void> {
    if (!this._isBrowser) return;
    const client = await this._getClient();

    // schema_version lo crea el propio runner (única fuente de verdad, R4).
    // El cast es necesario: SQLocal devuelve Record<string, any>[] y el
    // executor es genérico; mismo patrón que _mapRows. await (no .then)
    // porque los mocks de test devuelven arrays planos.
    await runMigrations(
      {
        sql: async <T>(q: string, p?: unknown[]) =>
          ((await client.sql(q, ...(p ?? []))) as unknown) as T[],
      },
      { seedEnabled: environment.seedEnabled },
    );
  }
}
