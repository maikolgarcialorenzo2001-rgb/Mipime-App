import { TestBed } from '@angular/core/testing';
import { SqliteService } from './sqlite.service';
import { DATABASE } from './database';

// Integración REAL con SQLocal (Worker + WASM + OPFS): solo puede correr en un
// browser/Electron. En jsdom (vitest.config.ts environment: 'jsdom') no existe
// Worker ni OPFS, así que se documenta como prueba de integración y se salta en
// el runner unit — la lógica de migraciones v1..v18 ya está cubierta por mocks
// en db-migrations.spec.ts y sqlite.service.spec.ts.
describe.skipIf(typeof Worker === 'undefined')(
  'Fresh install - migrations v1..v18',
  () => {
    let sqliteService: SqliteService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          SqliteService,
          { provide: DATABASE, useExisting: SqliteService },
        ],
      });
      sqliteService = TestBed.inject(SqliteService);
    });

    afterEach(() => {
      TestBed.resetTestingModule();
    });

    it('should run migrations v1..v18 and create config table', async () => {
      await sqliteService.initialize();

      // Check schema version is 18
      const schemaRows = await sqliteService.sql<{ version: number }>(
        'SELECT MAX(version) AS version FROM schema_version',
      );
      expect(schemaRows[0]?.version).toBe(18);

      // Check config table exists
      const configRows = await sqliteService.sql<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='config'",
      );
      expect(configRows.length).toBeGreaterThan(0);

      // Check config table structure
      const configInfo = await sqliteService.sql<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='config'",
      );
      expect(configInfo[0]?.sql).toContain('clave TEXT PRIMARY KEY');
      expect(configInfo[0]?.sql).toContain('valor TEXT NOT NULL');
    });

    it('should have all 18 schema versions applied', async () => {
      await sqliteService.initialize();

      const versions = await sqliteService.sql<{ version: number }>(
        'SELECT version FROM schema_version ORDER BY version',
      );
      expect(versions.map(v => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    });
  },
);