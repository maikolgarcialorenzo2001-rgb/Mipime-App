import { TestBed } from '@angular/core/testing';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import { AuthService } from './auth.service';
import type { StockMovimiento, LoteStock } from '../models';

const mockMovimientos: StockMovimiento[] = [
  {
    id: 1,
    producto_id: 1,
    cantidad: 100,
    tipo: 'entrada',
    motivo: 'Compra a proveedor',
    costo_total: 0,
    created_at: '2026-06-04T10:00:00Z',
  },
  {
    id: 2,
    producto_id: 1,
    cantidad: 10,
    tipo: 'salida',
    motivo: null,
    costo_total: 0,
    created_at: '2026-06-04T11:00:00Z',
  },
  {
    id: 3,
    producto_id: 2,
    cantidad: 50,
    tipo: 'ajuste',
    motivo: 'Inventario físico',
    costo_total: 0,
    created_at: '2026-06-04T12:00:00Z',
  },
];

const mockHistorial = [
  { ...mockMovimientos[0], nombre: 'Harina 0000 1kg' },
  { ...mockMovimientos[1], nombre: 'Harina 0000 1kg' },
  { ...mockMovimientos[2], nombre: 'Azúcar 1kg' },
];

const mockLotes: LoteStock[] = [
  { id: 1, producto_id: 1, cantidad: 10, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', ubicacion: 'almacen', created_at: '2026-01-15T10:00:00Z' },
  { id: 2, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-02-01T10:00:00Z', ubicacion: 'almacen', created_at: '2026-02-01T10:00:00Z' },
];

const mockShopLotes: LoteStock[] = [
  { id: 3, producto_id: 1, cantidad: 5, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', ubicacion: 'shop', created_at: '2026-01-15T10:00:00Z' },
  { id: 4, producto_id: 1, cantidad: 3, precio_costo: 8, fecha_ingreso: '2026-02-01T10:00:00Z', ubicacion: 'shop', created_at: '2026-02-01T10:00:00Z' },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAuth(): { usuario: ReturnType<typeof vi.fn> } {
  return { usuario: vi.fn().mockReturnValue({ rol: 'admin' }) };
}

describe('StockMovimientoService', () => {
  let mockDb: Database;
  let mockAuth: ReturnType<typeof createMockAuth>;
  let service: StockMovimientoService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockAuth = createMockAuth();
    TestBed.configureTestingModule({
      providers: [
        StockMovimientoService,
        { provide: DATABASE, useValue: mockDb },
        { provide: AuthService, useValue: mockAuth },
      ],
    });
    service = TestBed.inject(StockMovimientoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('_checkAdmin', () => {
    it('debería lanzar error si el usuario no es admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      await expect(
        service.registrarEntrada(1, 10, 5),
      ).rejects.toThrow('Solo administradores');
    });

    it('debería lanzar error si no hay usuario logueado', async () => {
      mockAuth.usuario.mockReturnValue(null);

      await expect(
        service.registrarEntrada(1, 10, 5),
      ).rejects.toThrow('Solo administradores');
    });

    it('NO debería lanzar error si el usuario es admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'admin' });

      // Should not throw — just verify it proceeds to DB
      await expect(
        service.registrarEntrada(1, 10, 5),
      ).resolves.not.toThrow();
    });

    it('NO debería bloquear registrarTraslado para usuarios no admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });
      // Two calls: SELECT lotes (empty), safety net SELECT productos (no stock)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ stock: 0, precio_costo: null }]);

      // Should throw insufficient stock, not permission error
      await expect(
        service.registrarTraslado(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });
  });

  describe('_consumirFIFO', () => {
    it('debería filtrar lotes por ubicacion', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes) // SELECT for shop
        .mockResolvedValueOnce([])             // UPDATE lot 3 (consume 5 of 5)
        .mockResolvedValueOnce([])             // UPDATE lot 4 (consume 2 of 3)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // SELECT next lot
        .mockResolvedValueOnce([]);            // UPDATE precio_costo

      const consumos = await service._consumirFIFO(1, 7, 'shop');

      // Should filter by ubicacion='shop'
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('ubicacion = ?'),
        expect.arrayContaining(['shop']),
      );

      expect(consumos).toHaveLength(2);
      expect(consumos[0]).toEqual({ lote_id: 3, cantidad: 5, precio_costo_real: 5 });
      expect(consumos[1]).toEqual({ lote_id: 4, cantidad: 2, precio_costo_real: 8 });
    });

    it('debería ignorar lotes de otras ubicaciones', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)  // Only shop lots returned
        .mockResolvedValueOnce([])              // UPDATE lot 3
        .mockResolvedValueOnce([])              // UPDATE lot 4
        .mockResolvedValueOnce([{ precio_costo: 8 }])
        .mockResolvedValueOnce([]);

      const consumos = await service._consumirFIFO(1, 8, 'shop');

      expect(consumos).toHaveLength(2);
      expect(consumos.reduce((s, c) => s + c.cantidad, 0)).toBe(8);
    });

    it('debería lanzar "Stock insuficiente" cuando no hay suficientes lotes en la ubicacion', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce(mockShopLotes); // Only 8 in shop

      await expect(
        service._consumirFIFO(1, 10, 'shop'),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería crear lote default cuando no hay lotes pero stock > 0 (ubicacion almacen)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty
        .mockResolvedValueOnce([{ stock: 20, precio_costo: 5 }]) // SELECT productos -> stock_almacen > 0
        .mockResolvedValueOnce([{ id: 99 }]) // INSERT default lote
        .mockResolvedValueOnce([])  // UPDATE lote (consume)
        .mockResolvedValueOnce([{ precio_costo: 5 }])
        .mockResolvedValueOnce([]);

      await service._consumirFIFO(1, 10, 'almacen');

      // Verify it read stock_almacen
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('stock_almacen'),
        [1],
      );
    });

    it('debería crear lote default cuando no hay lotes pero stock > 0 (ubicacion shop)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty
        .mockResolvedValueOnce([{ stock: 15, precio_costo: 6 }]) // SELECT productos -> stock_shop > 0
        .mockResolvedValueOnce([{ id: 100 }]) // INSERT default lote
        .mockResolvedValueOnce([])  // UPDATE lote
        .mockResolvedValueOnce([{ precio_costo: 6 }])
        .mockResolvedValueOnce([]);

      await service._consumirFIFO(1, 5, 'shop');

      // Verify it read stock_shop
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('stock_shop'),
        [1],
      );
    });
  });

  describe('registrarEntrada', () => {
    it('debería insertar movimiento, aumentar stock y crear lote con ubicacion default almacen', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 50, 5.00, 'Compra a proveedor');

      // 1. INSERT stock_movimientos
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 50, 'entrada', 'Compra a proveedor']),
      );

      // 2. UPDATE stock_almacen
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('stock_almacen'),
        expect.arrayContaining([50, 1]),
      );

      // 3. INSERT lotes_stock with ubicacion='almacen'
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO lotes_stock'),
        expect.arrayContaining([1, 50, 5.00, 'almacen']),
      );

      expect(mockDb.sql).toHaveBeenCalledTimes(3);
    });

    it('debería crear lote con ubicacion shop cuando se especifica', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 10, 3.50, 'Reposición', undefined, 'shop');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO lotes_stock'),
        expect.arrayContaining([1, 10, 3.50, 'shop']),
      );
    });

    it('debería actualizar stock_shop cuando ubicacion=shop', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarEntrada(1, 10, 3.50, undefined, undefined, 'shop');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('stock_shop'),
        expect.arrayContaining([10, 1]),
      );
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
    it('debería consumir FIFO desde shop y retornar ConsumoRecord[]', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)   // SELECT lotes_stock for shop
        .mockResolvedValueOnce([])               // UPDATE lot 3 (consume 5 of 5)
        .mockResolvedValueOnce([])               // UPDATE lot 4 (consume 2 of 3)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // SELECT next lot
        .mockResolvedValueOnce([])               // UPDATE productos precio_costo
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 1 }])   // SELECT SUM for shop (0 + 1)
        .mockResolvedValueOnce([]);              // UPDATE productos stock_shop

      const consumos = await service.registrarSalida(1, 7, 'Venta');

      expect(consumos).toHaveLength(2);
      expect(consumos[0]).toEqual({ lote_id: 3, cantidad: 5, precio_costo_real: 5 });
      expect(consumos[1]).toEqual({ lote_id: 4, cantidad: 2, precio_costo_real: 8 });

      // Verify UPDATE targets stock_shop
      const stockUpdate = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('stock_shop'),
      );
      expect(stockUpdate).toBeTruthy();
    });

    it('debería lanzar "Stock insuficiente" cuando no hay suficientes lotes en la ubicacion', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 3, producto_id: 1, cantidad: 5, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', ubicacion: 'shop', created_at: '2026-01-15T10:00:00Z' },
      ]);

      await expect(
        service.registrarSalida(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería pasar ubicacion a _consumirFIFO', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ precio_costo: 8 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([]);

      await service.registrarSalida(1, 7, 'Venta');

      // First call should filter by ubicacion='shop'
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('ubicacion = ?'),
        expect.arrayContaining(['shop']),
      );
    });

    it('debería insertar jornada_id cuando se proporciona', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)
        .mockResolvedValueOnce([])               // UPDATE lot 3 (consume 5 of 5)
        .mockResolvedValueOnce([])               // UPDATE lot 4 (consume 1 of 3)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // SELECT next lot
        .mockResolvedValueOnce([])               // UPDATE precio_costo
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 2 }])   // SELECT SUM (0 + 2)
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      await service.registrarSalida(1, 6, 'Venta', 42);

      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos'),
      );
      expect(insertCall![0]).toContain('jornada_id');
      expect(insertCall![1]).toContain(42);
    });
  });

  describe('registrarAjuste', () => {
    it('debería reemplazar lotes con promedio ponderado y stock exacto en almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce(mockLotes)        // SELECT lots for avg
        .mockResolvedValueOnce([])               // DELETE old lots
        .mockResolvedValueOnce([])               // INSERT new lot with ubicacion
        .mockResolvedValueOnce([]);              // UPDATE stock_almacen

      await service.registrarAjuste(1, 12, 'Corrección de inventario');

      // Should insert new lot with ubicacion='almacen' (hardcoded in SQL)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("'almacen'"),
        expect.arrayContaining([1, 12, 6.5, expect.any(String)]),
      );

      // Should update stock_almacen
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([12, expect.any(String), 1]),
      );
    });

    it('debería crear lote vacío cuando nueva cantidad es 0', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockLotes)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);              // UPDATE stock_almacen

      await service.registrarAjuste(1, 0, 'Agotar stock');

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

  describe('registrarTraslado', () => {
    it('debería consumir de almacen FIFO, crear shop lots y recalcular ambos stocks', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)        // 0: SELECT lotes_stock (almacen)
        .mockResolvedValueOnce([])                // 1: UPDATE lot 1 (consume 10)
        .mockResolvedValueOnce([])                // 2: UPDATE lot 2 (consume 1)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // 3: SELECT next lot
        .mockResolvedValueOnce([])                // 4: UPDATE precio_costo
        .mockResolvedValueOnce([])                // 5: INSERT shop lot (10u from lot1)
        .mockResolvedValueOnce([])                // 6: INSERT shop lot (1u from lot2)
        .mockResolvedValueOnce([])                // 7: INSERT stock_movimiento 'traslado'
        .mockResolvedValueOnce([{ totalAlmacen: 9 }])  // 8: SELECT SUM almacen
        .mockResolvedValueOnce([{ totalShop: 11 }])    // 9: SELECT SUM shop
        .mockResolvedValueOnce([]);               // 10: UPDATE productos dual

      const consumos = await service.registrarTraslado(1, 11);

      // Should consume from almacen
      expect(consumos).toHaveLength(2);
      expect(consumos[0].lote_id).toBe(1);
      expect(consumos[1].lote_id).toBe(2);

      // Should create shop lots for each consumption with 'shop' in SQL
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining("'shop'"),
        expect.arrayContaining([1, 10, 5, expect.any(String)]),
      );
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining("'shop'"),
        expect.arrayContaining([1, 1, 8, expect.any(String)]),
      );

      // Should register tipo='traslado' (in params, not SQL — uses ? placeholder)
      const trasladoInsert = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos') && call[1]?.includes('traslado'),
      );
      expect(trasladoInsert).toBeTruthy();

      // Should update both stock columns (call 11, 1-indexed)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        11,
        expect.stringContaining('SET stock_almacen = ?, stock_shop = ?'),
        expect.arrayContaining([9, 11, expect.any(String), 1]),
      );
    });

    it('debería lanzar "Stock insuficiente" si no hay stock en almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty for almacen
        .mockResolvedValueOnce([{ stock: 0, precio_costo: null }]); // safety net -> no stock

      await expect(
        service.registrarTraslado(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería permitir traslado para usuarios no admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])  // SELECT lotes_stock -> empty
        .mockResolvedValueOnce([{ stock: 0, precio_costo: 5 }]); // safety net -> no stock

      await expect(
        service.registrarTraslado(1, 10),
      ).rejects.toThrow('Stock insuficiente');  // Permission error NOT thrown
    });
  });

  describe('registrarAjusteLote', () => {
    it('debería actualizar un lote específico y recalcular stock de la ubicacion', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([])               // UPDATE lot
        .mockResolvedValueOnce([{ total: 5 }])   // SELECT SUM for shop
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      await service.registrarAjusteLote(1, 3, 2, 'Corrección de lote', 'shop');

      // Should update the specific lot (no updated_at — lotes_stock lacks that column)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE lotes_stock SET cantidad = ?'),
        [2, 3],
      );

      // Should recalc stock_shop
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('SUM(cantidad)'),
        expect.arrayContaining([1, 'shop']),
      );

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('stock_shop'),
        expect.arrayContaining([5, expect.any(String), 1]),
      );
    });

    it('debería recalcular stock_almacen cuando ubicacion=almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 15 }])  // SELECT SUM for almacen
        .mockResolvedValueOnce([]);              // UPDATE stock_almacen

      await service.registrarAjusteLote(1, 1, 5, 'Ajuste almacen', 'almacen');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('stock_almacen'),
        expect.arrayContaining([15, expect.any(String), 1]),
      );
    });

    it('debería rechazar motivo vacío', async () => {
      await expect(
        service.registrarAjusteLote(1, 1, 5, '', 'shop'),
      ).rejects.toThrow('El motivo es obligatorio');
    });

    it('debería registrar movimiento tipo ajuste', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 10 }])
        .mockResolvedValueOnce([]);

      await service.registrarAjusteLote(1, 1, 5, 'Ajuste', 'shop');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 5, 'ajuste']),
      );
    });
  });

  describe('registrarEditar', () => {
    it('debería actualizar producto precio_venta y lote precio_costo/cantidad', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([])               // UPDATE productos precio_venta
        .mockResolvedValueOnce([])               // UPDATE lotes_stock cantidad + precio_costo
        .mockResolvedValueOnce([{ total: 8 }])   // SELECT SUM for shop
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      await service.registrarEditar(1, 3, 15, 10, 8, 'Actualización de precios', 'shop');

      // 1. Register movement
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 8, 'ajuste']),
      );

      // 2. Update product precio_venta
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE productos SET precio_venta = ?'),
        [15, expect.any(String), 1],
      );

      // 3. Update lotes_stock cantidad + precio_costo
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE lotes_stock SET cantidad = ?, precio_costo = ?'),
        [8, 10, 3],
      );

      // 4. Recalc stock_shop
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('stock_shop'),
        expect.arrayContaining([8, expect.any(String), 1]),
      );
    });

    it('debería rechazar motivo vacío', async () => {
      await expect(
        service.registrarEditar(1, 1, 10, 5, 10, '', 'shop'),
      ).rejects.toThrow('El motivo es obligatorio');
    });

    it('debería rechazar si el usuario no es admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      await expect(
        service.registrarEditar(1, 1, 10, 5, 10, 'Motivo', 'shop'),
      ).rejects.toThrow('Solo administradores');
    });

    it('debería recalcular stock_almacen cuando ubicacion=almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 20 }])
        .mockResolvedValueOnce([]);

      await service.registrarEditar(1, 1, 12, 6, 20, 'Edit almacen', 'almacen');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('stock_almacen'),
        expect.arrayContaining([20, expect.any(String), 1]),
      );
    });
  });

  describe('registrarMerma', () => {
    it('debería consumir FIFO de shop solamente e ignorar almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)    // SELECT lotes_stock (shop)
        .mockResolvedValueOnce([])                // UPDATE lot 3 (consume 5)
        .mockResolvedValueOnce([])                // UPDATE lot 4 (consume 2)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // SELECT next lot
        .mockResolvedValueOnce([])                // UPDATE precio_costo
        .mockResolvedValueOnce([])                // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 1 }])   // SELECT SUM for shop (0 + 1)
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      const result = await service.registrarMerma(1, 7, 'Rotura');

      // Should have filtered by ubicacion='shop'
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('ubicacion = ?'),
        expect.arrayContaining(['shop']),
      );

      // FIFO consumption: shop lot 3 (5×5) + shop lot 4 (2×8) = 25 + 16 = 41
      expect(result.consumos).toHaveLength(2);
      expect(result.costoTotal).toBe(41);

      // Should update stock_shop, not stock_almacen (last UPDATE productos call)
      const stockUpdates = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos'),
      );
      expect(stockUpdates.length).toBe(2); // precio_costo + stock_shop
      const stockUpdate = stockUpdates[1]; // The second UPDATE is the stock column
      expect(stockUpdate[0]).toContain('stock_shop');
      expect(stockUpdate[1][0]).toBe(1); // shop stock after consumption
    });

    it('debería lanzar "Stock insuficiente" si no hay suficientes lotes en shop', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce(mockShopLotes); // Only 8 in shop

      await expect(
        service.registrarMerma(1, 10),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('debería actualizar stock_shop después de la merma', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ id: 3, producto_id: 1, cantidad: 5, precio_costo: 10, fecha_ingreso: '2026-01-15T10:00:00Z', ubicacion: 'shop', created_at: '2026-01-15T10:00:00Z' }])
        .mockResolvedValueOnce([])               // UPDATE lot (consume 2)
        .mockResolvedValueOnce([{ precio_costo: 10 }]) // SELECT next lot
        .mockResolvedValueOnce([])               // UPDATE precio_costo
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 3 }])   // SELECT SUM for shop (5-2=3)
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      await service.registrarMerma(1, 2, 'Prueba');

      // The last UPDATE productos call is the stock_shop update
      const stockUpdates = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos'),
      );
      const stockUpdate = stockUpdates[stockUpdates.length - 1];
      expect(stockUpdate[0]).toContain('stock_shop');
      expect(stockUpdate[1][0]).toBe(3);
    });

    it('debería actualizar jornada total_merma y saldo_esperado cuando se proporciona jornadaId', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)
        .mockResolvedValueOnce([])               // UPDATE lot 3 (consume 5)
        .mockResolvedValueOnce([])               // UPDATE lot 4 (consume 2)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // SELECT next lot
        .mockResolvedValueOnce([])               // UPDATE precio_costo
        .mockResolvedValueOnce([])               // INSERT stock_movimientos (con jornada_id)
        .mockResolvedValueOnce([{ total: 1 }])   // SELECT SUM shop
        .mockResolvedValueOnce([])               // UPDATE stock_shop
        .mockResolvedValueOnce([]);              // UPDATE jornadas

      // consumos: lot3(5×5=25) + lot4(2×8=16) = 41
      await service.registrarMerma(1, 7, 'Rotura', 42);

      const jornadaUpdate = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE jornadas'),
      );
      expect(jornadaUpdate).toBeTruthy();
      expect(jornadaUpdate![1]).toContain(41); // total_merma += 41
      expect(jornadaUpdate![1]).toContain(41); // saldo_esperado -= 41
    });

    it('debería actualizar stock_shop cuando no hay productos en almacen', async () => {
      const mixedLotes = [
        { id: 1, producto_id: 1, cantidad: 10, precio_costo: 5, fecha_ingreso: '2026-01-15T10:00:00Z', ubicacion: 'almacen', created_at: '2026-01-15T10:00:00Z' },
        { id: 3, producto_id: 1, cantidad: 5, precio_costo: 8, fecha_ingreso: '2026-01-16T10:00:00Z', ubicacion: 'shop', created_at: '2026-01-16T10:00:00Z' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([mixedLotes[1]]) // Only shop lot returned (filtered by ubicacion)
        .mockResolvedValueOnce([])               // UPDATE lot (consume 1)
        .mockResolvedValueOnce([{ precio_costo: 8 }])
        .mockResolvedValueOnce([])               // UPDATE precio_costo
        .mockResolvedValueOnce([])               // INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 4 }])   // SELECT SUM shop
        .mockResolvedValueOnce([]);              // UPDATE stock_shop

      const result = await service.registrarMerma(1, 1, 'Test');

      expect(result.consumos).toHaveLength(1);
      expect(result.consumos[0].lote_id).toBe(3); // Only shop lot consumed
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
