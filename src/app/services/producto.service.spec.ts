import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from './producto.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import type { Producto } from '../models';

const mockProductos: Producto[] = [
  {
    id: 1,
    nombre: 'Harina 0000 1kg',
    descripcion: 'Harina de trigo',
    precio_venta: 850,
    precio_costo: 550,
    stock_actual: 50,
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
  {
    id: 2,
    nombre: 'Azúcar 1kg',
    descripcion: 'Azúcar blanca',
    precio_venta: 900,
    precio_costo: 600,
    stock_actual: 40,
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
  {
    id: 3,
    nombre: 'Leche Entera 1L',
    descripcion: null,
    precio_venta: 1100,
    precio_costo: 750,
    stock_actual: 30,
    created_at: '2026-06-02T22:00:00Z',
    updated_at: '2026-06-02T22:00:00Z',
  },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ProductoService', () => {
  let mockDb: Database;
  let mockStockMovimiento: { registrarEntrada: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    mockStockMovimiento = { registrarEntrada: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        ProductoService,
        { provide: DATABASE, useValue: mockDb },
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
    it('debería insertar un nuevo producto y retornarlo', async () => {
      const nuevoProducto: Producto = {
        id: 4,
        nombre: 'Nuevo Producto',
        descripcion: null,
        precio_venta: 1500,
        precio_costo: 1000,
        stock_actual: 20,
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
          stock_actual: 20,
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
        ]),
      );
    });

    it('debería crear un lote FIFO cuando stock_actual > 0', async () => {
      const nuevoProducto: Producto = {
        id: 5,
        nombre: 'Con Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_actual: 10,
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
          stock_actual: 10,
        }),
      );

      expect(resultado.id).toBe(5);
      expect(mockStockMovimiento.registrarEntrada).toHaveBeenCalledWith(5, 10, 300);
    });

    it('no debería crear lote cuando stock_actual es 0', async () => {
      const nuevoProducto: Producto = {
        id: 6,
        nombre: 'Sin Stock',
        descripcion: null,
        precio_venta: 500,
        precio_costo: 300,
        stock_actual: 0,
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
          stock_actual: 0,
        }),
      );

      expect(mockStockMovimiento.registrarEntrada).not.toHaveBeenCalled();
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
        stock_actual: 50,
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
  });
});
