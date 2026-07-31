import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SQLocal } from 'sqlocal';
import type { Database } from './database';
import { environment } from '../environments/environment';
import { createSqlocalClient } from './sqlocal-client';
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
      // M1: factoría compartida con el roundtrip de import OPFS→native.
      // Crea el Worker explícito procesado por Vite (worker.format 'es');
      // si SQLocal creara el Worker internamente fallaría con
      // NS_ERROR_CORRUPTED_CONTENT (ver sqlocal-client.ts).
      this._client = await createSqlocalClient();
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
