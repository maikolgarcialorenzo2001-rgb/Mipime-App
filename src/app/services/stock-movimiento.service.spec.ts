import { TestBed } from '@angular/core/testing';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import type { StockMovimiento, LoteStock } from '../models';

const mockMovimientos: StockMovimiento[] = [
  {
    id: 1,
    producto_id: 1,
    cantidad: 100,
    tipo: 'entrada',
    motivo: 'Compra a proveedor',
    created_at: '2026-06-04T10:00:00Z',
  },
  {
    id: 2,
    producto_id: 1,
    cantidad: 10,
    tipo: 'salida',
    motivo: null,
    created_at: '2026-06-04T11:00:00Z',
  },
  {
    id: 3,
    producto_id: 2,
    cantidad: 50,
    tipo: 'ajuste',
    motivo: 'Inventario físico',
    created_at: '2026-06-04T12:00:00Z',
  },
];

const mockHistorial = [
  { ...mockMovimientos[0], nombre: 'Harina 0000 1kg' },
  { ...mockMovimientos[1], nombre: 'Harina 0000 1kg' },
  { ...mockMovimientos[2], nombre: 'Azúcar 1kg' },
];

const mockLotes: LoteStock[] = [
  { id: 1, producto_id: 1, cantidad: 10, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', created_at: '2026-01-15T10:00:00Z' },
  { id: 2, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-02-01T10:00:00Z', created_at: '2026-02-01T10:00:00Z' },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('StockMovimientoService', () => {
  let mockDb: Database;
  let service: StockMovimientoService;

  beforeEach(() => {
    mockDb = createMockDb();
    TestBed.configureTestingModule({
      providers: [
        StockMovimientoService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
    service = TestBed.inject(StockMovimientoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrarEntrada', () => {
    it('debería insertar movimiento, aumentar stock y crear lote', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 50, 5.00, 'Compra a proveedor');

      // 1. INSERT stock_movimientos
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 50, 'entrada', 'Compra a proveedor']),
      );

      // 2. UPDATE stock_actual
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([expect.any(String), 1]),
      );

      // 3. INSERT lotes_stock
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO lotes_stock'),
        expect.arrayContaining([1, 50, 5.00]),
      );

      expect(mockDb.sql).toHaveBeenCalledTimes(3);
    });

    it('debería permitir registrar entrada sin motivo', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 25, 3.50);

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 25, null]),
      );
    });

    it('debería insertar jornada_id cuando se proporciona', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 50, 5.00, 'Compra', 42);

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('jornada_id'),
        expect.arrayContaining([1, 50, 'entrada', 'Compra', 42]),
      );
    });
  });

  describe('registrarSalida', () => {
    it('debería consumir FIFO y retornar ConsumoRecord[]', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)       // SELECT lotes_stock
        .mockResolvedValueOnce([])               // UPDATE lot 1
        .mockResolvedValueOnce([])               // UPDATE lot 2
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 9 }])   // SELECT SUM for stock_actual
        .mockResolvedValueOnce([]);              // UPDATE productos stock_actual

      const consumos = await service.registrarSalida(1, 11, 'Venta');

      expect(consumos).toHaveLength(2);
      expect(consumos[0]).toEqual({ lote_id: 1, cantidad: 10, precio_costo_real: 5 });
      expect(consumos[1]).toEqual({ lote_id: 2, cantidad: 1, precio_costo_real: 8 });
    });

    it('debería lanzar "Stock insuficiente" cuando lotes no cubren la cantidad', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 1, producto_id: 1, cantidad: 5, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', created_at: '2026-01-15T10:00:00Z' },
      ]);

      await expect(
        service.registrarSalida(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería consumir de múltiples lotes cuando el primero no alcanza', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 9 }])
        .mockResolvedValueOnce([]);

      const consumos = await service.registrarSalida(1, 11);

      expect(consumos[0].cantidad).toBe(10);
      expect(consumos[1].cantidad).toBe(1);
    });

    it('debería insertar jornada_id cuando se proporciona', async () => {
      // cantidad=5 solo consume de lot 1 (tiene 10), no necesita lot 2
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)               // SELECT lotes_stock (FIFO)
        .mockResolvedValueOnce([])                       // UPDATE lot 1 (consume 5 of 10)
        .mockResolvedValueOnce([])                       // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 15 }])          // SELECT SUM lotes_stock
        .mockResolvedValueOnce([]);                      // UPDATE productos stock_actual

      await service.registrarSalida(1, 5, 'Venta', 42);

      // INSERT stock_movimientos should include jornada_id
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos'),
      );
      expect(insertCall![0]).toContain('jornada_id');
      expect(insertCall![1]).toContain(42);
    });
  });

  describe('registrarAjuste', () => {
    it('debería reemplazar lotes con promedio ponderado y stock exacto', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce(mockLotes)        // SELECT lots for avg
        .mockResolvedValueOnce([])               // DELETE old lots
        .mockResolvedValueOnce([])               // INSERT new lot
        .mockResolvedValueOnce([]);              // UPDATE stock_actual

      await service.registrarAjuste(1, 12, 'Corrección de inventario');

      // Should delete old lots
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM lotes_stock'),
        [1],
      );

      // Should create new lot with weighted avg cost: (10×5 + 10×8) / 20 = 6.5
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO lotes_stock'),
        expect.arrayContaining([1, 12, 6.5]),
      );

      // Should update stock_actual to 12
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([12, expect.any(String), 1]),
      );
    });

    it('debería crear lote vacío cuando nueva cantidad es 0', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce(mockLotes)        // SELECT lots
        .mockResolvedValueOnce([])               // DELETE old lots
        .mockResolvedValueOnce([]);              // UPDATE stock_actual

      await service.registrarAjuste(1, 0, 'Agotar stock');

      // Should NOT insert a new lot (cantidad = 0)
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO lotes_stock'),
      );
      expect(insertCall).toBeUndefined();
    });

    it('debería lanzar "El motivo es obligatorio" cuando motivo está vacío', async () => {
      await expect(
        service.registrarAjuste(1, 50, ''),
      ).rejects.toThrow('El motivo es obligatorio');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('debería lanzar "El motivo es obligatorio" cuando motivo es solo espacios', async () => {
      await expect(
        service.registrarAjuste(1, 50, '   '),
      ).rejects.toThrow('El motivo es obligatorio');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('debería insertar jornada_id cuando se proporciona', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.registrarAjuste(1, 80, 'Corrección', 42);

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('jornada_id'),
        expect.arrayContaining([1, 80, 'ajuste', 'Corrección', 42]),
      );
    });
  });

  describe('obtenerMovimientos', () => {
    it('debería retornar movimientos para un producto ordenados por fecha descendente', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue(
        mockMovimientos.filter((m) => m.producto_id === 1),
      );

      const resultado = await service.obtenerMovimientos(1);

      expect(resultado).toHaveLength(2);
      expect(resultado[0].tipo).toBe('entrada');
      expect(resultado[1].tipo).toBe('salida');
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM stock_movimientos WHERE producto_id = ? ORDER BY created_at DESC'),
        [1],
      );
    });

    it('debería retornar array vacío cuando no hay movimientos', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const resultado = await service.obtenerMovimientos(999);

      expect(resultado).toEqual([]);
    });
  });

  describe('registrarMerma', () => {
    it('debería consumir FIFO, calcular costoTotal y registrar merma', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)       // SELECT lotes_stock (FIFO)
        .mockResolvedValueOnce([])               // UPDATE lot 1
        .mockResolvedValueOnce([])               // UPDATE lot 2
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 15 }])  // SELECT SUM lotes_stock
        .mockResolvedValueOnce([])               // UPDATE productos stock_actual
        .mockResolvedValueOnce([]);              // UPDATE jornadas

      const result = await service.registrarMerma(1, 11, 'Rotura');

      // FIFO consumption: lot 1 (10×5) + lot 2 (1×8) = 50 + 8 = 58
      expect(result.consumos).toHaveLength(2);
      expect(result.costoTotal).toBe(58);
      expect(result.consumos[0]).toEqual({ lote_id: 1, cantidad: 10, precio_costo_real: 5 });
      expect(result.consumos[1]).toEqual({ lote_id: 2, cantidad: 1, precio_costo_real: 8 });

      // Verify INSERT stock_movimientos with tipo='merma' and costo_total
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos'),
      );
      expect(insertCall).toBeTruthy();
      expect(insertCall![1]).toContain('merma');
      expect(insertCall![1]).toContain(58);
    });

    it('debería lanzar "Stock insuficiente" si no hay suficientes lotes', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 1, producto_id: 1, cantidad: 5, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', created_at: '2026-01-15T10:00:00Z' },
      ]);

      await expect(
        service.registrarMerma(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería actualizar stock_actual después de la merma', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ id: 1, producto_id: 1, cantidad: 5, precio_costo: 10, fecha_ingreso: '2026-01-15T10:00:00Z', created_at: '2026-01-15T10:00:00Z' }])  // consumir 2 de 5
        .mockResolvedValueOnce([])               // UPDATE lot
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 3 }])   // SELECT SUM lotes_stock -> 3 restantes
        .mockResolvedValueOnce([]);              // UPDATE productos

      await service.registrarMerma(1, 2, 'Prueba');

      const stockUpdate = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos'),
      );
      expect(stockUpdate![1][0]).toBe(3); // stock_actual = 3
    });

    it('debería actualizar jornada total_merma y saldo_esperado cuando se proporciona jornadaId', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)       // SELECT lotes_stock
        .mockResolvedValueOnce([])               // UPDATE lot 1
        .mockResolvedValueOnce([])               // UPDATE lot 2
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 15 }])  // SELECT SUM
        .mockResolvedValueOnce([])               // UPDATE productos
        .mockResolvedValueOnce([]);              // UPDATE jornadas

      await service.registrarMerma(1, 11, 'Rotura', 42);

      const jornadaUpdate = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE jornadas'),
      );
      expect(jornadaUpdate).toBeTruthy();
      expect(jornadaUpdate![1]).toContain(58); // total_merma += 58
      expect(jornadaUpdate![1]).toContain(58); // saldo_esperado -= 58
    });

    it('debería lanzar "Stock insuficiente" cuando no hay lotes ni stock', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty
        .mockResolvedValueOnce([{ stock_actual: 0, precio_costo: null }]); // SELECT productos -> no stock

      await expect(
        service.registrarMerma(1, 1),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería crear lote default cuando no hay lotes pero stock_actual > 0', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty
        .mockResolvedValueOnce([{ stock_actual: 10, precio_costo: 5 }]) // SELECT productos -> has stock
        .mockResolvedValueOnce([{ id: 99 }]) // INSERT default lote -> RETURNING id
        .mockResolvedValueOnce([])  // UPDATE lote (consume)
        .mockResolvedValueOnce([])  // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 9 }]) // SELECT SUM
        .mockResolvedValueOnce([]); // UPDATE productos

      const result = await service.registrarMerma(1, 1, 'Test');
      expect(result.consumos.length).toBe(1);
      expect(result.consumos[0].cantidad).toBe(1);
    });

    it('debería insertar jornada_id cuando se proporciona', async () => {
      // consume solo del lote 1 (tiene 10, necesitamos 5)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)
        .mockResolvedValueOnce([])               // UPDATE lot 1
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 15 }])  // SELECT SUM
        .mockResolvedValueOnce([])               // UPDATE productos
        .mockResolvedValueOnce([]);              // UPDATE jornadas

      await service.registrarMerma(1, 5, 'Test', 42);

      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos'),
      );
      expect(insertCall![0]).toContain('jornada_id');
      expect(insertCall![1]).toContain(42);
    });
  });

  describe('obtenerHistorial', () => {
    it('debería retornar movimientos con nombre del producto', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue(mockHistorial);

      const resultado = await service.obtenerHistorial();

      expect(resultado).toHaveLength(3);
      expect(resultado[0]).toHaveProperty('nombre');
      expect(resultado[0].nombre).toBe('Harina 0000 1kg');
    });
  });
});
