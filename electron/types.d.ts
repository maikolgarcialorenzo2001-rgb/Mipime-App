/** API expuesta por el preload script al renderer vía contextBridge. */
interface ElectronAPI {
  readonly platform: string;
  /** true when running in a packaged Electron app (installed via exe/msi). */
  readonly isPackaged: boolean;
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): void;
  removeAllListeners(channel: string): void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
