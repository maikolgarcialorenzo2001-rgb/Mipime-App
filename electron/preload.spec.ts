import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lift mock factories into hoisted scope so vi.mock can reference them
const mockContextBridgeExpose = vi.hoisted(() => vi.fn());
const mockIpcSend = vi.hoisted(() => vi.fn());
const mockIpcInvoke = vi.hoisted(() => vi.fn());
const mockIpcOn = vi.hoisted(() => vi.fn());
const mockIpcRemoveAll = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockContextBridgeExpose,
  },
  ipcRenderer: {
    send: mockIpcSend,
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
        send: expect.any(Function),
        invoke: expect.any(Function),
        on: expect.any(Function),
        removeAllListeners: expect.any(Function),
      }),
    );
    expect(api.platform).toBeDefined();
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

  it('should allow send on valid channel app:ready', async () => {
    const api = await getPreloadApi();

    (api.send as Function)('app:ready', { data: 'test' });

    expect(mockIpcSend).toHaveBeenCalledWith('app:ready', { data: 'test' });
  });

  it('should reject send on invalid channel', async () => {
    const api = await getPreloadApi();

    (api.send as Function)('invalid:channel', 'payload');

    expect(mockIpcSend).not.toHaveBeenCalled();
  });

  describe('invoke channels', () => {
    it('should allow invoke on app:getVersion channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as Function)('app:getVersion');

      expect(mockIpcInvoke).toHaveBeenCalledWith('app:getVersion');
    });

    it('should allow invoke on app:getPlatform channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as Function)('app:getPlatform');

      expect(mockIpcInvoke).toHaveBeenCalledWith('app:getPlatform');
    });

    it('should allow invoke on dialog:saveFile channel', async () => {
      const api = await getPreloadApi();

      await (api.invoke as Function)('dialog:saveFile', {
        defaultPath: 'reporte.xlsx',
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('dialog:saveFile', {
        defaultPath: 'reporte.xlsx',
      });
    });

    it('should reject invoke on unknown channels', async () => {
      const api = await getPreloadApi();

      await expect((api.invoke as Function)('any:channel')).rejects.toThrow('Invalid channel');
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });

    it('should reject invoke on send-only channel app:ready', async () => {
      const api = await getPreloadApi();

      await expect((api.invoke as Function)('app:ready')).rejects.toThrow('Invalid channel');
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });
  });

  it('should not register on listener for invalid channels', async () => {
    const api = await getPreloadApi();
    const callback = vi.fn();

    (api.on as Function)('any:channel', callback);

    expect(mockIpcOn).not.toHaveBeenCalled();
  });

  it('should delegate removeAllListeners to ipcRenderer', async () => {
    const api = await getPreloadApi();

    (api.removeAllListeners as Function)('app:ready');

    expect(mockIpcRemoveAll).toHaveBeenCalledWith('app:ready');
  });
});
