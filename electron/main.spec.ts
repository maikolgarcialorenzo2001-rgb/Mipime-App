import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mock factories hoisted so vi.mock can reference them ----
let mockIsPackaged = false;
const mockGetAllWindows = vi.hoisted(() => vi.fn<() => unknown[]>(() => []));

const mockBrowserWindowGetBounds = vi.hoisted(() =>
  vi.fn(() => ({ x: 100, y: 50, width: 1280, height: 800 })),
);

const mockBrowserWindowInstance = vi.hoisted(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  webContents: { openDevTools: vi.fn() },
  once: vi.fn((_event: string, cb: () => void) => {
    if (_event === 'ready-to-show') cb();
    return mockBrowserWindowInstance;
  }),
  on: vi.fn(),
  show: vi.fn(),
  getBounds: mockBrowserWindowGetBounds,
  close: vi.fn(),
}));

// Use a regular function so it works with `new BrowserWindow()`
const mockBrowserWindowCtor = vi.hoisted(() =>
  vi.fn(function BrowserWindowMock() {
    return mockBrowserWindowInstance;
  }),
);
// Attach static methods after creation
vi.hoisted(() => {
  mockBrowserWindowCtor.getAllWindows = mockGetAllWindows;
});

const mockAppWhenReady = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockAppOn = vi.hoisted(() => vi.fn());
const mockAppQuit = vi.hoisted(() => vi.fn());
const mockAppGetVersion = vi.hoisted(() => vi.fn(() => '1.0.0'));

const mockRegisterSchemesAsPrivileged = vi.hoisted(() => vi.fn());
const mockProtocolHandle = vi.hoisted(() => vi.fn());

const mockIpcMainHandle = vi.hoisted(() => vi.fn());
const mockIpcMainOn = vi.hoisted(() => vi.fn());
const mockDialogShowSaveDialog = vi.hoisted(() => vi.fn());
const mockDialogShowMessageBox = vi.hoisted(() => vi.fn());
const mockAppGetPath = vi.hoisted(() => vi.fn(() => '/fake/userData'));
const mockAppGetName = vi.hoisted(() => vi.fn(() => 'MipimeCuentas'));
const mockMenuSetApplicationMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    whenReady: mockAppWhenReady,
    on: mockAppOn,
    get isPackaged() {
      return mockIsPackaged;
    },
    getVersion: mockAppGetVersion,
    quit: mockAppQuit,
    getPath: mockAppGetPath,
    getName: mockAppGetName,
  },
  BrowserWindow: mockBrowserWindowCtor,
  protocol: {
    registerSchemesAsPrivileged: mockRegisterSchemesAsPrivileged,
    handle: mockProtocolHandle,
  },
  ipcMain: {
    handle: mockIpcMainHandle,
    on: mockIpcMainOn,
  },
  dialog: {
    showSaveDialog: mockDialogShowSaveDialog,
    showMessageBox: mockDialogShowMessageBox,
  },
  Menu: {
    setApplicationMenu: mockMenuSetApplicationMenu,
  },
}));

// ---- autoUpdater mock ----
const mockAutoUpdaterCheckForUpdates = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockAutoUpdaterOn = vi.hoisted(() => vi.fn());
const mockAutoUpdaterQuitAndInstall = vi.hoisted(() => vi.fn());

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: mockAutoUpdaterCheckForUpdates,
    on: mockAutoUpdaterOn,
    quitAndInstall: mockAutoUpdaterQuitAndInstall,
    autoDownload: false,
  },
}));

const mockFsMkdirSync = vi.hoisted(() => vi.fn());
const mockFsWriteFileSync = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('mocked-content')),
  mkdirSync: mockFsMkdirSync,
  writeFileSync: mockFsWriteFileSync,
}));

const mockLoadWindowState = vi.hoisted(() => vi.fn(() => null));
const mockSaveWindowState = vi.hoisted(() => vi.fn());
const mockGetDefaultWindowState = vi.hoisted(() =>
  vi.fn(() => ({ width: 1280, height: 800 })),
);

vi.mock('./window-state', () => ({
  loadWindowState: mockLoadWindowState,
  saveWindowState: mockSaveWindowState,
  getDefaultWindowState: mockGetDefaultWindowState,
}));

/** Flush pending microtasks so .then() callbacks execute */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('main process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPackaged = false;
    mockGetAllWindows.mockReturnValue([]);
    // Restore default return value for app.getPath (can be overridden in nested describes)
    mockAppGetPath.mockReturnValue('/fake/userData');
  });

  describe('custom protocol registration', () => {
    it('should register mipime-app as a privileged scheme at module level', async () => {
      vi.resetModules();
      await import('./main');

      expect(mockRegisterSchemesAsPrivileged).toHaveBeenCalledTimes(1);
      expect(mockRegisterSchemesAsPrivileged).toHaveBeenCalledWith([
        expect.objectContaining({
          scheme: 'mipime-app',
          privileges: expect.objectContaining({
            standard: true,
            secure: true,
          }),
        }),
      ]);
    });

    it('should set up protocol handler for mipime-app in whenReady', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockProtocolHandle).toHaveBeenCalledWith(
        'mipime-app',
        expect.any(Function),
      );
    });
  });

  describe('addIsolationHeaders', () => {
    it('should add COOP and COEP headers to a response', async () => {
      const { addIsolationHeaders } = await import('./main');

      const response = new Response('test body', { status: 200 });
      const result = addIsolationHeaders(response);

      expect(result.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
      expect(result.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    });

    it('should preserve original response status and body', async () => {
      const { addIsolationHeaders } = await import('./main');

      const response = new Response('preserved body', { status: 404 });
      const result = addIsolationHeaders(response);

      expect(result.status).toBe(404);
      await expect(result.text()).resolves.toBe('preserved body');
    });
  });

  describe('IPC handlers', () => {
    it('should register app:getVersion IPC handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        'app:getVersion',
        expect.any(Function),
      );
    });

    it('should register app:getPlatform IPC handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        'app:getPlatform',
        expect.any(Function),
      );
    });

    it('should handle app:getVersion by returning app version', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'app:getVersion',
      )?.[1] as () => string;

      expect(handler).toBeDefined();
      expect(handler()).toBe('1.0.0');
    });

    it('should handle app:getPlatform by returning process.platform', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'app:getPlatform',
      )?.[1] as () => string;

      expect(handler).toBeDefined();
      expect(handler()).toBe(process.platform);
    });
  });

  describe('app:isPackaged handler', () => {
    it('should register app:isPackaged IPC listener', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockIpcMainOn).toHaveBeenCalledWith(
        'app:isPackaged',
        expect.any(Function),
      );
    });

    it('should return app.isPackaged value via event.returnValue', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainOn.mock.calls.find(
        ([channel]) => channel === 'app:isPackaged',
      )?.[1] as (event: { returnValue: boolean }) => void;

      expect(handler).toBeDefined();
      const event = { returnValue: false as boolean };
      handler(event);
      expect(event.returnValue).toBe(mockIsPackaged);
    });

    it('should return true when app is packaged', async () => {
      mockIsPackaged = true;
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainOn.mock.calls.find(
        ([channel]) => channel === 'app:isPackaged',
      )?.[1] as (event: { returnValue: boolean }) => void;

      const event = { returnValue: false as boolean };
      handler(event);
      expect(event.returnValue).toBe(true);
    });

    it('should return false when app is not packaged', async () => {
      mockIsPackaged = false;
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainOn.mock.calls.find(
        ([channel]) => channel === 'app:isPackaged',
      )?.[1] as (event: { returnValue: boolean }) => void;

      const event = { returnValue: true as boolean };
      handler(event);
      expect(event.returnValue).toBe(false);
    });
  });

  describe('dialog:saveFile IPC handler', () => {
    it('should register dialog:saveFile IPC handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        'dialog:saveFile',
        expect.any(Function),
      );
    });

    it('should call dialog.showSaveDialog with xlsx filter options', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'dialog:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      expect(handler).toBeDefined();
      mockDialogShowSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: 'C:/test/reporte.xlsx',
      });

      const options = {
        defaultPath: 'reporte.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      };
      const result = await handler({}, options);

      expect(mockDialogShowSaveDialog).toHaveBeenCalledWith(
        expect.anything(), // BrowserWindow reference
        expect.objectContaining({
          defaultPath: 'reporte.xlsx',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        }),
      );
      expect(result).toBe('C:/test/reporte.xlsx');
    });

    it('should return null when save dialog is cancelled', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'dialog:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      mockDialogShowSaveDialog.mockResolvedValueOnce({
        canceled: true,
        filePath: undefined,
      });

      const result = await handler({}, {
        defaultPath: 'reporte.xlsx',
      });

      expect(result).toBeNull();
    });

    it('should return null when filePath is undefined (not just cancelled)', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'dialog:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      mockDialogShowSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: undefined,
      });

      const result = await handler({}, { defaultPath: 'test.xlsx' });

      expect(result).toBeNull();
    });
  });

  describe('file:saveFile IPC handler', () => {
    beforeEach(() => {
      mockAppGetPath.mockReturnValue('/mock/Documents');
    });

    it('should register file:saveFile IPC handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        'file:saveFile',
        expect.any(Function),
      );
    });

    it('should create Tienda IPVE directory and write file', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'file:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      const buffer = new ArrayBuffer(8);
      const result = await handler({}, {
        fileName: 'ventas-2026-07.xlsx',
        buffer,
      });

      expect(mockAppGetPath).toHaveBeenCalledWith('documents');
      expect(mockFsMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('Tienda IPVE'),
        { recursive: true },
      );
      expect(mockFsWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('Tienda IPVE'),
        expect.any(Buffer),
      );
      // Also verify the specific filename is in the path
      expect(mockFsWriteFileSync.mock.calls[0][0]).toContain('ventas-2026-07.xlsx');
      expect(result).toEqual({
        success: true,
        filePath: expect.stringContaining('Tienda IPVE'),
      });
    });

    it('should return error when mkdirSync fails', async () => {
      mockFsMkdirSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'file:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      const result = await handler({}, {
        fileName: 'test.xlsx',
        buffer: new ArrayBuffer(4),
      });

      expect(result).toEqual({
        success: false,
        error: 'EACCES: permission denied',
      });
    });

    it('should return error when writeFileSync fails', async () => {
      mockFsWriteFileSync.mockImplementationOnce(() => {
        throw new Error('ENOSPC: no space left');
      });

      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockIpcMainHandle.mock.calls.find(
        ([channel]) => channel === 'file:saveFile',
      )?.[1] as (...args: unknown[]) => Promise<unknown>;

      const result = await handler({}, {
        fileName: 'test.xlsx',
        buffer: new ArrayBuffer(4),
      });

      expect(result).toEqual({
        success: false,
        error: 'ENOSPC: no space left',
      });
    });
  });

  describe('auto-updater', () => {
    it('should call autoUpdater.checkForUpdates on app ready', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockAutoUpdaterCheckForUpdates).toHaveBeenCalledTimes(1);
    });

    it('should register update-downloaded event handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockAutoUpdaterOn).toHaveBeenCalledWith(
        'update-downloaded',
        expect.any(Function),
      );
    });

    it('should register error event handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockAutoUpdaterOn).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });

    it('should not crash when checkForUpdates rejects', async () => {
      mockAutoUpdaterCheckForUpdates.mockRejectedValueOnce(
        new Error('Network error'),
      );
      vi.resetModules();
      await import('./main');
      await flush();

      // The catch handler should have been invoked without crashing
      expect(mockAutoUpdaterCheckForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMainWindow', () => {
    it('should create a BrowserWindow with correct options', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowCtor).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
          show: false,
          webPreferences: expect.objectContaining({
            contextIsolation: true,
            nodeIntegration: false,
            preload: expect.stringContaining('preload.js'),
          }),
        }),
      );
    });

    it('should load dev URL when app is not packaged', async () => {
      mockIsPackaged = false;
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('localhost:4200'),
      );
      expect(mockBrowserWindowInstance.loadFile).not.toHaveBeenCalled();
    });

    it('should load custom protocol URL when app is packaged', async () => {
      mockIsPackaged = true;
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('mipime-app://'),
      );
      expect(mockBrowserWindowInstance.loadFile).not.toHaveBeenCalled();
    });

    it('should auto-show window on ready-to-show', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.once).toHaveBeenCalledWith(
        'ready-to-show',
        expect.any(Function),
      );
      expect(mockBrowserWindowInstance.show).toHaveBeenCalledTimes(1);
    });

    it('should open dev tools when not packaged', async () => {
      mockIsPackaged = false;
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.webContents.openDevTools).toHaveBeenCalledTimes(1);
    });

    it('should NOT open dev tools when packaged', async () => {
      mockIsPackaged = true;
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.webContents.openDevTools).not.toHaveBeenCalled();
    });
  });

  describe('window constraints (R1)', () => {
    it('should create window at 1280x800 default size', async () => {
      mockLoadWindowState.mockReturnValue(null);
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1280,
          height: 800,
        }),
      );
    });

    it('should set minWidth 800 and minHeight 600', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          minWidth: 800,
          minHeight: 600,
        }),
      );
    });

    it('should set center: true when no saved state', async () => {
      mockLoadWindowState.mockReturnValue(null);
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          center: true,
        }),
      );
    });

    it('should NOT set center when saved state has position', async () => {
      mockLoadWindowState.mockReturnValue({ x: 100, y: 50, width: 1280, height: 800 });
      vi.resetModules();
      await import('./main');
      await flush();

      const callArgs = mockBrowserWindowCtor.mock.calls[0]?.[0];
      expect(callArgs.x).toBe(100);
      expect(callArgs.y).toBe(50);
      expect(callArgs).not.toHaveProperty('center');
    });
  });

  describe('window state persistence (R12)', () => {
    it('should load window state on creation when file exists', async () => {
      mockLoadWindowState.mockReturnValue({ x: 200, y: 100, width: 1024, height: 768 });
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockLoadWindowState).toHaveBeenCalledWith('/fake/userData');
      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 200,
          y: 100,
          width: 1024,
          height: 768,
        }),
      );
    });

    it('should fall back to defaults when no saved state', async () => {
      mockLoadWindowState.mockReturnValue(null);
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1280,
          height: 800,
          center: true,
        }),
      );
    });

    it('should register close handler to save window state', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const closeHandler = mockBrowserWindowInstance.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1] as () => void;

      expect(closeHandler).toBeDefined();
      closeHandler();

      expect(mockBrowserWindowGetBounds).toHaveBeenCalledTimes(1);
      expect(mockSaveWindowState).toHaveBeenCalledWith(
        '/fake/userData',
        { x: 100, y: 50, width: 1280, height: 800 },
      );
    });

    it('should still register closed handler for nulling mainWindow', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockBrowserWindowInstance.on).toHaveBeenCalledWith(
        'closed',
        expect.any(Function),
      );
    });
  });

  // Native menus removed by design — setApplicationMenu(null)
  // See main.ts line ~177

  describe('app lifecycle', () => {
    it('should call whenReady and create window', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockAppWhenReady).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindowCtor).toHaveBeenCalledTimes(1);
    });

    it('should register window-all-closed handler', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      expect(mockAppOn).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });

    it('should register activate handler (inside whenReady)', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      // activate handler is registered inside whenReady, which fires async
      expect(mockAppOn).toHaveBeenCalledWith('activate', expect.any(Function));
    });

    it('should quit app on window-all-closed (non-macOS)', async () => {
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockAppOn.mock.calls.find(
        ([event]) => event === 'window-all-closed',
      )?.[1] as () => void;

      expect(handler).toBeDefined();
      handler();

      expect(mockAppQuit).toHaveBeenCalledTimes(1);
    });

    it('should create a new window on activate when no windows exist', async () => {
      mockGetAllWindows.mockReturnValue([]);
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockAppOn.mock.calls.find(
        ([event]) => event === 'activate',
      )?.[1] as () => void;

      expect(handler).toBeDefined();
      handler();

      // Should have created a second window
      expect(mockBrowserWindowCtor).toHaveBeenCalledTimes(2);
    });

    it('should NOT create a new window on activate when windows exist', async () => {
      mockGetAllWindows.mockReturnValue(['existing-window']);
      vi.resetModules();
      await import('./main');
      await flush();

      const handler = mockAppOn.mock.calls.find(
        ([event]) => event === 'activate',
      )?.[1] as () => void;

      expect(handler).toBeDefined();
      handler();

      // Should still only have 1 window from startup
      expect(mockBrowserWindowCtor).toHaveBeenCalledTimes(1);
    });
  });
});
