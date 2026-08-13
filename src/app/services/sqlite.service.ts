import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SQLocal } from 'sqlocal';
import type { Database, SqlExecutor } from './database';
import { environment } from '../environments/environment';
import { createSqlocalClient } from './sqlocal-client';
import { runMigrations } from './db-migrations';

@Injectable()
export class SqliteService implements Database {
  private _client: SQLocal | null = null;
  private readonly _isBrowser: boolean;

  /**
   * Profundidad de transacciones activas (D1): > 0 significa que ya hay
   * una transacción abierta (BEGIN raw vía sql() o client.transaction()).
   * En ese caso transaction() anidada hace JOIN en vez de abrir otra txn.
   */
  private _txnDepth = 0;

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
    // D1: tracking de BEGIN/COMMIT/ROLLBACK raw. VentaService abre la txn
    // con 'BEGIN TRANSACTION' vía sql(); el depth permite que una
    // transaction() anidada haga JOIN sin "transaction within a transaction"
    // (que en SQLite sería un error).
    const trimmed = query.trim();
    if (/^BEGIN\b/i.test(trimmed)) {
      this._txnDepth++;
    } else if (/^(COMMIT|ROLLBACK)\b/i.test(trimmed)) {
      this._txnDepth = Math.max(0, this._txnDepth - 1);
    }

    const client = await this._getClient();
    const result = await client.sql(query, ...(params ?? []));
    return this._mapRows<T>(result);
  }

  /**
   * Ejecuta fn en una transacción atómica vía client.transaction() (SQLocal),
   * que hace BEGIN/COMMIT/ROLLBACK a nivel del driver.
   *
   * RE-ENTRANTE (D1): si ya hay una transacción activa (_txnDepth > 0, por un
   * BEGIN raw o por una transaction() externa), fn corre desnuda contra la
   * conexión y el commit/rollback queda en manos del dueño externo.
   */
  async transaction<Result>(
    fn: (tx: SqlExecutor) => Promise<Result>,
  ): Promise<Result> {
    const client = await this._getClient();

    if (this._txnDepth > 0) {
      // JOIN: misma conexión → las sentencias participan de la txn abierta.
      return fn({ sql: (q, p) => this.sql(q, p) });
    }

    this._txnDepth++;
    try {
      return await client.transaction(async (tx) =>
        fn({
          // Mismo patrón de cast que initialize()/runMigrations: SQLocal
          // tipa el resultado como Record<string, any>[] y el executor es
          // genérico. El schema es nuestro, así que el cast es seguro.
          sql: async <T>(q: string, p?: unknown[]) =>
            ((await tx.sql(q, ...(p ?? []))) as unknown) as T[],
        }),
      );
    } finally {
      this._txnDepth--;
    }
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

    // T11 (R9): pedir persistencia del storage OPFS tras un init exitoso.
    // Best-effort y fire-and-forget: si el API no existe o rechaza, el
    // arranque continúa igual (nunca bloquea ni lanza).
    this._requestStoragePersistence();
  }

  private _requestStoragePersistence(): void {
    try {
      void navigator.storage?.persist?.().then(
        (granted) =>
          console.log('[SqliteService] storage.persist() =', granted),
        (err) =>
          console.warn('[SqliteService] storage.persist() falló (R9):', err),
      );
    } catch {
      // R9 best-effort: API ausente (navegador viejo / no soportado).
    }
  }
}
