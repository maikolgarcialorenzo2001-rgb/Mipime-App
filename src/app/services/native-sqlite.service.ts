import { Injectable, inject } from '@angular/core';
import type { Database } from './database';
import { DbStatusService } from './db-status.service';
import { environment } from '../environments/environment';
import { runMigrations } from './db-migrations';

/**
 * Implementación de `Database` sobre el proceso main vía IPC (T4, AD-1/AD-3).
 * Se selecciona en app.config cuando `window.electronAPI` existe. El SQL
 * viaja sentencia por sentencia por `db:sql` (R6); el arranque por
 * `db:initialize` (AD-9: adopt y diagnostics van dentro del resultado).
 */
@Injectable()
export class NativeSqliteService implements Database {
  private readonly _dbStatus = inject(DbStatusService);

  private _invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    const api = window.electronAPI;
    if (!api) {
      return Promise.reject(new Error('Electron API no disponible'));
    }
    return api.invoke(channel, ...args) as Promise<T>;
  }

  async sql<T>(query: string, params?: unknown[]): Promise<T[]> {
    return this._invoke<T[]>('db:sql', { query, params: params ?? [] });
  }

  async initialize(): Promise<void> {
    const init = await this._invoke<DbInitResult>('db:initialize');

    if (init.status === 'fatal') {
      // RESOLVED-RISK-2: el arranque fatal NUNCA lanza; se publica el
      // diagnóstico en DbStatusService y la UI bloquea (T6).
      this._dbStatus.setFatal(init.diagnostics ?? null);
      return;
    }

    if (init.status === 'import-needed') {
      // Roundtrip one-shot OPFS→native: datos OPFS (o null si CANTOPEN/empty)
      // -> db:import -> main decide (importDbFile con flag, o adopt-or-fresh).
      await this._runImportRoundtrip();
    }

    // AD-3: migraciones sobre el mismo contrato IPC, sentencia por sentencia.
    await runMigrations(
      { sql: (q, p) => this.sql(q, p) },
      { seedEnabled: environment.seedEnabled },
    );
  }

  private async _runImportRoundtrip(): Promise<void> {
    let file: ArrayBuffer | null = null;
    try {
      const { SQLocal } = await import('sqlocal');
      const client = new SQLocal({ databasePath: environment.dbName });
      // getDatabaseFile devuelve un File web; el contrato IPC pide ArrayBuffer.
      file = await (await client.getDatabaseFile()).arrayBuffer();
    } catch {
      // CANTOPEN / vacío: sin datos OPFS → file queda en null (inicial).
    }
    await this._invoke<DbImportResult>('db:import', { file });

    const after = await this._invoke<DbInitResult>('db:initialize');
    if (after.status === 'fatal') {
      this._dbStatus.setFatal(after.diagnostics ?? null);
    }
  }
}
