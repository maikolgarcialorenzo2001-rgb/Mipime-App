import * as fs from 'fs';
import * as path from 'path';

export const WINDOW_STATE_FILENAME = 'window-state.json';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

/**
 * Parse a JSON string into a valid WindowState, returning null on any failure.
 * Pure function — no side effects, no I/O.
 */
export function parseWindowState(raw: string): WindowState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return null;
    }
    return {
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return null;
  }
}

/**
 * Return the default window state (1280x800, no position).
 * Used when no saved state exists or saved state is corrupted.
 */
export function getDefaultWindowState(): WindowState {
  return { width: 1280, height: 800 };
}

/**
 * Read and parse window state from userData/window-state.json.
 * Returns null if the file does not exist, cannot be read, or contains invalid JSON.
 */
export function loadWindowState(userDataPath: string): WindowState | null {
  const statePath = path.join(userDataPath, WINDOW_STATE_FILENAME);
  try {
    const data = fs.readFileSync(statePath, 'utf-8');
    return parseWindowState(data);
  } catch {
    return null;
  }
}

/**
 * Save window bounds to userData/window-state.json.
 * Silently fails on write errors — window close must not crash.
 */
export function saveWindowState(
  userDataPath: string,
  bounds: { x?: number; y?: number; width: number; height: number },
): void {
  const statePath = path.join(userDataPath, WINDOW_STATE_FILENAME);
  try {
    const data = JSON.stringify(bounds);
    fs.writeFileSync(statePath, data, 'utf-8');
  } catch {
    // silently fail
  }
}
