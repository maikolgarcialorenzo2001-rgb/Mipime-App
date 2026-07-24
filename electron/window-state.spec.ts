import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// ---- mock fs ----
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: vi.fn(),
}));

describe('window-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseWindowState', () => {
    it('should parse valid window state JSON', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('{"x":100,"y":50,"width":1280,"height":800}');
      expect(result).toEqual({ x: 100, y: 50, width: 1280, height: 800 });
    });

    it('should return null for invalid JSON', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('not-json');
      expect(result).toBeNull();
    });

    it('should return null for null input', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('null');
      expect(result).toBeNull();
    });

    it('should return null when width is missing', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('{"x":100,"y":50,"height":800}');
      expect(result).toBeNull();
    });

    it('should return null when height is missing', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('{"x":100,"y":50,"width":1280}');
      expect(result).toBeNull();
    });

    it('should allow missing x and y', async () => {
      const { parseWindowState } = await import('./window-state');
      const result = parseWindowState('{"width":1280,"height":800}');
      expect(result).toEqual({ width: 1280, height: 800 });
    });
  });

  describe('getDefaultWindowState', () => {
    it('should return 1280x800 with no position', async () => {
      const { getDefaultWindowState } = await import('./window-state');
      const state = getDefaultWindowState();
      expect(state).toEqual({ width: 1280, height: 800 });
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });
  });

  describe('loadWindowState', () => {
    it('should load and parse window state from userData path', async () => {
      mockReadFileSync.mockReturnValue('{"x":100,"y":50,"width":1280,"height":800}');

      const { loadWindowState } = await import('./window-state');
      const result = loadWindowState('/fake/userData');

      expect(mockReadFileSync).toHaveBeenCalledWith(
        path.join('/fake/userData', 'window-state.json'),
        'utf-8',
      );
      expect(result).toEqual({ x: 100, y: 50, width: 1280, height: 800 });
    });

    it('should return null when file read fails', async () => {
      mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const { loadWindowState } = await import('./window-state');
      const result = loadWindowState('/fake/userData');

      expect(result).toBeNull();
    });

    it('should return null when file contains invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('not-json');

      const { loadWindowState } = await import('./window-state');
      const result = loadWindowState('/fake/userData');

      expect(result).toBeNull();
    });
  });

  describe('saveWindowState', () => {
    it('should write window state to userData path', async () => {
      const { saveWindowState } = await import('./window-state');
      saveWindowState('/fake/userData', { x: 100, y: 50, width: 1280, height: 800 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join('/fake/userData', 'window-state.json'),
        '{"x":100,"y":50,"width":1280,"height":800}',
        'utf-8',
      );
    });

    it('should write state without x and y when not provided', async () => {
      const { saveWindowState } = await import('./window-state');
      saveWindowState('/fake/userData', { width: 1280, height: 800 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join('/fake/userData', 'window-state.json'),
        '{"width":1280,"height":800}',
        'utf-8',
      );
    });

    it('should not throw when write fails', async () => {
      mockWriteFileSync.mockImplementation(() => { throw new Error('EPERM'); });

      const { saveWindowState } = await import('./window-state');
      expect(() =>
        saveWindowState('/fake/userData', { width: 1280, height: 800 }),
      ).not.toThrow();
    });
  });
});
