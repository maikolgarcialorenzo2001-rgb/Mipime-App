import { TestBed } from '@angular/core/testing';
import { CuentaCosasService, CuentaCosaItem } from './cuenta-cosa.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';

function createMockDb(): Database {
  const sql = vi.fn().mockResolvedValue([]) as unknown as Database['sql'];
  return {
    sql,
    transaction: vi.fn((fn) => fn({ sql: (q: string, p?: unknown[]) => sql(q, p) })),
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
      // Mock stock_shop = 100 for validation in registrarLote (delegation)
      vi.mocked(mockDb.sql).mockResolvedValueOnce([{ stock_shop: 100 }]);

      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // DB calls: SELECT stock_shop, BEGIN, INSERT, COMMIT
      expect(allCalls).toHaveLength(4);
      expect(allCalls[0][0]).toContain('SELECT stock_shop');
      expect(allCalls[1][0]).toBe('BEGIN TRANSACTION');
      expect(allCalls[2][0]).toContain('INSERT INTO cuenta_cosas');
      expect(allCalls[2][1]).toContain(1); // jornada_id
      expect(allCalls[2][1]).toContain(1); // producto_id
      expect(allCalls[2][1]).toContain(2); // cantidad
      expect(allCalls[2][1]).toContain('Retiro familiar'); // descripcion
      expect(allCalls[2][1]).toContain('Juan'); // autorizado_por
      expect(allCalls[3][0]).toBe('COMMIT');

      // registrarSalida was delegated to StockMovimientoService
      expect(mockStockService.registrarSalida).toHaveBeenCalledWith(1, 2, undefined, 1);
    });

    it('2.6 RED: NO debería modificar jornadas (sin UPDATE jornadas)', async () => {
      // Mock stock_shop = 100 for validation in registrarLote (delegation)
      vi.mocked(mockDb.sql).mockResolvedValueOnce([{ stock_shop: 100 }]);

      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const jornadaCalls = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaCalls.length).toBe(0);
    });

    it('debería delegar a registrarLote y validar stock_shop (mock 100)', async () => {
      // Mock stock_shop = 100 for the validation in registrarLote
      vi.mocked(mockDb.sql).mockResolvedValueOnce([{ stock_shop: 100 }]);

      await service.registrar(1, 1, 2, 'Retiro familiar', 'Juan');

      // Should have called registrarLote internally: stock validation + BEGIN + INSERT + COMMIT
      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      expect(allCalls.some((c) => c[0].includes('SELECT stock_shop'))).toBe(true);
      expect(allCalls.some((c) => c[0] === 'BEGIN TRANSACTION')).toBe(true);
      expect(allCalls.some((c) => c[0].includes('INSERT INTO cuenta_cosas'))).toBe(true);
      expect(allCalls.some((c) => c[0] === 'COMMIT')).toBe(true);
    });
  });

  describe('registrarLote', () => {
    it('debería registrar lote multi-producto: 2 rows + 2 salidas, sin UPDATE jornadas', async () => {
      const items: CuentaCosaItem[] = [
        { productoId: 1, cantidad: 2 },
        { productoId: 2, cantidad: 3 },
      ];

      // Mock stock_shop for both products (validation)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 100 }]) // producto 1
        .mockResolvedValueOnce([{ stock_shop: 100 }]); // producto 2

      await service.registrarLote(1, items, 'Retiro familiar', 'María');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Should have 2 stock_shop validations
      const stockChecks = allCalls.filter((c) => c[0].includes('SELECT stock_shop'));
      expect(stockChecks).toHaveLength(2);

      // Should have BEGIN
      expect(allCalls.some((c) => c[0] === 'BEGIN TRANSACTION')).toBe(true);

      // Should have 2 INSERTs into cuenta_cosas
      const inserts = allCalls.filter((c) => c[0].includes('INSERT INTO cuenta_cosas'));
      expect(inserts).toHaveLength(2);
      // First item: producto_id=1, cantidad=2
      expect(inserts[0][1]).toContain(1); // jornada_id
      expect(inserts[0][1]).toContain(1); // producto_id
      expect(inserts[0][1]).toContain(2); // cantidad
      expect(inserts[0][1]).toContain('Retiro familiar'); // descripcion
      expect(inserts[0][1]).toContain('María'); // autorizado_por
      // Second item: producto_id=2, cantidad=3
      expect(inserts[1][1]).toContain(1); // jornada_id
      expect(inserts[1][1]).toContain(2); // producto_id
      expect(inserts[1][1]).toContain(3); // cantidad
      expect(inserts[1][1]).toContain('Retiro familiar');
      expect(inserts[1][1]).toContain('María');

      // Should have 2 registrarSalida calls
      expect(mockStockService.registrarSalida).toHaveBeenCalledTimes(2);
      expect(mockStockService.registrarSalida).toHaveBeenNthCalledWith(1, 1, 2, undefined, 1);
      expect(mockStockService.registrarSalida).toHaveBeenNthCalledWith(2, 2, 3, undefined, 1);

      // Should have COMMIT
      expect(allCalls.some((c) => c[0] === 'COMMIT')).toBe(true);

      // NO UPDATE jornadas
      const jornadaCalls = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaCalls.length).toBe(0);
    });

    it('debería rechazar pre-validación stock insuficiente (cero BEGIN/INSERT/salida)', async () => {
      const items: CuentaCosaItem[] = [
        { productoId: 1, cantidad: 2 },
        { productoId: 2, cantidad: 3 },
      ];

      // Mock stock_shop: producto 1 OK, producto 2 INSUFFICIENTE
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 100 }]) // producto 1 OK
        .mockResolvedValueOnce([{ stock_shop: 2 }]); // producto 2 insufficient (needs 3)

      await expect(service.registrarLote(1, items, 'Retiro familiar', 'María')).rejects.toThrow(
        'Stock insuficiente',
      );

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Should have 2 stock_shop validations (both checked before any BEGIN)
      const stockChecks = allCalls.filter((c) => c[0].includes('SELECT stock_shop'));
      expect(stockChecks).toHaveLength(2);

      // NO BEGIN, NO INSERT, NO COMMIT, NO ROLLBACK
      expect(allCalls.some((c) => c[0] === 'BEGIN TRANSACTION')).toBe(false);
      expect(allCalls.some((c) => c[0].includes('INSERT INTO cuenta_cosas'))).toBe(false);
      expect(allCalls.some((c) => c[0] === 'COMMIT')).toBe(false);
      expect(allCalls.some((c) => c[0] === 'ROLLBACK')).toBe(false);

      // NO registrarSalida calls
      expect(mockStockService.registrarSalida).not.toHaveBeenCalled();
    });

    it('debería rechazar item individual con stock insuficiente', async () => {
      const items: CuentaCosaItem[] = [{ productoId: 1, cantidad: 5 }];

      // Mock stock_shop = 3 (insufficient for 5)
      vi.mocked(mockDb.sql).mockResolvedValueOnce([{ stock_shop: 3 }]);

      await expect(service.registrarLote(1, items, 'Test', 'Juan')).rejects.toThrow(
        'Stock insuficiente',
      );

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Should have 1 stock_shop validation
      const stockChecks = allCalls.filter((c) => c[0].includes('SELECT stock_shop'));
      expect(stockChecks).toHaveLength(1);

      // NO BEGIN, NO INSERT, NO COMMIT
      expect(allCalls.some((c) => c[0] === 'BEGIN TRANSACTION')).toBe(false);
      expect(allCalls.some((c) => c[0].includes('INSERT INTO cuenta_cosas'))).toBe(false);
      expect(allCalls.some((c) => c[0] === 'COMMIT')).toBe(false);

      // NO registrarSalida calls
      expect(mockStockService.registrarSalida).not.toHaveBeenCalled();
    });

    it('debería resolver sin error si items está vacío (cero SQL)', async () => {
      await service.registrarLote(1, [], 'Test', 'Juan');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // NO SQL calls at all
      expect(allCalls).toHaveLength(0);
      expect(mockStockService.registrarSalida).not.toHaveBeenCalled();
    });

    it('debería hacer ROLLBACK y rethrow si registrarSalida falla a mitad de transacción', async () => {
      const items: CuentaCosaItem[] = [
        { productoId: 1, cantidad: 2 },
        { productoId: 2, cantidad: 3 },
      ];

      // Mock stock_shop OK for both
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 100 }])
        .mockResolvedValueOnce([{ stock_shop: 100 }]);

      // Make registrarSalida fail on second call
      mockStockService.registrarSalida
        .mockResolvedValueOnce(mockConsumos)
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(service.registrarLote(1, items, 'Test', 'Juan')).rejects.toThrow('DB error');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Should have BEGIN
      expect(allCalls.some((c) => c[0] === 'BEGIN TRANSACTION')).toBe(true);

      // Should have ROLLBACK
      expect(allCalls.some((c) => c[0] === 'ROLLBACK')).toBe(true);

      // NO COMMIT
      expect(allCalls.some((c) => c[0] === 'COMMIT')).toBe(false);
    });
  });

  describe('listarPorJornada', () => {
    it('debería consultar FROM cuenta_cosas con ORDER BY created_at ASC, id ASC', async () => {
      const mockRows = [
        { id: 1, jornada_id: 1, producto_id: 1, cantidad: 2, descripcion: 'A', autorizado_por: 'X', created_at: '2026-06-04T08:00:00Z' },
        { id: 2, jornada_id: 1, producto_id: 2, cantidad: 3, descripcion: 'B', autorizado_por: 'Y', created_at: '2026-06-04T09:30:00Z' },
      ];
      vi.mocked(mockDb.sql).mockResolvedValueOnce(mockRows);

      const result = await service.listarPorJornada(1);

      expect(vi.mocked(mockDb.sql)).toHaveBeenCalledTimes(1);
      const call = vi.mocked(mockDb.sql).mock.calls[0];
      expect(call[0]).toContain('FROM cuenta_cosas');
      expect(call[0]).toContain('WHERE jornada_id = ?');
      expect(call[0]).toContain('ORDER BY created_at ASC, id ASC');
      expect(call[1]).toEqual([1]);
      expect(result).toEqual(mockRows);
    });

    it('debería retornar array vacío si la jornada no tiene rows', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]);

      const result = await service.listarPorJornada(999);

      expect(result).toEqual([]);
      const call = vi.mocked(mockDb.sql).mock.calls[0];
      expect(call[1]).toEqual([999]);
    });
  });
});