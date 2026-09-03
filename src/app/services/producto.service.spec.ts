import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from './producto.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { AuthService } from './auth.service';
import { DATABASE, type Database } from './database';
import type { Producto } from '../models';

const mockProductos: Producto[] = [
  {
    id: 1,
    nombre: 'Harina 0000 1kg',
    descripcion: 'Harina de trigo',
    precio_venta: 850,
    precio_costo: 550,
    stock_almacen: 50,
    stock_shop: 0,
    unidad_medida: 'unidad',
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
  {
    id: 2,
    nombre: 'Azúcar 1kg',
    descripcion: 'Azúcar blanca',
    precio_venta: 900,
    precio_costo: 600,
    stock_almacen: 40,
    stock_shop: 0,
    unidad_medida: 'unidad',
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
  {
    id: 3,
    nombre: 'Leche Entera 1L',
    descripcion: null,
    precio_venta: 1100,
    precio_costo: 750,
    stock_almacen: 30,
    stock_shop: 0,
    unidad_medida: 'unidad',
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
];

function createMockDb(): Database {
  const sql = vi.fn().mockResolvedValue([]) as unknown as Database['sql'];
  return {
    sql,
    transaction: vi.fn((fn) => fn({ sql: (q: string, p?: unknown[]) => sql(q, p) })),
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAuth(): { usuario: ReturnType<typeof vi.fn> } {
  return { usuario: vi.fn().mockReturnValue({ rol: 'admin' }) };
}

describe('ProductoService', () => {
  let mockDb: Database;
  let mockAuth: ReturnType<typeof createMockAuth>;
  let mockStockMovimiento: { registrarEntrada: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    mockAuth = createMockAuth();
    mockStockMovimiento = { registrarEntrada: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        ProductoService,
        { provide: DATABASE, useValue: mockDb },
        { provide: AuthService, useValue: mockAuth },
        { provide: StockMovimientoService, useValue: mockStockMovimiento },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listar', () => {
    it('debería retornar todos los productos ordenados', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue(mockProductos);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.listar());

      expect(resultado).toHaveLength(3);
      expect(resultado[0].nombre).toBe('Harina 0000 1kg');
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY nombre ASC'),
      );
    });

    it('debería retornar array vacío si no hay productos', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.listar());

      expect(resultado).toEqual([]);
    });
  });

  describe('buscar', () => {
    it('debería filtrar productos por nombre', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockProductos[0]]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.buscar('harina'));

      expect(resultado).toHaveLength(1);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('LIKE ?'),
        ['%harina%'],
      );
    });
  });

  describe('obtenerPorId', () => {
    it('debería retornar el producto si existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockProductos[1]]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerPorId(2));

      expect(resultado).toEqual(mockProductos[1]);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        [2],
      );
    });

    it('debería retornar null si no existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerPorId(999));

      expect(resultado).toBeNull();
    });
  });

  describe('crear', () => {
    it('debería insertar un nuevo producto con stock_almacen y stock_shop', async () => {
      const nuevoProducto: Producto = {
        id: 4,
        nombre: 'Nuevo Producto',
        descripcion: null,
        precio_venta: 1500,
        precio_costo: 1000,
        stock_almacen: 0,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };

      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.crear({
          nombre: 'Nuevo Producto',
          precio_costo: 1000,
          precio_venta: 1500,
          stock_almacen: 20,
          unidad_medida: 'unidad',
        }),
      );

      expect(resultado).toEqual(nuevoProducto);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO productos'),
        expect.arrayContaining([
          'Nuevo Producto',
          null,
          1000,
          1500,
          'unidad',
        ]),
      );
    });

    it('debería crear un lote FIFO en almacén cuando stock_almacen > 0', async () => {
      const nuevoProducto: Producto = {
        id: 5,
        nombre: 'Con Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_almacen: 10,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };

      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.crear({
          nombre: 'Con Stock',
          precio_costo: 300,
          precio_venta: 500,
          stock_almacen: 10,
          unidad_medida: 'unidad',
        }),
      );

      expect(resultado.id).toBe(5);
      // registrarEntrada should be called with ubicacion='almacen' default
      expect(mockStockMovimiento.registrarEntrada).toHaveBeenCalledWith(5, 10, 300);
    });

    it('no debería crear lote cuando stock_almacen es 0', async () => {
      const nuevoProducto: Producto = {
        id: 6,
        nombre: 'Sin Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_almacen: 0,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };

      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);

      const service = TestBed.inject(ProductoService);
      await firstValueFrom(
        service.crear({
          nombre: 'Sin Stock',
          precio_costo: 300,
          precio_venta: 500,
          stock_almacen: 0,
        }),
      );

      expect(mockStockMovimiento.registrarEntrada).not.toHaveBeenCalled();
    });

    it('RED: crear con costo negativo rechaza sin INSERT', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'Negativo',
            precio_costo: -5,
            precio_venta: 100,
            stock_almacen: 0,
          }),
        ),
      ).rejects.toThrow('El costo no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('RED: crear con precio de venta negativo rechaza sin INSERT', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'Negativo',
            precio_costo: 10,
            precio_venta: -100,
            stock_almacen: 0,
          }),
        ),
      ).rejects.toThrow('El precio de venta no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('RED: crear con precio NaN rechaza sin INSERT', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'Negativo',
            precio_costo: NaN,
            precio_venta: 100,
            stock_almacen: 0,
          }),
        ),
      ).rejects.toThrow('El costo no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('crear con precios en 0 procede al INSERT', async () => {
      const nuevoProducto: Producto = {
        id: 7,
        nombre: 'Gratis',
        descripcion: null,
        precio_venta: 0,
        precio_costo: 0,
        stock_almacen: 0,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.crear({
          nombre: 'Gratis',
          precio_costo: 0,
          precio_venta: 0,
          stock_almacen: 0,
        }),
      );

      expect(resultado).toEqual(nuevoProducto);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO productos'),
        expect.arrayContaining(['Gratis', null, 0, 0]),
      );
    });

    it('R1 RED: si registrarEntrada falla, crear rechaza y el INSERT corre dentro de transaction() (rollback del adapter, sin producto fantasma)', async () => {
      const nuevoProducto: Producto = {
        id: 8,
        nombre: 'Con Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_almacen: 5,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);
      mockStockMovimiento.registrarEntrada.mockRejectedValue(
        new Error('La cantidad debe ser mayor a cero'),
      );

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'Con Stock',
            precio_costo: 300,
            precio_venta: 500,
            stock_almacen: 5,
          }),
        ),
      ).rejects.toThrow('La cantidad debe ser mayor a cero');

      // El INSERT no queda huérfano: corre dentro de la MISMA transacción que
      // registrarEntrada; el ROLLBACK del adapter lo descarta (contrato T-08).
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockStockMovimiento.registrarEntrada).toHaveBeenCalledWith(8, 5, 300);
    });

    it('R1 TRIANGULATE: crear con stock corre INSERT y registrarEntrada dentro de UNA sola transacción', async () => {
      const nuevoProducto: Producto = {
        id: 9,
        nombre: 'Con Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_almacen: 5,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-07-23T19:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([nuevoProducto]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.crear({
          nombre: 'Con Stock',
          precio_costo: 300,
          precio_venta: 500,
          stock_almacen: 5,
        }),
      );

      expect(resultado.id).toBe(9);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockStockMovimiento.registrarEntrada).toHaveBeenCalledWith(9, 5, 300);
    });

    it('R2 RED: crear con usuario no-admin rechaza con "Solo administradores" sin tocar la DB', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'X',
            precio_costo: 100,
            precio_venta: 200,
            stock_almacen: 0,
          }),
        ),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('R2 TRIANGULATE: crear sin usuario logueado rechaza con "Solo administradores" sin tocar la DB', async () => {
      mockAuth.usuario.mockReturnValue(null);

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(
          service.crear({
            nombre: 'X',
            precio_costo: 100,
            precio_venta: 200,
            stock_almacen: 0,
          }),
        ),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('debería actualizar un producto existente y retornarlo', async () => {
      const productoActualizado: Producto = {
        id: 1,
        nombre: 'Harina 0000 1kg Editado',
        descripcion: 'Harina de trigo',
        precio_venta: 900,
        precio_costo: 600,
        stock_almacen: 50,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-06-02T22:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };

      vi.mocked(mockDb.sql).mockResolvedValue([productoActualizado]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.actualizar(1, {
          nombre: 'Harina 0000 1kg Editado',
          precio_costo: 600,
          precio_venta: 900,
        }),
      );

      expect(resultado).toEqual(productoActualizado);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([
          'Harina 0000 1kg Editado',
          600,
          900,
          1,
        ]),
      );
    });

    it('RED: actualizar con precio de venta negativo rechaza sin UPDATE', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.actualizar(1, {
            nombre: 'X',
            precio_costo: 10,
            precio_venta: -1,
          }),
        ),
      ).rejects.toThrow('El precio de venta no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('RED: actualizar con costo negativo rechaza sin UPDATE', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.actualizar(1, {
            nombre: 'X',
            precio_costo: -5,
            precio_venta: 10,
          }),
        ),
      ).rejects.toThrow('El costo no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('RED: actualizar con precio NaN rechaza sin UPDATE', async () => {
      const service = TestBed.inject(ProductoService);

      await expect(
        firstValueFrom(
          service.actualizar(1, {
            nombre: 'X',
            precio_costo: 10,
            precio_venta: NaN,
          }),
        ),
      ).rejects.toThrow('El precio de venta no puede ser negativo');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('actualizar con precios en 0 procede al UPDATE', async () => {
      const productoActualizado: Producto = {
        id: 1,
        nombre: 'Gratis',
        descripcion: null,
        precio_venta: 0,
        precio_costo: 0,
        stock_almacen: 50,
        stock_shop: 0,
        unidad_medida: 'unidad',
        created_at: '2026-06-02T22:00:00Z',
        updated_at: '2026-07-23T19:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([productoActualizado]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.actualizar(1, {
          nombre: 'Gratis',
          precio_costo: 0,
          precio_venta: 0,
        }),
      );

      expect(resultado).toEqual(productoActualizado);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining(['Gratis', 0, 0, 1]),
      );
    });

    it('R4 RED: actualizar con usuario no-admin rechaza con "Solo administradores" sin UPDATE', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(
          service.actualizar(1, {
            nombre: 'X',
            precio_costo: 10,
            precio_venta: 20,
          }),
        ),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('R4 TRIANGULATE: actualizar sin usuario logueado rechaza con "Solo administradores" sin UPDATE', async () => {
      mockAuth.usuario.mockReturnValue(null);

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(
          service.actualizar(1, {
            nombre: 'X',
            precio_costo: 10,
            precio_venta: 20,
          }),
        ),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('debería eliminar un producto por id', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.eliminar(1));

      expect(resultado).toBeUndefined();
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM productos'),
        [1],
      );
    });

    it('R3 RED: eliminar con usuario no-admin rechaza con "Solo administradores" sin borrar', async () => {
      mockAuth.usuario.mockReturnValue({ rol: 'trabajador' });

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(service.eliminar(1)),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('R3 TRIANGULATE: eliminar sin usuario logueado rechaza con "Solo administradores" sin borrar', async () => {
      mockAuth.usuario.mockReturnValue(null);

      const service = TestBed.inject(ProductoService);
      await expect(
        firstValueFrom(service.eliminar(1)),
      ).rejects.toThrow('Solo administradores');

      expect(mockDb.sql).not.toHaveBeenCalled();
    });

    it('F1 RED: debería bloquear eliminación cuando el producto tiene detalle_ventas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ total: 1 }]) // detalle_ventas
        .mockResolvedValueOnce([{ total: 0 }]); // cuenta_cosas

      const service = TestBed.inject(ProductoService);
      await expect(firstValueFrom(service.eliminar(1))).rejects.toThrow(
        'No se puede eliminar',
      );
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockDb.sql).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM productos'),
        [1],
      );
    });

    it('F1 RED: debería bloquear eliminación cuando el producto tiene cuenta_cosas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ total: 0 }]) // detalle_ventas
        .mockResolvedValueOnce([{ total: 1 }]); // cuenta_cosas

      const service = TestBed.inject(ProductoService);
      await expect(firstValueFrom(service.eliminar(1))).rejects.toThrow(
        'No se puede eliminar',
      );
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockDb.sql).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM productos'),
        [1],
      );
    });

    it('F1 RED: debería eliminar atómicamente en transaction cuando no hay historial', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ total: 0 }]) // detalle_ventas
        .mockResolvedValueOnce([{ total: 0 }]); // cuenta_cosas

      const service = TestBed.inject(ProductoService);
      await firstValueFrom(service.eliminar(1));

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // Los 4 DELETEs deben correr dentro de la transacción, en orden
      const queries = vi.mocked(mockDb.sql).mock.calls.map((c) => String(c[0]));
      const deleteIdx = queries
        .map((q, i) => (q.includes('DELETE FROM') ? i : -1))
        .filter((i) => i >= 0);
      expect(deleteIdx).toHaveLength(4);
      expect(queries[deleteIdx[0]]).toContain('DELETE FROM venta_lotes');
      expect(queries[deleteIdx[1]]).toContain('DELETE FROM stock_movimientos');
      expect(queries[deleteIdx[2]]).toContain('DELETE FROM lotes_stock');
      expect(queries[deleteIdx[3]]).toContain('DELETE FROM productos');
    });
  });

  describe('obtenerConteoEliminacion', () => {
    it('F9 RED: retorna el objeto completo con los 5 contadores (movimientos, lotes, venta_lotes y bloqueos por historial)', async () => {
      // Orden real de los COUNTs en la implementación: detalle_ventas,
      // cuenta_cosas, stock_movimientos, lotes_stock, venta_lotes.
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ total: 2 }]) // detalle_ventas
        .mockResolvedValueOnce([{ total: 1 }]) // cuenta_cosas
        .mockResolvedValueOnce([{ total: 5 }]) // stock_movimientos
        .mockResolvedValueOnce([{ total: 3 }]) // lotes_stock
        .mockResolvedValueOnce([{ total: 4 }]); // venta_lotes

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.obtenerConteoEliminacion(1),
      );

      expect(resultado).toEqual({
        movimientos: 5,
        lotes: 3,
        ventaLotes: 4,
        ventas: 2,
        cuentas: 1,
      });

      // 5 COUNTs sobre producto_id = ? en el orden de la implementación.
      expect(mockDb.sql).toHaveBeenCalledTimes(5);
      const queries = vi.mocked(mockDb.sql).mock.calls.map((c) => String(c[0]));
      expect(queries[0]).toContain('COUNT(*)');
      expect(queries[0]).toContain('FROM detalle_ventas');
      expect(queries[0]).toContain('producto_id = ?');
      expect(queries[1]).toContain('COUNT(*)');
      expect(queries[1]).toContain('FROM cuenta_cosas');
      expect(queries[1]).toContain('producto_id = ?');
      expect(queries[2]).toContain('COUNT(*)');
      expect(queries[2]).toContain('FROM stock_movimientos');
      expect(queries[2]).toContain('producto_id = ?');
      expect(queries[3]).toContain('COUNT(*)');
      expect(queries[3]).toContain('FROM lotes_stock');
      expect(queries[3]).toContain('producto_id = ?');
      expect(queries[4]).toContain('COUNT(*)');
      expect(queries[4]).toContain('FROM venta_lotes');
      expect(queries[4]).toContain('producto_id = ?');
      for (const [, params] of vi.mocked(mockDb.sql).mock.calls) {
        expect(params).toEqual([1]);
      }
    });

    it('F9 TRIANGULATE: filas con total undefined → todos los contadores en 0', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // detalle_ventas
        .mockResolvedValueOnce([{ total: undefined }]) // cuenta_cosas
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([{ total: undefined }]) // lotes_stock
        .mockResolvedValueOnce([]); // venta_lotes

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(
        service.obtenerConteoEliminacion(1),
      );

      expect(resultado).toEqual({
        movimientos: 0,
        lotes: 0,
        ventaLotes: 0,
        ventas: 0,
        cuentas: 0,
      });
    });
  });

  describe('obtenerInversionGlobal', () => {
    beforeEach(() => {
      vi.mocked(mockDb.sql).mockReset();
    });

    it('2.2 RED: debería retornar total_global, total_almacen y total_shop con datos seeded', async () => {
      // Seed data: three lots across 2 products and both ubicaciones
      // Product 1: almacen lot — cantidad=10, precio_costo=100 → 1000
      // Product 1: shop lot — cantidad=5, precio_costo=200 → 1000
      // Product 2: almacen lot — cantidad=20, precio_costo=50 → 1000
      const mockRows = [
        { total_global: 3000, total_almacen: 2000, total_shop: 1000 },
      ];
      vi.mocked(mockDb.sql).mockResolvedValue(mockRows);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerInversionGlobal());

      expect(resultado.total_global).toBe(3000);
      expect(resultado.total_almacen).toBe(2000);
      expect(resultado.total_shop).toBe(1000);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SUM(cantidad * precio_costo)'),
      );
    });

    it('2.2 TRIANGULATE: debería retornar ceros si no hay lotes activos', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([
        { total_global: 0, total_almacen: 0, total_shop: 0 },
      ]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerInversionGlobal());

      expect(resultado.total_global).toBe(0);
      expect(resultado.total_almacen).toBe(0);
      expect(resultado.total_shop).toBe(0);
    });
  });

  describe('obtenerInversionPorProducto', () => {
    beforeEach(() => {
      vi.mocked(mockDb.sql).mockReset();
    });

    it('2.3 RED: debería retornar inversión agrupada por producto', async () => {
      // Product 1: total_invertido = 2000
      // Product 2: total_invertido = 1000
      const mockRows = [
        { producto_id: 1, total_invertido: 2000 },
        { producto_id: 2, total_invertido: 1000 },
      ];
      vi.mocked(mockDb.sql).mockResolvedValue(mockRows);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerInversionPorProducto());

      expect(resultado).toHaveLength(2);
      expect(resultado[0].producto_id).toBe(1);
      expect(resultado[0].total_invertido).toBe(2000);
      expect(resultado[1].producto_id).toBe(2);
      expect(resultado[1].total_invertido).toBe(1000);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY producto_id'),
      );
    });

    it('2.3 TRIANGULATE: debería retornar array vacío si no hay lotes', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(ProductoService);
      const resultado = await firstValueFrom(service.obtenerInversionPorProducto());

      expect(resultado).toEqual([]);
    });
  });
});
