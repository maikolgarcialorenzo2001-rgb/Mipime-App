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

    it('4.0 RED: agotar el lote del frente avanza precio_costo al siguiente lote FIFO', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)               // 1: SELECT lotes_stock for shop
        .mockResolvedValueOnce([])                          // 2: UPDATE lot 3 (consume 5 de 5 -> agota el frente)
        .mockResolvedValueOnce([])                          // 3: UPDATE lot 4 (consume 1 de 3)
        .mockResolvedValueOnce([{ precio_costo: 8 }])       // 4: SELECT next lot -> lote 4 es el nuevo frente
        .mockResolvedValueOnce([]);                         // 5: UPDATE productos.precio_costo

      const consumos = await service._consumirFIFO(1, 6, 'shop');

      expect(consumos).toHaveLength(2);
      expect(consumos[0]).toEqual({ lote_id: 3, cantidad: 5, precio_costo_real: 5 });
      expect(consumos[1]).toEqual({ lote_id: 4, cantidad: 1, precio_costo_real: 8 });

      // El frente (lote 3, costo 5) quedó agotado -> precio_costo avanza al lote 4 (costo 8)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([8, expect.any(String), 1]),
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

      expect(mockDb.sql).toHaveBeenCalledTimes(4);
    });

    it('5.0 RED: debería sincronizar productos.precio_costo al nuevo lote cuando el producto estaba sin stock', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                                  // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                                  // 2: UPDATE stock_almacen
        .mockResolvedValueOnce([])                                  // 3: INSERT lotes_stock
        .mockResolvedValueOnce([{ precio_costo: 9 }])               // 4: SELECT next lot -> el nuevo lote es el frente FIFO
        .mockResolvedValueOnce([]);                                 // 5: UPDATE productos.precio_costo

      await service.registrarEntrada(1, 20, 9, 'Reposición');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([9, expect.any(String), 1]),
      );
    });

    it('5.0 RED: NO debería sobrescribir productos.precio_costo con el costo nuevo si ya existe stock anterior', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                                  // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                                  // 2: UPDATE stock_almacen
        .mockResolvedValueOnce([])                                  // 3: INSERT lotes_stock
        .mockResolvedValueOnce([{ precio_costo: 5 }])               // 4: SELECT next lot -> frente FIFO sigue siendo el lote viejo
        .mockResolvedValueOnce([]);                                 // 5: UPDATE productos.precio_costo

      await service.registrarEntrada(1, 20, 9, 'Reposición');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([5, expect.any(String), 1]),
      );
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

    it('debería permitir a trabajadores (no lanza error de permisos)', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockShopLotes)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ precio_costo: 8 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([]);
      const consumos = await service.registrarSalida(1, 7, 'Venta');
      expect(consumos).toHaveLength(2);
    });

    it('1.1 RED: con loteId consume SOLO ese lote y deja intactos los demás', async () => {
      // Lotes de almacén: lote 1 (10u, más viejo) y lote 2 (10u, más nuevo).
      // Con loteId=2 el consumo debe aplicar únicamente al lote 2 (NO FIFO front).
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([mockLotes[1]])               // 1: pre-check SELECT lote 2
        .mockResolvedValueOnce([mockLotes[1]])               // 2: SELECT filtrado por id
        .mockResolvedValueOnce([])                           // 3: UPDATE lote 2 (consume 3)
        .mockResolvedValueOnce([{ precio_costo: 5 }])        // 4: SELECT next lot
        .mockResolvedValueOnce([])                           // 5: UPDATE precio_costo
        .mockResolvedValueOnce([])                           // 6: INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 17 }])              // 7: SELECT SUM almacen (10+10-3)
        .mockResolvedValueOnce([]);                          // 8: UPDATE stock_almacen

      const consumos = await service.registrarSalida(1, 3, 'Lote', undefined, 'almacen', 2);

      // Consumo único sobre el lote 2
      expect(consumos).toHaveLength(1);
      expect(consumos[0]).toEqual({ lote_id: 2, cantidad: 3, precio_costo_real: 8 });

      // Pre-check: primera query filtra por id del lote, producto y ubicacion
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('id = ?'),
        [2, 1, 'almacen'],
      );
      // SELECT de consumo filtrado por id
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('AND id = ?'),
        [1, 'almacen', 2],
      );

      // Solo un UPDATE a lotes_stock y apunta al lote 2 (el lote 1 queda intacto)
      const lotUpdates = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE lotes_stock'),
      );
      expect(lotUpdates).toHaveLength(1);
      expect(lotUpdates[0]![1]).toEqual([3, 2]);

      // Movimiento registrado tipo 'salida'
      const insert = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO stock_movimientos'),
      );
      expect(insert![1]).toContain('salida');
    });

    it('1.2 RED: cantidad > lote.cantidad rechaza "Stock insuficiente" sin consumir nada', async () => {
      // Pre-check: lote 2 con 10u < 15 requeridas → debe fallar antes de mutar
      vi.mocked(mockDb.sql).mockResolvedValueOnce([mockLotes[1]]);

      await expect(
        service.registrarSalida(1, 15, 'Lote', undefined, 'almacen', 2),
      ).rejects.toThrow('Stock insuficiente');

      // Sin consumo parcial: solo se ejecutó la query del pre-check (sin UPDATEs)
      expect(mockDb.sql).toHaveBeenCalledTimes(1);
    });

    it('1.1 TRIANGULATE: loteId inexistente rechaza "Stock insuficiente" sin mutar', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // pre-check: lote no existe

      await expect(
        service.registrarSalida(1, 3, 'Lote', undefined, 'almacen', 999),
      ).rejects.toThrow('Stock insuficiente');

      expect(mockDb.sql).toHaveBeenCalledTimes(1);
    });

    it('1.1 TRIANGULATE: consume todo el lote objetivo y deja los demás intactos', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([mockLotes[1]])               // 1: pre-check SELECT lote 2
        .mockResolvedValueOnce([mockLotes[1]])               // 2: SELECT filtrado por id
        .mockResolvedValueOnce([])                           // 3: UPDATE lote 2 (consume 10 → 0)
        .mockResolvedValueOnce([{ precio_costo: 5 }])        // 4: SELECT next lot (lote 1 sigue con stock)
        .mockResolvedValueOnce([])                           // 5: UPDATE precio_costo
        .mockResolvedValueOnce([])                           // 6: INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 10 }])              // 7: SELECT SUM almacen (10+10-10)
        .mockResolvedValueOnce([]);                          // 8: UPDATE stock_almacen

      const consumos = await service.registrarSalida(1, 10, 'Lote', undefined, 'almacen', 2);

      expect(consumos).toHaveLength(1);
      expect(consumos[0]).toEqual({ lote_id: 2, cantidad: 10, precio_costo_real: 8 });

      // Único UPDATE al lote 2; el lote 1 no se tocó
      const lotUpdates = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE lotes_stock'),
      );
      expect(lotUpdates).toHaveLength(1);
      expect(lotUpdates[0]![1]).toEqual([10, 2]);
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
        .mockResolvedValueOnce(mockLotes)               // 0: SELECT lotes_stock (almacen)
        .mockResolvedValueOnce([])                      // 1: UPDATE lot 1 (consume 10)
        .mockResolvedValueOnce([])                      // 2: UPDATE lot 2 (consume 1)
        .mockResolvedValueOnce([{ precio_costo: 8 }])   // 3: SELECT next lot (sync tras _consumirFIFO)
        .mockResolvedValueOnce([])                      // 4: UPDATE precio_costo (sync)
        .mockResolvedValueOnce([])                      // 5: INSERT shop lot (10u from lot1)
        .mockResolvedValueOnce([])                      // 6: INSERT shop lot (1u from lot2)
        .mockResolvedValueOnce([{ precio_costo: 5 }])   // 7: SELECT next lot (re-sync tras insert shop)
        .mockResolvedValueOnce([])                      // 8: UPDATE precio_costo (re-sync)
        .mockResolvedValueOnce([])                      // 9: INSERT stock_movimiento 'traslado'
        .mockResolvedValueOnce([{ totalAlmacen: 9 }])   // 10: SELECT SUM almacen
        .mockResolvedValueOnce([{ totalShop: 11 }])     // 11: SELECT SUM shop
        .mockResolvedValueOnce([]);                     // 12: UPDATE productos dual

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

      // Should update both stock columns (call 13, 1-indexed)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        13,
        expect.stringContaining('SET stock_almacen = ?, stock_shop = ?'),
        expect.arrayContaining([9, 11, expect.any(String), 1]),
      );
    });

    it('4.1 RED: re-sincroniza precio_costo cuando el traslado agota todo el stock y los lotes shop nuevos son el frente', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([mockLotes[0]])          // 1: SELECT lotes_stock (almacen) — solo un lote de 10u
        .mockResolvedValueOnce([])                      // 2: UPDATE lot 1 (consume 10 -> 0, se agota todo)
        .mockResolvedValueOnce([])                      // 3: SELECT next lot (sync tras _consumirFIFO) -> vacío, sin UPDATE
        .mockResolvedValueOnce([])                      // 4: INSERT shop lot (10u from lot1, costo 5)
        .mockResolvedValueOnce([{ precio_costo: 5 }])   // 5: SELECT next lot (re-sync) -> el lote shop nuevo es el frente
        .mockResolvedValueOnce([])                      // 6: UPDATE productos.precio_costo = 5
        .mockResolvedValueOnce([])                      // 7: INSERT stock_movimiento 'traslado'
        .mockResolvedValueOnce([{ totalAlmacen: 0 }])   // 8: SELECT SUM almacen
        .mockResolvedValueOnce([{ totalShop: 10 }])     // 9: SELECT SUM shop
        .mockResolvedValueOnce([]);                     // 10: UPDATE productos dual

      const consumos = await service.registrarTraslado(1, 10);

      expect(consumos).toHaveLength(1);
      expect(consumos[0]).toEqual({ lote_id: 1, cantidad: 10, precio_costo_real: 5 });

      // El lote shop insertado es el nuevo frente FIFO -> precio_costo = costo del primer lote consumido
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([5, expect.any(String), 1]),
      );

      // El re-sync ocurre DESPUÉS de insertar el lote shop (el bug era que quedaba stale)
      const shopInsert = vi.mocked(mockDb.sql).mock.calls.findIndex(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO lotes_stock'),
      );
      const syncUpdate = vi.mocked(mockDb.sql).mock.calls.findIndex(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos SET precio_costo'),
      );
      expect(syncUpdate).toBeGreaterThan(shopInsert);
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
        .mockResolvedValueOnce([])                       // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                       // 2: UPDATE lot
        .mockResolvedValueOnce([{ precio_costo: 8 }])    // 3: SELECT next lot (sync precio_costo)
        .mockResolvedValueOnce([])                       // 4: UPDATE productos.precio_costo
        .mockResolvedValueOnce([{ total: 5 }])           // 5: SELECT SUM for shop
        .mockResolvedValueOnce([]);                      // 6: UPDATE stock_shop

      await service.registrarAjusteLote(1, 3, 2, 'Corrección de lote', 'shop');

      // Should update the specific lot (no updated_at — lotes_stock lacks that column)
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE lotes_stock SET cantidad = ?'),
        [2, 3],
      );

      // Should recalc stock_shop
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('SUM(cantidad)'),
        expect.arrayContaining([1, 'shop']),
      );

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining('stock_shop'),
        expect.arrayContaining([5, expect.any(String), 1]),
      );
    });

    it('debería recalcular stock_almacen cuando ubicacion=almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                       // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                       // 2: UPDATE lot
        .mockResolvedValueOnce([{ precio_costo: 5 }])    // 3: SELECT next lot (sync precio_costo)
        .mockResolvedValueOnce([])                       // 4: UPDATE productos.precio_costo
        .mockResolvedValueOnce([{ total: 15 }])          // 5: SELECT SUM for almacen
        .mockResolvedValueOnce([]);                      // 6: UPDATE stock_almacen

      await service.registrarAjusteLote(1, 1, 5, 'Ajuste almacen', 'almacen');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        6,
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
        .mockResolvedValueOnce([])               // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])               // 2: UPDATE lot
        .mockResolvedValueOnce([])               // 3: SELECT next lot -> sin lotes con stock, sin UPDATE
        .mockResolvedValueOnce([{ total: 10 }])  // 4: SELECT SUM
        .mockResolvedValueOnce([]);              // 5: UPDATE stock

      await service.registrarAjusteLote(1, 1, 5, 'Ajuste', 'shop');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 5, 'ajuste']),
      );
    });

    it('4.2 RED: agotar el lote del frente avanza precio_costo al siguiente lote', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                       // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                       // 2: UPDATE lot (frente -> cantidad 0)
        .mockResolvedValueOnce([{ precio_costo: 8 }])    // 3: SELECT next lot -> siguiente lote FIFO (costo 8)
        .mockResolvedValueOnce([])                       // 4: UPDATE productos.precio_costo = 8
        .mockResolvedValueOnce([{ total: 10 }])          // 5: SELECT SUM
        .mockResolvedValueOnce([]);                      // 6: UPDATE stock

      await service.registrarAjusteLote(1, 3, 0, 'Agotar lote frente', 'shop');

      // El frente quedó en 0 -> precio_costo avanza al siguiente lote FIFO
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([8, expect.any(String), 1]),
      );
    });
  });

  describe('registrarEditar', () => {
    it('debería actualizar producto precio_venta y lote precio_costo/cantidad', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                       // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                       // 2: UPDATE productos precio_venta
        .mockResolvedValueOnce([])                       // 3: UPDATE lotes_stock cantidad + precio_costo
        .mockResolvedValueOnce([{ precio_costo: 10 }])   // 4: SELECT next lot (sync precio_costo)
        .mockResolvedValueOnce([])                       // 5: UPDATE productos.precio_costo
        .mockResolvedValueOnce([{ total: 8 }])           // 6: SELECT SUM for shop
        .mockResolvedValueOnce([]);                      // 7: UPDATE stock_shop

      await service.registrarEditar(1, 3, 'Café Premium', 15, 10, 8, 'Actualización de precios', 'shop');

      // 1. Register movement
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 8, 'ajuste']),
      );

      // 2. Update product nombre + precio_venta
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE productos SET nombre'),
        ['Café Premium', 15, expect.any(String), 1],
      );

      // 3. Update lotes_stock cantidad + precio_costo
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE lotes_stock SET cantidad = ?, precio_costo = ?'),
        [8, 10, 3],
      );

      // 4. Recalc stock_shop
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining('stock_shop'),
        expect.arrayContaining([8, expect.any(String), 1]),
      );
    });

    it('5.0 RED: debería re-sincronizar productos.precio_costo al lote del frente FIFO tras editar', async () => {
      // Lote 1 (frente FIFO) con costo 100; la edición actualiza su precio_costo a 150.
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                      // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                      // 2: UPDATE productos nombre + precio_venta
        .mockResolvedValueOnce([])                      // 3: UPDATE lotes_stock cantidad + precio_costo (lote -> 150)
        .mockResolvedValueOnce([{ precio_costo: 150 }]) // 4: SELECT next lot -> el lote editado sigue siendo el frente
        .mockResolvedValueOnce([])                      // 5: UPDATE productos.precio_costo = 150
        .mockResolvedValueOnce([{ total: 8 }])          // 6: SELECT SUM
        .mockResolvedValueOnce([]);                     // 7: UPDATE stock

      await service.registrarEditar(1, 1, 'Café', 15, 150, 8, 'Actualización de precios', 'shop');

      // El frente FIFO tiene el costo editado -> productos.precio_costo se re-sincroniza
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE productos SET precio_costo'),
        expect.arrayContaining([150, expect.any(String), 1]),
      );

      // El bug de cache stale es imposible: el sync ocurre DESPUÉS del UPDATE del lote
      const lotUpdate = vi.mocked(mockDb.sql).mock.calls.findIndex(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE lotes_stock'),
      );
      const syncUpdate = vi.mocked(mockDb.sql).mock.calls.findIndex(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos SET precio_costo'),
      );
      expect(syncUpdate).toBeGreaterThan(lotUpdate);
    });

    it('debería rechazar motivo vacío', async () => {
      await expect(
        service.registrarEditar(1, 1, 'Café', 10, 5, 10, '', 'shop'),
      ).rejects.toThrow('El motivo es obligatorio');
    });

    it('debería rechazar nombre vacío', async () => {
      await expect(
        service.registrarEditar(1, 1, '', 10, 5, 10, 'Motivo', 'shop'),
      ).rejects.toThrow('El nombre del producto es obligatorio');
    });

    it('debería rechazar si el usuario no es admin', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      await expect(
        service.registrarEditar(1, 1, 'Café', 10, 5, 10, 'Motivo', 'shop'),
      ).rejects.toThrow('Solo administradores');
    });

    it('debería recalcular stock_almacen cuando ubicacion=almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                      // 1: INSERT stock_movimientos
        .mockResolvedValueOnce([])                      // 2: UPDATE productos precio_venta
        .mockResolvedValueOnce([])                      // 3: UPDATE lotes_stock
        .mockResolvedValueOnce([{ precio_costo: 6 }])   // 4: SELECT next lot (sync precio_costo)
        .mockResolvedValueOnce([])                      // 5: UPDATE productos.precio_costo
        .mockResolvedValueOnce([{ total: 20 }])         // 6: SELECT SUM for almacen
        .mockResolvedValueOnce([]);                     // 7: UPDATE stock_almacen

      await service.registrarEditar(1, 1, 'Café', 12, 6, 20, 'Edit almacen', 'almacen');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining('stock_almacen'),
        expect.arrayContaining([20, expect.any(String), 1]),
      );
    });
  });

  describe('registrarMerma', () => {
    it('debería rechazar motivo vacío con "El motivo es obligatorio"', async () => {
      await expect(
        service.registrarMerma(1, 5, ''),
      ).rejects.toThrow('El motivo es obligatorio');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('debería rechazar motivo con solo whitespace', async () => {
      await expect(
        service.registrarMerma(1, 5, '   '),
      ).rejects.toThrow('El motivo es obligatorio');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('debería pasar ubicacion a _consumirFIFO cuando ubicacion=almacen', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce(mockLotes)       // 1: SELECT lotes_stock for almacen
        .mockResolvedValueOnce([])               // 2: UPDATE lot 1 (consume 3 of 10)
        .mockResolvedValueOnce([{ precio_costo: 8 }]) // 3: SELECT next lot
        .mockResolvedValueOnce([])               // 4: UPDATE precio_costo
        .mockResolvedValueOnce([])               // 5: INSERT stock_movimientos
        .mockResolvedValueOnce([{ total: 17 }])  // 6: SELECT SUM almacen (10+10-3)
        .mockResolvedValueOnce([]);              // 7: UPDATE stock_almacen

      await service.registrarMerma(1, 3, 'Rotura', undefined, 'almacen');

      // Should filter by ubicacion='almacen'
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('ubicacion = ?'),
        expect.arrayContaining(['almacen']),
      );

      // Should update stock_almacen, not stock_shop
      const stockUpdates = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE productos'),
      );
      const stockUpdate = stockUpdates[stockUpdates.length - 1]!;
      expect(stockUpdate[0]).toContain('stock_almacen');
    });

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
      const stockUpdate = stockUpdates[1]!; // The second UPDATE is the stock column
      expect(stockUpdate[0]).toContain('stock_shop');
      const params = stockUpdate[1] as number[];
      expect(params[0]).toBe(1); // shop stock after consumption
    });

    it('debería lanzar "Stock insuficiente" si no hay suficientes lotes en shop', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce(mockShopLotes); // Only 8 in shop

      await expect(
        service.registrarMerma(1, 10, 'Rotura'),
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
      const stockUpdate = stockUpdates[stockUpdates.length - 1]!;
      expect(stockUpdate[0]).toContain('stock_shop');
      const params = stockUpdate[1] as number[];
      expect(params[0]).toBe(3);
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
