import { TestBed } from '@angular/core/testing';
import { CuentaCosasService } from './cuenta-cosa.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CuentaCosasService', () => {
  let mockDb: Database;
  let service: CuentaCosasService;
  let stockMovimientoService: StockMovimientoService;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        CuentaCosasService,
        StockMovimientoService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    service = TestBed.inject(CuentaCosasService);
    stockMovimientoService = TestBed.inject(StockMovimientoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrar', () => {
    it('2.6 RED: debería INSERT en cuenta_cosas y registrar salida de stock', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                       // 0: INSERT INTO cuenta_cosas
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 1: SELECT stock (registrarSalida)
        .mockResolvedValueOnce([])                       // 2: INSERT movimiento
        .mockResolvedValueOnce([]);                      // 3: UPDATE stock

      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Call 0: INSERT INTO cuenta_cosas
      expect(allCalls[0][0]).toContain('INSERT INTO cuenta_cosas');
      expect(allCalls[0][1]).toContain(1); // jornada_id
      expect(allCalls[0][1]).toContain(1); // producto_id
      expect(allCalls[0][1]).toContain(2); // cantidad
      expect(allCalls[0][1]).toContain('Retiro familiar'); // descripcion
      expect(allCalls[0][1]).toContain('Juan'); // autorizado_por

      // Calls 1-3: delegado a StockMovimientoService.registrarSalida
      expect(allCalls[1][0]).toContain('SELECT stock_actual');
      expect(allCalls[2][0]).toContain('INSERT INTO stock_movimientos');
      expect(allCalls[3][0]).toContain('UPDATE productos');
    });

    it('2.6 RED: NO debería modificar jornadas (sin UPDATE jornadas)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                       // 0: INSERT INTO cuenta_cosas
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 1: registrarSalida SELECT
        .mockResolvedValueOnce([])                       // 2: registrarSalida INSERT
        .mockResolvedValueOnce([]);                      // 3: registrarSalida UPDATE

      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const jornadaCalls = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaCalls.length).toBe(0);
    });
  });
});
