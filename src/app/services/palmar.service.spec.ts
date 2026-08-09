import { TestBed } from '@angular/core/testing';
import { PalmarService } from './palmar.service';
import { ElectronFileService } from './electron-file.service';
import { ExcelService } from './excel.service';
import { DATABASE, type Database } from './database';
import type {
  PalmarHistoryEntry,
  PalmarRecord,
  PalmarSemanaResumen,
} from '../models/palmar-jornada';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Semana de prueba: lunes 2026-07-27 → domingo 2026-08-02 (2026-07-28 es martes).

const DIVISA_BASE = {
  usd: 0,
  eur: 0,
  tasa_usd: 0,
  tasa_eur: 0,
  usd_cup: 0,
  eur_cup: 0,
  divisa_cup: 0,
};

function makeRecord(
  overrides: Partial<PalmarRecord> & { id: string; fecha: string },
): PalmarRecord {
  const { id, fecha, ...rest } = overrides;
  return {
    version: 1,
    id,
    fecha,
    created_at: `${fecha}T20:00:00.000Z`,
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
    divisa: { ...DIVISA_BASE },
    transferencia: 0,
    total_ventas: 0,
    total_arqueo: 0,
    total_recibido: 0,
    invertido: 0,
    ganancia: 0,
    diferencia: 0,
    ...rest,
  };
}

/** Martes 2026-07-28 — DENTRO de la semana (lunes 27 → domingo 02). */
const RECORD_A: PalmarRecord = makeRecord({
  id: 'palmar-2026-07-28',
  fecha: '2026-07-28',
  total_ventas: 1150,
  total_arqueo: 900,
  total_recibido: 1000,
  divisa: { ...DIVISA_BASE, divisa_cup: 100 },
  transferencia: 50,
  invertido: 400,
  ganancia: 600,
  diferencia: -50,
});

/** Jueves 2026-07-30 — DENTRO de la semana. */
const RECORD_B: PalmarRecord = makeRecord({
  id: 'palmar-2026-07-30',
  fecha: '2026-07-30',
  total_ventas: 2300,
  total_arqueo: 1800,
  total_recibido: 2000,
  divisa: { ...DIVISA_BASE, divisa_cup: 200 },
  transferencia: 100,
  invertido: 800,
  ganancia: 1200,
  diferencia: 100,
});

/** Martes 2026-08-04 — FUERA de la semana (siguiente semana: lunes 03 → domingo 09). */
const RECORD_C: PalmarRecord = makeRecord({
  id: 'palmar-2026-08-04',
  fecha: '2026-08-04',
  total_ventas: 3300,
  total_arqueo: 2700,
  total_recibido: 3000,
  divisa: { ...DIVISA_BASE, divisa_cup: 300 },
  transferencia: 150,
  invertido: 1200,
  ganancia: 1800,
  diferencia: 0,
});

/** Segunda guardada del mismo día 2026-07-28 (archivo con sufijo -2). */
const RECORD_D: PalmarRecord = makeRecord({
  id: 'palmar-2026-07-28-2',
  fecha: '2026-07-28',
  total_ventas: 550,
  total_arqueo: 400,
  total_recibido: 500,
  divisa: { ...DIVISA_BASE, divisa_cup: 100 },
  transferencia: 0,
  invertido: 200,
  ganancia: 300,
  diferencia: 0,
});

function entry(fileName: string, rec: PalmarRecord): PalmarHistoryEntry {
  return {
    fileName,
    createdAt: rec.created_at,
    totalVentas: rec.total_ventas,
    totalArqueo: rec.total_arqueo,
    totalRecibido: rec.total_recibido,
    usuario: rec.usuario,
  };
}

const ENTRY_A = entry('28-07-2026.json', RECORD_A);
const ENTRY_B = entry('30-07-2026.json', RECORD_B);
const ENTRY_C = entry('04-08-2026.json', RECORD_C);
const ENTRY_D = entry('28-07-2026-2.json', RECORD_D);

const recordsByFile: Record<string, PalmarRecord> = {
  '28-07-2026.json': RECORD_A,
  '30-07-2026.json': RECORD_B,
  '04-08-2026.json': RECORD_C,
  '28-07-2026-2.json': RECORD_D,
};

// ── Suite ───────────────────────────────────────────────────────────────────

describe('PalmarService', () => {
  let service: PalmarService;
  let mockElectronFile: {
    listPalmar: ReturnType<typeof vi.fn>;
    readPalmar: ReturnType<typeof vi.fn>;
    savePalmar: ReturnType<typeof vi.fn>;
  };
  let mockExcel: { generarExcelPalmar: ReturnType<typeof vi.fn> };
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    mockElectronFile = {
      listPalmar: vi.fn().mockResolvedValue([]),
      readPalmar: vi.fn().mockResolvedValue({ ok: true, record: RECORD_A }),
      savePalmar: vi.fn().mockResolvedValue({ ok: true }),
    };

    mockExcel = {
      generarExcelPalmar: vi.fn().mockReturnValue('mock-excel-base64'),
    };

    TestBed.configureTestingModule({
      providers: [
        PalmarService,
        { provide: DATABASE, useValue: mockDb },
        { provide: ElectronFileService, useValue: mockElectronFile },
        { provide: ExcelService, useValue: mockExcel },
      ],
    });
    service = TestBed.inject(PalmarService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── cargarHistorial ────────────────────────────────────────────────────────

  describe('cargarHistorial', () => {
    it('delega en listPalmar y devuelve las entradas tal cual (main ya ordena desc)', async () => {
      const entries = [ENTRY_B, ENTRY_A];
      mockElectronFile.listPalmar.mockResolvedValue(entries);

      const result = await service.cargarHistorial();

      expect(mockElectronFile.listPalmar).toHaveBeenCalledTimes(1);
      expect(result).toEqual(entries);
    });

    it('devuelve [] cuando listPalmar no encuentra archivos', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([]);

      const result = await service.cargarHistorial();

      expect(result).toEqual([]);
    });
  });

  // ── verDetalle ─────────────────────────────────────────────────────────────

  describe('verDetalle', () => {
    it('desenvuelve el record del envelope {ok, record}', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: true, record: RECORD_A });

      const result = await service.verDetalle('28-07-2026.json');

      expect(mockElectronFile.readPalmar).toHaveBeenCalledWith('28-07-2026.json');
      expect(result).toEqual(RECORD_A);
    });

    it('rechaza cuando el IPC devuelve ok:false con error', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: false, error: 'file not found' });

      await expect(service.verDetalle('28-07-2026.json')).rejects.toThrow('file not found');
    });

    it('rechaza cuando ok:true pero no trae record', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: true });

      await expect(service.verDetalle('28-07-2026.json')).rejects.toThrow(
        'No se pudo leer la jornada Palmar: 28-07-2026.json',
      );
    });
  });

  // ── volverAImprimir ────────────────────────────────────────────────────────

  describe('volverAImprimir', () => {
    const resumenFixture: PalmarSemanaResumen = {
      semanaInicio: '2026-07-27',
      semanaFin: '2026-08-02',
      totalRecibido: 3000,
      efectivo: 2700,
      divisaCup: 300,
      transferencia: 150,
      invertido: 1200,
      ganancia: 1800,
    };

    it('relee el registro, recalcula el resumen de su semana, regenera Excel y guarda SIN json', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: true, record: RECORD_A });
      mockElectronFile.savePalmar.mockResolvedValue({
        ok: true,
        xlsxPath: 'C:/Palmar/28-07-2026-2.xlsx',
      });
      const spyResumen = vi
        .spyOn(service, 'cargarResumenSemanal')
        .mockResolvedValue(resumenFixture);

      const result = await service.volverAImprimir('28-07-2026.json');

      expect(mockElectronFile.readPalmar).toHaveBeenCalledWith('28-07-2026.json');
      expect(spyResumen).toHaveBeenCalledWith('2026-07-28'); // record.fecha → semana de esa jornada
      expect(mockExcel.generarExcelPalmar).toHaveBeenCalledWith(RECORD_A, resumenFixture);
      // baseName dd-mm-yyyy de la fecha del registro (el main agrega el sufijo -2/-3):
      expect(mockElectronFile.savePalmar).toHaveBeenCalledWith('28-07-2026', 'mock-excel-base64');
      // reprint NUNCA incluye el json: la llamada tiene exactamente 2 argumentos
      expect(mockElectronFile.savePalmar.mock.calls[0]).toHaveLength(2);
      expect(result).toEqual({ ok: true, xlsxPath: 'C:/Palmar/28-07-2026-2.xlsx' });
    });

    it('deriva el baseName de la fecha del registro (no hardcodeado)', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: true, record: RECORD_B });
      vi.spyOn(service, 'cargarResumenSemanal').mockResolvedValue(resumenFixture);

      await service.volverAImprimir('30-07-2026.json');

      expect(mockElectronFile.savePalmar).toHaveBeenCalledWith('30-07-2026', 'mock-excel-base64');
    });

    it('propaga el error si el registro no se puede leer y no guarda nada', async () => {
      mockElectronFile.readPalmar.mockResolvedValue({ ok: false, error: 'boom' });

      await expect(service.volverAImprimir('28-07-2026.json')).rejects.toThrow('boom');
      expect(mockElectronFile.savePalmar).not.toHaveBeenCalled();
    });
  });

  // ── cargarResumenSemanal ───────────────────────────────────────────────────

  describe('cargarResumenSemanal', () => {
    it('agrega solo los registros de la semana (lunes a domingo) y excluye los de afuera', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([ENTRY_C, ENTRY_B, ENTRY_A]);
      mockElectronFile.readPalmar.mockImplementation(async (fileName: string) => ({
        ok: true,
        record: recordsByFile[fileName],
      }));

      const result = await service.cargarResumenSemanal('2026-07-28');

      expect(result).toEqual({
        semanaInicio: '2026-07-27',
        semanaFin: '2026-08-02',
        totalRecibido: 3000,
        efectivo: 2700, // suma de total_arqueo de los registros de la semana
        divisaCup: 300,
        transferencia: 150,
        invertido: 1200,
        ganancia: 1800,
      });
      // Solo leyó los 2 registros DENTRO de la semana (no el 04-08):
      expect(mockElectronFile.readPalmar).toHaveBeenCalledTimes(2);
    });

    it('un domingo cae en la MISMA semana que el martes (la semana arranca en lunes)', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([ENTRY_B, ENTRY_A]);
      mockElectronFile.readPalmar.mockImplementation(async (fileName: string) => ({
        ok: true,
        record: recordsByFile[fileName],
      }));

      const result = await service.cargarResumenSemanal('2026-08-02'); // domingo

      expect(result.semanaInicio).toBe('2026-07-27');
      expect(result.semanaFin).toBe('2026-08-02');
      expect(result.totalRecibido).toBe(3000);
      expect(result.efectivo).toBe(2700);
    });

    it('archivos con sufijo -2/-3 se agregan como la misma fecha', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([ENTRY_D, ENTRY_B, ENTRY_A]);
      mockElectronFile.readPalmar.mockImplementation(async (fileName: string) => ({
        ok: true,
        record: recordsByFile[fileName],
      }));

      const result = await service.cargarResumenSemanal('2026-07-28');

      expect(result.totalRecibido).toBe(3500);
      expect(result.efectivo).toBe(3100);
      expect(result.divisaCup).toBe(400);
      expect(result.invertido).toBe(1400);
      expect(result.ganancia).toBe(2100);
      expect(mockElectronFile.readPalmar).toHaveBeenCalledTimes(3);
    });

    it('semana sin registros devuelve ceros y no lee ningún archivo', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([ENTRY_C]); // 04-08, fuera de la semana

      const result = await service.cargarResumenSemanal('2026-07-28');

      expect(result).toEqual({
        semanaInicio: '2026-07-27',
        semanaFin: '2026-08-02',
        totalRecibido: 0,
        efectivo: 0,
        divisaCup: 0,
        transferencia: 0,
        invertido: 0,
        ganancia: 0,
      });
      expect(mockElectronFile.readPalmar).not.toHaveBeenCalled();
    });
  });

  // ── ZERO DB WRITES (DoD PR6) ───────────────────────────────────────────────

  describe('ZERO DB WRITES (DoD PR6)', () => {
    it('ejecuta todas las operaciones sin emitir NINGUNA sentencia SQL', async () => {
      mockElectronFile.listPalmar.mockResolvedValue([ENTRY_B, ENTRY_A]);
      mockElectronFile.readPalmar.mockImplementation(async (fileName: string) => ({
        ok: true,
        record: recordsByFile[fileName],
      }));
      mockElectronFile.savePalmar.mockResolvedValue({
        ok: true,
        xlsxPath: 'C:/Palmar/28-07-2026-2.xlsx',
      });

      await service.cargarHistorial();
      await service.verDetalle('28-07-2026.json');
      await service.volverAImprimir('28-07-2026.json');
      await service.cargarResumenSemanal('2026-07-28');

      // PalmarService vive SOLO del filesystem (IPC) + ExcelService: cero
      // llamadas a sql → cero INSERT/UPDATE/DELETE (y cero lecturas).
      expect(mockDb.sql).not.toHaveBeenCalled();
    });
  });
});
