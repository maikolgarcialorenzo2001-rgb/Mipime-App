import { app, BrowserWindow, protocol, ipcMain, dialog, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import {
  loadWindowState,
  saveWindowState,
  getDefaultWindowState,
} from './window-state';
import {
  runStartupSequence,
  importDbFile,
  openNativeDb,
  backupDb,
  pruneBackups,
  adoptOrFresh,
  DB_FILENAME,
  IMPORT_FLAG_FILENAME,
  MAX_IMPORT_BYTES,
} from './db';

let mainWindow: BrowserWindow | null = null;

// Register custom protocol BEFORE app is ready (required by Electron)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mipime-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

/**
 * Adds Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
 * headers to a Response. Required for SQLocal/OPFS cross-origin isolation.
 */
export function addIsolationHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Nombre de snapshot timestamped: backups\tienda_<YYYY-MM-DD_HHmm>.db (R1). */
function timestampedBackupName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tienda_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}.db`;
}

/** Nombre sugerido para export manual: tienda_export_<YYYYMMDD_HHmm>.db. */
function exportName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tienda_export_${d.getFullYear()}${p(d.getMonth() + 1)}${p(
    d.getDate(),
  )}_${p(d.getHours())}${p(d.getMinutes())}.db`;
}

function createMainWindow(): BrowserWindow {
  const isDev = !app.isPackaged;

  // Restore saved window state, or fall back to defaults
  const savedState = loadWindowState(app.getPath('userData'));
  const defaultState = getDefaultWindowState();
  const windowState = savedState ?? defaultState;

  // Only set position when saved state has it; otherwise center
  const hasPosition =
    windowState.x !== undefined && windowState.y !== undefined;

  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    ...(hasPosition
      ? { x: windowState.x, y: windowState.y }
      : { center: true }),
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    show: false, // prevent visual flash — show on ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Save window state before closing
  win.on('close', () => {
    const bounds = win.getBounds();
    saveWindowState(app.getPath('userData'), bounds);
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    // Load via custom protocol for COOP/COEP isolation (required by SQLocal/OPFS)
    win.loadURL('mipime-app://index.html');
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(() => {
  // Set up custom protocol handler to serve files with COOP/COEP headers
  protocol.handle('mipime-app', (request) => {
    const url = new URL(request.url);
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const distDir = path.join(__dirname, '../dist/Mipime-Cuentas/browser');
    const fullPath = path.join(distDir, filePath);

    try {
      const data = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.wasm': 'application/wasm',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return addIsolationHeaders(
        new Response(data, {
          status: 200,
          headers: { 'Content-Type': contentType },
        }),
      );
    } catch {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(distDir, 'index.html');
      const data = fs.readFileSync(indexPath);
      return addIsolationHeaders(
        new Response(data, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      );
    }
  });

  // Register IPC handlers
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('dialog:saveFile', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow!, options);
    return result.canceled ? null : result.filePath ?? null;
  });

  // Synchronous query — used by preload at module init
  ipcMain.on('app:isPackaged', (event) => {
    event.returnValue = app.isPackaged;
  });

  // Save file to Documents/Tienda IPVE/ without user-facing dialog.
  // filePath is relative, e.g. "2026/07 - Julio/jornada_2026-07-28_123.xlsx".
  // base64 is the raw Excel base64 string.
  ipcMain.handle('file:saveFile', async (_event, { base64, filePath }) => {
    try {
      const documentsPath = app.getPath('documents');
      const destDir = path.join(documentsPath, 'Tienda IPVE');
      const fullPath = path.join(destDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
      return { success: true, filePath: fullPath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ---- DB nativa: contrato IPC de 5 canales (T3, AD-9) ----
  const dbPathFor = () => path.join(app.getPath('userData'), DB_FILENAME);
  const rodantePathFor = () =>
    path.join(app.getPath('documents'), 'Tienda - App', 'DataBase', DB_FILENAME);
  const backupsDirFor = () =>
    path.join(app.getPath('documents'), 'Tienda - App', 'DataBase', 'backups');

  // Arranque completo: open -> recoverInPlace -> rodante -> timestamped ->
  // adopt/fresh. Adopt y diagnostics van DENTRO del resultado (AD-9), no son
  // canales aparte.
  ipcMain.handle('db:initialize', () => {
    try {
      return runStartupSequence({
        userDataPath: app.getPath('userData'),
        documentsPath: app.getPath('documents'),
        appVersion: app.getVersion(),
        platform: process.platform,
      });
    } catch (err) {
      // M1: el handler NUNCA lanza (RESOLVED-RISK-2). Un fallo inesperado
      // de runStartupSequence (p.ej. disco al crear la DB fresca dentro de
      // adoptOrFresh) se traduce a fatal con diagnóstico sintetizado.
      return {
        status: 'fatal',
        diagnostics: {
          appVersion: app.getVersion(),
          platform: process.platform,
          sqliteError: (err as Error).message,
          stage: 'open',
          backupsTried: [],
        },
      };
    }
  });

  // SQL de una sola sentencia (R6): prepare() lanza si hay más de una.
  // Las sentencias sin filas (CREATE/INSERT/UPDATE) se ejecutan con run()
  // y devuelven []; las que devuelven filas (SELECT/PRAGMA/RETURNING) con
  // all(). En better-sqlite3 v13 all() LANZA si la sentencia no devuelve
  // datos, por eso el branch por stmt.reader.
  ipcMain.handle(
    'db:sql',
    (_event, { query, params }: { query: string; params?: unknown[] }) => {
      if (typeof query !== 'string' || !query.trim()) {
        throw new Error('db:sql requires a non-empty query string');
      }
      const trimmed = query.trim();
      // S1: ATTACH/DETACH están prohibidos (abrirían archivos arbitrarios
      // dentro del contexto de la DB nativa).
      if (/^(ATTACH|DETACH)\b/i.test(trimmed)) {
        throw new Error('db:sql does not allow ATTACH/DETACH');
      }
      // S1: escrituras PRAGMA (forma asignación) rechazadas salvo
      // foreign_keys, que el runner de migraciones necesita (migrationV15).
      if (
        !/^PRAGMA\s+foreign_keys\b/i.test(trimmed) &&
        /^PRAGMA\b[^()=]*=/i.test(trimmed)
      ) {
        throw new Error('db:sql does not allow PRAGMA writes');
      }
      const db = openNativeDb(dbPathFor());
      try {
        const stmt = db.prepare(query);
        if (stmt.reader) {
          return stmt.all(...(params ?? []));
        }
        stmt.run(...(params ?? []));
        return [];
      } finally {
        db.close();
      }
    },
  );

  // Import one-shot OPFS→native. null = no hay datos OPFS: NO se escribe el
  // flag (reintento permitido el próximo arranque, RESOLVED-RISK-1) y se
  // continúa adopt-or-fresh para romper el ciclo import-needed.
  ipcMain.handle(
    'db:import',
    (_event, { file }: { file: unknown }) => {
      // T7/S2: validación de payload (IPC = entrada no confiable). El
      // instanceof corre en runtime aunque TS ya tipa el contrato.
      if (file !== null && !(file instanceof ArrayBuffer)) {
        return { ok: false, error: 'db:import requires an ArrayBuffer or null' };
      }
      if (file !== null && file.byteLength > MAX_IMPORT_BYTES) {
        return {
          ok: false,
          error: 'db:import payload exceeds the 512MB limit',
        };
      }
      try {
        if (file === null) {
          console.log(
            '[db:import] no OPFS data — continuing with adopt-or-fresh',
          );
          adoptOrFresh(dbPathFor(), rodantePathFor(), backupsDirFor());
          return { ok: true };
        }
        return importDbFile(
          file,
          dbPathFor(),
          path.join(app.getPath('userData'), IMPORT_FLAG_FILENAME),
          app.getVersion(),
        );
      } catch (err) {
        // M1: adoptOrFresh puede lanzar al crear la DB fresca (disco).
        // El handler NUNCA lanza: {ok:false} deja que el renderer publique
        // fatal stage 'import' en vez de migrar sobre una DB inexistente.
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // Backup bajo demanda. 'open' -> solo rodante; 'jornada-close' -> rodante +
  // snapshot timestamped + prune(30) (R1–R3). Nunca lanza: devuelve
  // {ok:false, error} (R6: los fallos de backup no interrumpen).
  ipcMain.handle(
    'db:backupNow',
    async (_event, { trigger }: { trigger: string }) => {
      // S3: trigger desconocido → {ok:false} sin tocar la DB.
      if (trigger !== 'open' && trigger !== 'jornada-close') {
        return {
          ok: false,
          error: `Unknown backup trigger: ${String(trigger)}`,
        };
      }
      try {
        const db = openNativeDb(dbPathFor());
        try {
          await backupDb(db, rodantePathFor());
        } finally {
          db.close();
        }
        if (trigger === 'jornada-close') {
          const snapshotPath = path.join(
            backupsDirFor(),
            timestampedBackupName(new Date()),
          );
          const snapDb = openNativeDb(dbPathFor());
          try {
            await backupDb(snapDb, snapshotPath);
          } finally {
            snapDb.close();
          }
          pruneBackups(backupsDirFor(), 30);
          return {
            ok: true,
            rodantePath: rodantePathFor(),
            timestampedPath: snapshotPath,
          };
        }
        return { ok: true, rodantePath: rodantePathFor() };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // Export manual (R5): diálogo guardar + backupDb incremental al destino.
  ipcMain.handle('db:export', async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: path.join(
          app.getPath('documents'),
          'Tienda - App',
          'DataBase',
          exportName(new Date()),
        ),
        filters: [{ name: 'SQLite database', extensions: ['db'] }],
      });
      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }
      const db = openNativeDb(dbPathFor());
      try {
        await backupDb(db, result.filePath);
      } finally {
        db.close();
      }
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });
  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Actualización disponible',
        message:
          'Se ha descargado una nueva versión. ¿Desea reiniciar la aplicación para instalarla?',
        buttons: ['Reiniciar', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Auto-updater check failed:', err);
  });

  // Remove default menu bar (File/Help submenu under title bar)
  Menu.setApplicationMenu(null);

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
