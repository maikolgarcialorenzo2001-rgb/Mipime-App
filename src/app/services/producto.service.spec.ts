import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from './producto.service';
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

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        ProductoService,
        { provide: DATABASE, useValue: mockDb },
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
});
