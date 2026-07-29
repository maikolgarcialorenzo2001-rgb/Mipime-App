import { app, BrowserWindow, protocol, ipcMain, dialog, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import {
  loadWindowState,
  saveWindowState,
  getDefaultWindowState,
} from './window-state';

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
