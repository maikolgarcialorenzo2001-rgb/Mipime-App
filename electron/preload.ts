import { contextBridge, ipcRenderer } from 'electron';

/**
 * Valid IPC send channels the renderer is allowed to use.
 * Extended in subsequent PRs as new features are added.
 */
const VALID_SEND_CHANNELS: readonly string[] = ['app:ready'];

/**
 * Valid IPC invoke channels the renderer is allowed to use.
 */
const VALID_INVOKE_CHANNELS: readonly string[] = [
  'app:getVersion',
  'app:getPlatform',
  'dialog:saveFile',
  'file:saveFile',
];

/**
 * Valid IPC on (receive) channels the renderer is allowed to listen to.
 */
const VALID_ON_CHANNELS: readonly string[] = [];

/**
 * Synchronously query packaging status. Called once at module init so
 * `isPackaged` is available as a static property on the exposed API.
 */
const isPackaged = ipcRenderer.sendSync('app:isPackaged') as boolean;

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isPackaged,

  /** Send a one-way message to the main process on a validated channel. */
  send: (channel: string, ...args: unknown[]) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  /** Invoke an IPC handler in the main process and return the result. */
  invoke: (channel: string, ...args: unknown[]) => {
    if (VALID_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

  /** Listen for messages from the main process on a validated channel. */
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (VALID_ON_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  /** Remove all listeners for a channel. */
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
