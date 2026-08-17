import { TestBed } from '@angular/core/testing';
import { ElectronFileService } from './electron-file.service';

describe('ElectronFileService', () => {
  let service: ElectronFileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ElectronFileService);
  });

  afterEach(() => {
    // Clean up electronAPI mock between tests
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  // ── isElectronPackaged ───────────────────────────────────

  describe('isElectronPackaged', () => {
    it('should return true when electronAPI.isPackaged === true', () => {
      window.electronAPI = { isPackaged: true } as unknown as ElectronAPI;

      expect(service.isElectronPackaged).toBe(true);
    });

    it('should return false when electronAPI is undefined', () => {
      expect(service.isElectronPackaged).toBe(false);
    });

    it('should return false when electronAPI.isPackaged is false', () => {
      window.electronAPI = { isPackaged: false } as unknown as ElectronAPI;

      expect(service.isElectronPackaged).toBe(false);
    });
  });

  // ── saveIndividual ───────────────────────────────────────

  describe('saveIndividual', () => {
    it('should call IPC with correct file path for a jornada', async () => {
      const invokeMock = vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ success: true });
      window.electronAPI = { isPackaged: true, invoke: invokeMock } as unknown as ElectronAPI;

      await service.saveIndividual('base64data', { fecha: '2026-07-28', id: 123 });

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('file:saveFile', {
        base64: 'base64data',
        filePath: '2026/07 - Julio/jornada_2026-07-28_123.xlsx',
      });
    });

    it('should throw when IPC returns success: false', async () => {
      const invokeMock = vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        success: false,
        error: 'Disk full',
      });
      window.electronAPI = { isPackaged: true, invoke: invokeMock } as unknown as ElectronAPI;

      await expect(
        service.saveIndividual('base64data', { fecha: '2026-07-28', id: 123 }),
      ).rejects.toThrow('Disk full');
    });

    it('should use Blob fallback when not in Electron', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const clickMock = vi.fn();
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickMock,
      } as unknown as HTMLAnchorElement);
      const revokeURL = vi.spyOn(URL, 'revokeObjectURL');

      vi.useFakeTimers();

      await service.saveIndividual('SGVsbG8=', { fecha: '2026-07-28', id: 1 });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createElement).toHaveBeenCalledWith('a');
      expect(clickMock).toHaveBeenCalledTimes(1);
      // BACKLOG-5: el revoke NO es síncrono — se difiere al tick siguiente.
      expect(revokeURL).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(revokeURL).toHaveBeenCalledTimes(1);
      expect(revokeURL).toHaveBeenCalledWith('blob:url');

      vi.useRealTimers();
    });
  });

  // ── saveMonthly ──────────────────────────────────────────

  describe('saveMonthly', () => {
    it('should call IPC with correct monthly path', async () => {
      const invokeMock = vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ success: true });
      window.electronAPI = { isPackaged: true, invoke: invokeMock } as unknown as ElectronAPI;

      await service.saveMonthly('base64mes', 2026, 6); // Julio (0-indexed)

      expect(invokeMock).toHaveBeenCalledWith('file:saveFile', {
        base64: 'base64mes',
        filePath: 'Jornada Completa Mes Julio.xlsx',
      });
    });
  });

  // ── saveRange ────────────────────────────────────────────

  describe('saveRange', () => {
    it('should call IPC with correct range path', async () => {
      const invokeMock = vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ success: true });
      window.electronAPI = { isPackaged: true, invoke: invokeMock } as unknown as ElectronAPI;

      await service.saveRange('base64rango', '2026-07-01', '2026-07-28');

      expect(invokeMock).toHaveBeenCalledWith('file:saveFile', {
        base64: 'base64rango',
        filePath: 'Jornada completa 01/07 - 2026 -- 28/07 - 2026.xlsx',
      });
    });
  });

  // ── downloadBlob ──────────────────────────────────────────

  describe('downloadBlob', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should skip Blob download when isElectronPackaged=true (save ya fue manejado por JornadaService)', () => {
      window.electronAPI = { isPackaged: true } as unknown as ElectronAPI;

      const createObjectURL = vi.spyOn(URL, 'createObjectURL');

      service.downloadBlob('base64data', 'test.xlsx');

      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('should do Blob fallback when isElectronPackaged=false', () => {
      window.electronAPI = { isPackaged: false } as unknown as ElectronAPI;

      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const clickMock = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickMock,
      } as unknown as HTMLAnchorElement);

      service.downloadBlob('base64data', 'test.xlsx');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickMock).toHaveBeenCalledTimes(1);
    });
  });
});
