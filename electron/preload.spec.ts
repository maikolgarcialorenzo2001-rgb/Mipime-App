import { describe, it, expect, vi, beforeEach } from 'vitest';

type InvokeFn = (channel: string, ...args: unknown[]) => Promise<unknown>;
type VoidFn = (channel: string, ...args: unknown[]) => void;

// Lift mock factories into hoisted scope so vi.mock can reference them
const mockContextBridgeExpose = vi.hoisted(() => vi.fn());
const mockIpcSend = vi.hoisted(() => vi.fn());
const mockIpcSendSync = vi.hoisted(() => vi.fn(() => false));
const mockIpcInvoke = vi.hoisted(() => vi.fn());
const mockIpcOn = vi.hoisted(() => vi.fn());
const mockIpcRemoveAll = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockContextBridgeExpose,
  },
  ipcRenderer: {
    send: mockIpcSend,
    sendSync: mockIpcSendSync,
    invoke: mockIpcInvoke,
    on: mockIpcOn,
    removeAllListeners: mockIpcRemoveAll,
  },
}));

/**
 * Helper: dynamically import preload and return the exposed API object.
 * Must call vi.resetModules() first so the module-level code re-executes.
 */
async function getPreloadApi(): Promise<Record<string, unknown>> {
  vi.resetModules();
  await import('./preload');
  const api = mockContextBridgeExpose.mock.calls[0]?.[1] as Record<string, unknown>;
  return api;
}

describe('preload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose electronAPI via contextBridge with expected structure', async () => {
    const api = await getPreloadApi();

    expect(mockContextBridgeExpose).toHaveBeenCalledTimes(1);
    expect(mockContextBridgeExpose).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        platform: expect.any(String),
        isPackaged: expect.any(Boolean),
        send: expect.any(Function),
        invoke: expect.any(Function),
        on: expect.any(Function),
        removeAllListeners: expect.any(Function),
      }),
    );
    expect(api.platform).toBeDefined();
    expect(api.isPackaged).toBeDefined();
    expect(api.send).toBeDefined();
    expect(api.invoke).toBeDefined();
    expect(api.on).toBeDefined();
    expect(api.removeAllListeners).toBeDefined();
  });

  it('should expose platform as a non-empty string', async () => {
    const api = await getPreloadApi();

    expect(typeof api.platform).toBe('string');
    expect((api.platform as string).length).toBeGreaterThan(0);
  });

  describe('isPackaged', () => {
    it('should query sendSync at module init and expose the result', async () => {
      mockIpcSendSync.mockReturnValueOnce(true);
      const api = await getPreloadApi();

      expect(mockIpcSendSync).toHaveBeenCalledWith('app:isPackaged');
      expect(api.isPackaged).toBe(true);
    });

    it('should be false when running in development mode', async () => {
      mockIpcSendSync.mockReturnValueOnce(false);
      const api = await getPreloadApi();

      expect(api.isPackaged).toBe(false);
    });

    it('should call sendSync exactly once per module load', async () => {
      await getPreloadApi();

      expect(mockIpcSendSync).toHaveBeenCalledTimes(1);
    });
  });

  it('should allow send on valid channel app:ready', async () => {
    const api = await getPreloadApi();

    (api.send as VoidFn)('app:ready', { data: 'test' });

    expect(mockIpcSend).toHaveBeenCalledWith('app:ready', { data: 'test' });
  });

  it('should reject send on invalid channel', async () => {
    const api = await getPreloadApi();

    (api.send as VoidFn)('invalid:channel', 'payload');

    expect(mockIpcSend).not.toHaveBeenCalled();
  });

  it('should NOT allow send on db:* channels (invoke-only, S5)', async () => {
    const api = await getPreloadApi();

    (api.send as VoidFn)('db:initialize', 'payload');
    (api.send as VoidFn)('db:sql', { query: 'SELECT 1' });

    expect(mockIpcSend).not.toHaveBeenCalled();
  });

  describe('invoke channels', () => {
    it('should allow invoke on app:getVersion channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('app:getVersion');

      expect(mockIpcInvoke).toHaveBeenCalledWith('app:getVersion');
    });

    it('should allow invoke on app:getPlatform channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('app:getPlatform');

      expect(mockIpcInvoke).toHaveBeenCalledWith('app:getPlatform');
    });

    it('should allow invoke on file:saveFile channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('file:saveFile', {
        base64: 'SGVsbG8gV29ybGQ=',
        filePath: '2026/07 - Julio/jornada_2026-07-28_123.xlsx',
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('file:saveFile', {
        base64: 'SGVsbG8gV29ybGQ=',
        filePath: '2026/07 - Julio/jornada_2026-07-28_123.xlsx',
      });
    });

    it('should allow invoke on dialog:saveFile channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('dialog:saveFile', {
        defaultPath: 'reporte.xlsx',
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('dialog:saveFile', {
        defaultPath: 'reporte.xlsx',
      });
    });

    it('should allow invoke on db:initialize channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('db:initialize');

      expect(mockIpcInvoke).toHaveBeenCalledWith('db:initialize');
    });

    it('should allow invoke on db:sql channel with query and params', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('db:sql', {
        query: 'SELECT ? AS v',
        params: [42],
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('db:sql', {
        query: 'SELECT ? AS v',
        params: [42],
      });
    });

    it('should allow invoke on db:import channel with file payload', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('db:import', { file: null });

      expect(mockIpcInvoke).toHaveBeenCalledWith('db:import', { file: null });
    });

    it('should allow invoke on db:backupNow channel with trigger', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('db:backupNow', {
        trigger: 'jornada-close',
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('db:backupNow', {
        trigger: 'jornada-close',
      });
    });

    it('should allow invoke on db:export channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as InvokeFn)('db:export');

      expect(mockIpcInvoke).toHaveBeenCalledWith('db:export');
    });

    it('should reject invoke on unknown channels', async () => {
      const api = await getPreloadApi();

      await expect((api.invoke as InvokeFn)('any:channel')).rejects.toThrow('Invalid channel');
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });

    it('should reject invoke on send-only channel app:ready', async () => {
      const api = await getPreloadApi();

      await expect((api.invoke as InvokeFn)('app:ready')).rejects.toThrow('Invalid channel');
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });
  });

  it('should not register on listener for invalid channels', async () => {
    const api = await getPreloadApi();
    const callback = vi.fn();

    (api.on as VoidFn)('any:channel', callback);

    expect(mockIpcOn).not.toHaveBeenCalled();
  });

  it('should NOT register on listeners for db:* channels (invoke-only, S5)', async () => {
    const api = await getPreloadApi();
    const callback = vi.fn();

    (api.on as VoidFn)('db:sql', callback);
    (api.on as VoidFn)('db:backupNow', callback);

    expect(mockIpcOn).not.toHaveBeenCalled();
  });

  it('should delegate removeAllListeners to ipcRenderer', async () => {
    const api = await getPreloadApi();

    (api.removeAllListeners as VoidFn)('app:ready');

    expect(mockIpcRemoveAll).toHaveBeenCalledWith('app:ready');
  });
});
