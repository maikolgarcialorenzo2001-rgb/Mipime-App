import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { JornadaService } from './jornada.service';
import { ExcelService } from './excel.service';
import { DATABASE, type Database } from './database';
import type { Jornada } from '../models';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-02',
  hora_apertura: '08:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_gastos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-02T08:00:00Z',
  updated_at: '2026-06-02T08:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornada,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 7200,
  user_cierre_id: 1,
};

const mockExcelBase64 = 'UEsDBBQAAAAIA...mock-base64...';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('JornadaService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        JornadaService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: ExcelService,
          useValue: { generarExcelJornada: vi.fn().mockReturnValue(mockExcelBase64) },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerAbierta', () => {
    it('debería retornar null cuando no hay jornada abierta', async () => {
      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toBeNull();
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String), 'abierta'],
      );
    });

    it('debería retornar la jornada abierta cuando existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toEqual(mockJornada);
      expect(resultado!.estado).toBe('abierta');
    });

    it('debería lanzar error si la DB falla', async () => {
      vi.mocked(mockDb.sql).mockRejectedValue(new Error('Connection error'));

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.obtenerAbierta()),
      ).rejects.toThrow('Connection error');
    });
  });

  describe('abrir', () => {
    it('debería crear una nueva jornada con monto inicial', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.abrir(5000));

      expect(resultado.monto_inicial).toBe(5000);
      expect(resultado.estado).toBe('abierta');
    });
  });

  describe('cerrar', () => {
    it('debería cerrar la jornada generando Excel (admin)', async () => {
      vi.mocked(mockDb.sql)
        // 1. admin check
        .mockResolvedValueOnce([{ rol: 'admin' }])
        // 2. ventas
        .mockResolvedValueOnce([])
        // 3. movimientos
        .mockResolvedValueOnce([])
        // 4. get jornada
        .mockResolvedValueOnce([mockJornada])
        // 5. insert reporte
        .mockResolvedValueOnce([])
        // 6. update jornada
        .mockResolvedValueOnce([mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 7200, 1));

      expect(resultado.estado).toBe('cerrada');
      expect(resultado.saldo_real).toBe(7200);
      expect(resultado.user_cierre_id).toBe(1);
    });

    it('debería rechazar si el usuario no es admin', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([{ rol: 'trabajador' }]);

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.cerrar(1, 7200, 2)),
      ).rejects.toThrow('Solo administradores pueden cerrar la jornada');
    });

    it('debería rechazar si el usuario no existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.cerrar(1, 7200, 999)),
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('debería generar y almacenar Excel en jornada_reportes', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const mockMovimientos: Movimiento[] = [
        { id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'Coca', monto: 1500, created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        // 1. admin check
        .mockResolvedValueOnce([{ rol: 'admin' }])
        // 2. ventas
        .mockResolvedValueOnce(mockVentas)
        // 3. detalles (ventaIds = [10])
        .mockResolvedValueOnce(mockDetalles)
        // 4. movimientos
        .mockResolvedValueOnce(mockMovimientos)
        // 5. get jornada
        .mockResolvedValueOnce([mockJornada])
        // 6. insert reporte
        .mockResolvedValueOnce([])
        // 7. update jornada
        .mockResolvedValueOnce([mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      // Verificar que se llamó a ExcelService con los datos correctos
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).toHaveBeenCalledWith({
        jornada: mockJornada,
        ventas: [expect.objectContaining({ id: 10, detalles: mockDetalles })],
        movimientos: mockMovimientos,
      });

      // Verificar que se insertó el reporte
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO jornada_reportes'),
      );
      expect(insertCall).toBeTruthy();
    });

    it('debería lanzar error si la jornada no existe', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ rol: 'admin' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.cerrar(999, 0, 1)),
      ).rejects.toThrow('Jornada no encontrada');
    });
  });

  describe('obtenerReporte', () => {
    it('debería retornar null si no hay reporte', async () => {
      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerReporte(1));

      expect(resultado).toBeNull();
    });

    it('debería retornar el reporte cuando existe', async () => {
      const mockReporte = {
        id: 1,
        jornada_id: 1,
        content_type: 'excel',
        content_base64: 'UEsDB...',
        filename: 'jornada_2026-06-02_1.xlsx',
        created_at: '2026-06-02T18:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([mockReporte]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerReporte(1));

      expect(resultado).toEqual(mockReporte);
      expect(resultado!.filename).toBe('jornada_2026-06-02_1.xlsx');
    });
  });

  describe('historial', () => {
    it('debería retornar lista de jornadas', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada, mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.historial(10));

      expect(resultado).toHaveLength(2);
    });
  });
});
