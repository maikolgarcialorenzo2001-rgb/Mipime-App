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

const mockConsumos = [
  { lote_id: 1, cantidad: 2, precio_costo_real: 550 },
];

function createMockStockService() {
  return {
    registrarSalida: vi.fn().mockResolvedValue(mockConsumos),
    registrarEntrada: vi.fn().mockResolvedValue(undefined),
    registrarAjuste: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CuentaCosasService', () => {
  let mockDb: Database;
  let mockStockService: ReturnType<typeof createMockStockService>;
  let service: CuentaCosasService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockStockService = createMockStockService();

    TestBed.configureTestingModule({
      providers: [
        CuentaCosasService,
        { provide: StockMovimientoService, useValue: mockStockService },
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    service = TestBed.inject(CuentaCosasService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrar', () => {
    it('2.6 RED: debería INSERT en cuenta_cosas y delegar salida de stock', async () => {
      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Only DB call: INSERT INTO cuenta_cosas (registrarSalida is mocked)
      expect(allCalls).toHaveLength(1);
      expect(allCalls[0][0]).toContain('INSERT INTO cuenta_cosas');
      expect(allCalls[0][1]).toContain(1); // jornada_id
      expect(allCalls[0][1]).toContain(1); // producto_id
      expect(allCalls[0][1]).toContain(2); // cantidad
      expect(allCalls[0][1]).toContain('Retiro familiar'); // descripcion
      expect(allCalls[0][1]).toContain('Juan'); // autorizado_por

      // registrarSalida was delegated to StockMovimientoService
      expect(mockStockService.registrarSalida).toHaveBeenCalledWith(1, 2);
    });

    it('2.6 RED: NO debería modificar jornadas (sin UPDATE jornadas)', async () => {
      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const jornadaCalls = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaCalls.length).toBe(0);
    });
  });
});
