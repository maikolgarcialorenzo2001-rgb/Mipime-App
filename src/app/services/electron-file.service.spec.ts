import { TestBed } from '@angular/core/testing';
import { ElectronFileService } from './electron-file.service';
import type { PalmarRecord } from '../models/palmar-jornada';

/** Fixture mínimo pero completo de una jornada Palmar (PR4, savePalmar/readPalmar). */
const PALMAR_RECORD_FIXTURE: PalmarRecord = {
  version: 1,
  id: 'palmar-2026-07-28',
  fecha: '2026-07-28',
  created_at: '2026-07-28T20:00:00.000Z',
  usuario: 'Maikol',
  productos: [
    {
      nombre: 'Agua 500ml',
      cantidad: 2,
      precio_venta: 50,
      precio_costo: 30,
      subtotal: 100,
      costo_subtotal: 60,
    },
  ],
  arqueo: [{ denominacion: 100, cantidad: 1, subtotal: 100 }],
  divisa: {
    usd: 0,
    eur: 0,
    tasa_usd: 0,
    tasa_eur: 0,
    usd_cup: 0,
    eur_cup: 0,
    divisa_cup: 0,
  },
  transferencia: 0,
  total_ventas: 100,
  total_arqueo: 100,
  total_recibido: 100,
  invertido: 60,
  ganancia: 40,
  diferencia: 0,
};

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
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickMock,
      } as unknown as HTMLAnchorElement);

      service.downloadBlob('base64data', 'test.xlsx');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Palmar: savePalmar (PR4) ─────────────────────────────

  describe('savePalmar', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it(
      'should call file:savePalmar with baseName/base64/json when electronAPI present',
      async () => {
        const invokeMock = vi
          .fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({
            ok: true,
            xlsxPath: 'C:/Users/Test/Documents/Tienda - App/Palmar/28-07-2026.xlsx',
            jsonPath: 'C:/Users/Test/Documents/Tienda - App/Palmar/28-07-2026.json',
          });
        window.electronAPI = { invoke: invokeMock } as unknown as ElectronAPI;

        const result = await service.savePalmar('28-07-2026', 'base64data', PALMAR_RECORD_FIXTURE);

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith('file:savePalmar', {
          baseName: '28-07-2026',
          base64: 'base64data',
          json: PALMAR_RECORD_FIXTURE,
        });
        expect(result).toEqual({
          ok: true,
          xlsxPath: 'C:/Users/Test/Documents/Tienda - App/Palmar/28-07-2026.xlsx',
          jsonPath: 'C:/Users/Test/Documents/Tienda - App/Palmar/28-07-2026.json',
        });
      },
    );

    it('should omit json key in reprint call (json undefined)', async () => {
      const invokeMock = vi
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ ok: true, xlsxPath: 'C:/Palmar/28-07-2026.xlsx' });
      window.electronAPI = { invoke: invokeMock } as unknown as ElectronAPI;

      const result = await service.savePalmar('28-07-2026', 'base64data');

      expect(invokeMock).toHaveBeenCalledTimes(1);
      const payload = invokeMock.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['baseName']).toBe('28-07-2026');
      expect(payload['base64']).toBe('base64data');
      expect(Object.prototype.hasOwnProperty.call(payload, 'json')).toBe(false);
      expect(result).toEqual({ ok: true, xlsxPath: 'C:/Palmar/28-07-2026.xlsx' });
    });

    it('should fall back to Blob download when electronAPI is not present', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const clickMock = vi.fn();
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickMock,
      } as unknown as HTMLAnchorElement);
      const revokeURL = vi.spyOn(URL, 'revokeObjectURL');

      vi.useFakeTimers();

      const result = await service.savePalmar('28-07-2026', 'SGVsbG8=');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createElement).toHaveBeenCalledWith('a');
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(revokeURL).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(revokeURL).toHaveBeenCalledTimes(1);
      expect(revokeURL).toHaveBeenCalledWith('blob:url');
      expect(result).toEqual({ ok: true });

      vi.useRealTimers();
    });
  });

  // ── Palmar: listPalmar (PR4) ─────────────────────────────

  describe('listPalmar', () => {
    it('should map records from {ok, records} when electronAPI present', async () => {
      const records = [
        {
          fileName: '28-07-2026.json',
          createdAt: '2026-07-28T20:00:00.000Z',
          totalVentas: 100,
          totalArqueo: 100,
          totalRecibido: 100,
          usuario: 'Maikol',
        },
        {
          fileName: '27-07-2026.json',
          createdAt: '2026-07-27T20:00:00.000Z',
          totalVentas: 50,
          totalArqueo: 50,
          totalRecibido: 50,
          usuario: null,
        },
      ];
      const invokeMock = vi
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ ok: true, records });
      window.electronAPI = { invoke: invokeMock } as unknown as ElectronAPI;

      const result = await service.listPalmar();

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('file:listPalmar');
      expect(result).toEqual(records);
    });

    it('should return [] when IPC result is !ok', async () => {
      const invokeMock = vi
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ ok: false, error: 'Palmar directory not found' });
      window.electronAPI = { invoke: invokeMock } as unknown as ElectronAPI;

      const result = await service.listPalmar();

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should return [] when electronAPI is not present', async () => {
      const result = await service.listPalmar();

      expect(result).toEqual([]);
    });
  });

  // ── Palmar: readPalmar (PR4) ─────────────────────────────

  describe('readPalmar', () => {
    it('should delegate with correct fileName', async () => {
      const invokeMock = vi
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ ok: true, record: PALMAR_RECORD_FIXTURE });
      window.electronAPI = { invoke: invokeMock } as unknown as ElectronAPI;

      const result = await service.readPalmar('28-07-2026.json');

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('file:readPalmar', { fileName: '28-07-2026.json' });
      expect(result).toEqual({ ok: true, record: PALMAR_RECORD_FIXTURE });
    });

    it('should reject when electronAPI is not present', async () => {
      await expect(service.readPalmar('28-07-2026.json')).rejects.toThrow(
        'readPalmar requires Electron (electronAPI not available)',
      );
    });
  });
});
