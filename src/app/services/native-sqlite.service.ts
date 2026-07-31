import { Injectable, inject } from '@angular/core';
import type { Database } from './database';
import { DbStatusService } from './db-status.service';
import { environment } from '../environments/environment';
import { runMigrations } from './db-migrations';
import { createSqlocalClient } from './sqlocal-client';

/**
 * Implementación de `Database` sobre el proceso main vía IPC (T4, AD-1/AD-3).
 * Se selecciona en app.config cuando `window.electronAPI` existe. El SQL
 * viaja sentencia por sentencia por `db:sql` (R6); el arranque por
 * `db:initialize` (AD-9: adopt y diagnostics van dentro del resultado).
 */
@Injectable()
export class NativeSqliteService implements Database {
  private readonly _dbStatus = inject(DbStatusService);

  /** Versión cacheada del invoke app:getVersion (MINOR-5); 'unknown' si falla. */
  private _appVersion: string | null = null;

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
    let init: DbInitResult;
    try {
      init = await this._invoke<DbInitResult>('db:initialize');
    } catch (err) {
      // M1: el arranque NUNCA lanza (RESOLVED-RISK-2). Un rechazo del canal
      // se traduce a fatal con diagnóstico sintetizado.
      this._dbStatus.setFatal(await this._synthesizeDiagnostics('open', err));
      return;
    }

    if (init.status === 'fatal') {
      // RESOLVED-RISK-2: el arranque fatal NUNCA lanza; se publica el
      // diagnóstico en DbStatusService y la UI bloquea (T6).
      this._dbStatus.setFatal(init.diagnostics ?? null);
      return;
    }

    // T9: restauración/adopción del arranque → aviso transitorio en UI (R4).
    // Solo se publica cuando el resultado lo reporta: un status fresh/ok
    // posterior NUNCA borra un aviso ya publicado (el re-init del roundtrip
    // devolvería 'ok' sin restoreInfo y mataría el aviso de adopt).
    if (init.restoreInfo) {
      this._dbStatus.setRestoreInfo(init.restoreInfo);
    }

    if (init.status === 'import-needed') {
      const roundtripOk = await this._runImportRoundtrip();
      if (!roundtripOk) {
        // M2: el roundtrip no produjo una DB usable (fatal, import {ok:false}
        // o import-needed repetido). NO migrar: db:sql crearía la DB fresca
        // y el flag de import quedaría saltado para siempre → datos OPFS
        // varados (RESOLVED-RISK-1 roto, fresh+seed silencioso).
        return;
      }
    }

    // AD-3: migraciones sobre el mismo contrato IPC, sentencia por sentencia.
    try {
      await runMigrations(
        { sql: (q, p) => this.sql(q, p) },
        { seedEnabled: environment.seedEnabled },
      );
    } catch (err) {
      // C2 (CRITICAL): un rechazo de db:sql DURANTE runMigrations también es
      // fatal. Si llegara a rechazar, initialize() rechazaría → APP_INITIALIZER
      // → bootstrapApplication rechaza → pantalla genérica SIN diagnóstico ni
      // botón de copiar (todo T6 saltado). Publicar fatal y resolver.
      this._dbStatus.setFatal(await this._synthesizeDiagnostics('open', err));
      return;
    }
  }

  private async _synthesizeDiagnostics(
    stage: 'open' | 'import',
    err: unknown,
  ): Promise<DbDiagnostics> {
    return {
      appVersion: await this._appVersionOrUnknown(),
      platform: window.electronAPI?.platform ?? 'unknown',
      sqliteError: (err as Error).message,
      stage,
      backupsTried: [],
    };
  }

  /** Versión real vía app:getVersion (canal existente); 'unknown' si falla. */
  private async _appVersionOrUnknown(): Promise<string> {
    if (this._appVersion === null) {
      try {
        const v = await this._invoke<string>('app:getVersion');
        this._appVersion = typeof v === 'string' ? v : 'unknown';
      } catch {
        this._appVersion = 'unknown';
      }
    }
    return this._appVersion;
  }

  private async _runImportRoundtrip(): Promise<boolean> {
    let file: ArrayBuffer | null = null;
    try {
      // M1: factoría compartida con SqliteService. El Worker explícito
      // procesado por Vite evita NS_ERROR_CORRUPTED_CONTENT; si el worker
      // fallara en el renderer, getDatabaseFile() rechazaría → file:null →
      // adoptOrFresh crearía DB fresca y el flag bloquearía re-imports
      // (datos OPFS varados).
      const client = await createSqlocalClient();
      // getDatabaseFile devuelve un File web; el contrato IPC pide ArrayBuffer.
      // Lectura NO destructiva (R8): OPFS queda intacto, solo VACUUM INTO.
      file = await (await client.getDatabaseFile()).arrayBuffer();
      // Archivo OPFS vacío (0 bytes) = sin datos → mismo contrato que
      // CANTOPEN: file:null para que main continúe adopt-or-fresh.
      if (file.byteLength === 0) {
        file = null;
      }
    } catch {
      // CANTOPEN / vacío: sin datos OPFS → file queda en null (inicial).
    }

    try {
      const imported = await this._invoke<DbImportResult>('db:import', { file });
      if (!imported.ok) {
        // M2: el resultado del import NO se descarta. Fallo (validación o
        // disco) → fatal stage 'import' sin migrar.
        this._dbStatus.setFatal(
          await this._synthesizeDiagnostics(
            'import',
            new Error(imported.error ?? 'import failed'),
          ),
        );
        return false;
      }
      // T9: file:null + adoptOrFresh adoptó → el restoreInfo viaja en el
      // resultado del import; publicarlo para el aviso de restauración (R4).
      if (imported.restoreInfo) {
        this._dbStatus.setRestoreInfo(imported.restoreInfo);
      }
    } catch (err) {
      this._dbStatus.setFatal(await this._synthesizeDiagnostics('import', err));
      return false;
    }

    let after: DbInitResult;
    try {
      after = await this._invoke<DbInitResult>('db:initialize');
    } catch (err) {
      this._dbStatus.setFatal(await this._synthesizeDiagnostics('import', err));
      return false;
    }
    if (after.status === 'fatal') {
      this._dbStatus.setFatal(after.diagnostics ?? null);
      return false;
    }
    if (after.status === 'import-needed') {
      // M2: el import no produjo una DB usable; publicar fatal para no caer
      // en fresh+seed silencioso con los datos OPFS varados.
      this._dbStatus.setFatal(
        await this._synthesizeDiagnostics(
          'import',
          new Error('import did not produce a working database'),
        ),
      );
      return false;
    }
    // T9: el re-init post-import también puede reportar restauración (R4).
    // No toca un restoreInfo ya publicado (adopt del import, p.ej.).
    if (after.restoreInfo) {
      this._dbStatus.setRestoreInfo(after.restoreInfo);
    }
    return true;
  }
}
