import { TestBed } from '@angular/core/testing';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import type { StockMovimiento } from '../models';

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
    it('debería insertar un movimiento de entrada y aumentar el stock', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ stock_actual: 100 }]);

      await service.registrarEntrada(1, 50, 'Compra a proveedor');

      // INSERT en stock_movimientos — tipo 'entrada' va en el SQL, no en params
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO stock_movimientos"),
        expect.arrayContaining([1, 50, "Compra a proveedor"]),
      );

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("entrada"),
        expect.arrayContaining([1, 50, "Compra a proveedor"]),
      );

      // UPDATE stock_actual += cantidad
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE productos"),
        expect.arrayContaining([expect.any(String), 1]),
      );

      expect(mockDb.sql).toHaveBeenCalledTimes(2);
    });

    it("debería permitir registrar entrada sin motivo", async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ stock_actual: 100 }]);

      await service.registrarEntrada(1, 25);

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO stock_movimientos"),
        expect.arrayContaining([1, 25, null]),
      );
    });
  });

  describe('registrarSalida', () => {
    it('debería insertar un movimiento de salida y disminuir el stock', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 100 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.registrarSalida(1, 30, 'Venta al público');

      // Validar stock suficiente
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT stock_actual FROM productos'),
        [1],
      );

      // INSERT en stock_movimientos — tipo 'salida' va en SQL, no en params
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 30, 'Venta al público']),
      );

      // UPDATE stock_actual -= cantidad
      expect(mockDb.sql).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([expect.any(String), 1]),
      );

      expect(mockDb.sql).toHaveBeenCalledTimes(3);
    });

    it('debería lanzar "Stock insuficiente" cuando stock_actual < cantidad', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([{ stock_actual: 5 }]);

      await expect(
        service.registrarSalida(1, 10),
      ).rejects.toThrow('Stock insuficiente');

      // Solo debe haber hecho la consulta de validación, ni INSERT ni UPDATE
      expect(mockDb.sql).toHaveBeenCalledTimes(1);
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT stock_actual'),
        [1],
      );
    });
  });

  describe('registrarAjuste', () => {
    it('debería insertar un movimiento de ajuste y setear stock_actual a la cantidad exacta', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      await service.registrarAjuste(1, 80, 'Corrección de inventario');

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO stock_movimientos'),
        expect.arrayContaining([1, 80, 'Corrección de inventario']),
      );

      expect(mockDb.sql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining([80, expect.any(String), 1]),
      );

      expect(mockDb.sql).toHaveBeenCalledTimes(2);
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
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('WHERE producto_id = ?'),
        [999],
      );
    });
  });

  describe('obtenerHistorial', () => {
    it('debería retornar movimientos con nombre del producto', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue(mockHistorial);

      const resultado = await service.obtenerHistorial();

      expect(resultado).toHaveLength(3);
      expect(resultado[0]).toHaveProperty('nombre');
      expect(resultado[0].nombre).toBe('Harina 0000 1kg');
      expect(resultado[2].nombre).toBe('Azúcar 1kg');
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('JOIN productos'),
      );
    });
  });
});
