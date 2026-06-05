import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { VentaService } from './venta.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import type { CartItem } from './cart.service';
import type { Producto } from '../models';

const mockProducto: Producto = {
  id: 1,
  nombre: 'Harina 0000 1kg',
  descripcion: 'Harina de trigo',
  precio_venta: 850,
  precio_costo: 550,
  stock_actual: 50,
  created_at: '2026-06-02T22:00:00Z',
  updated_at: '2026-06-02T22:00:00Z',
};

const mockItems: CartItem[] = [
  { producto: mockProducto, cantidad: 2, subtotal: 1700 },
  {
    producto: { ...mockProducto, id: 2, nombre: 'Azúcar 1kg' },
    cantidad: 1,
    subtotal: 900,
  },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VentaService', () => {
  let mockDb: Database;
  let service: VentaService;
  let stockMovimientoService: StockMovimientoService;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        VentaService,
        StockMovimientoService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    service = TestBed.inject(VentaService);
    stockMovimientoService = TestBed.inject(StockMovimientoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrar', () => {
    it('debería llamar a StockMovimientoService.registrarSalida por cada item', async () => {
      // Mock: _validarStock (2) + BEGIN (1) + 4 internas + registrarSalida (6) + COMMIT (1) = 14
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle_ventas
        .mockResolvedValueOnce([])                       // 5: UPDATE stock productos
        .mockResolvedValueOnce([]);                      // 6: UPDATE jornada

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 7: SELECT stock item 1 (registrarSalida)
        .mockResolvedValueOnce([])                       // 8: INSERT movimiento item 1
        .mockResolvedValueOnce([])                       // 9: UPDATE stock item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 10: SELECT stock item 2 (registrarSalida)
        .mockResolvedValueOnce([])                       // 11: INSERT movimiento item 2
        .mockResolvedValueOnce([])                       // 12: UPDATE stock item 2
        .mockResolvedValueOnce([]);                      // 13: COMMIT

      const venta = await firstValueFrom(service.registrar(1, mockItems, 1, 'efectivo'));

      expect(venta.id).toBe(1);
      expect(venta.total).toBe(2600);

      // Verificar que se llamó a registrarSalida para cada item
      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Call 7 (0-based) = SELECT stock_actual for producto 1 (from registrarSalida)
      expect(allCalls[7][0]).toContain('SELECT stock_actual');
      expect(allCalls[7][1]).toEqual([mockItems[0].producto.id]);

      // Call 10 (0-based) = SELECT stock_actual for producto 2 (from registrarSalida)
      expect(allCalls[10][0]).toContain('SELECT stock_actual');
      expect(allCalls[10][1]).toEqual([mockItems[1].producto.id]);

      // El INSERT debe incluir usuario_id y forma_pago
      const insertVenta = allCalls[3];
      expect(insertVenta[0]).toContain('usuario_id');
      expect(insertVenta[0]).toContain('forma_pago');
      expect(insertVenta[1]).toContain(1); // usuarioId
      expect(insertVenta[1]).toContain('efectivo'); // formaPago
    });

    it('2.1 RED: debería rechazar si usuarioId es falsy', async () => {
      await expect(
        firstValueFrom(service.registrar(1, mockItems, 0, 'efectivo')),
      ).rejects.toThrow('Usuario no autenticado');

      await expect(
        firstValueFrom(service.registrar(1, mockItems, null as unknown as number, 'efectivo')),
      ).rejects.toThrow('Usuario no autenticado');
    });

    it('0.1 RED: debería ejecutar BEGIN/COMMIT envolviendo todas las escrituras', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_actual: 40 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle_ventas
        .mockResolvedValueOnce([])                       // 5: UPDATE stock productos
        .mockResolvedValueOnce([])                       // 6: UPDATE jornada
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 7: registrarSalida SELECT item 1
        .mockResolvedValueOnce([])                       // 8: registrarSalida INSERT
        .mockResolvedValueOnce([])                       // 9: registrarSalida UPDATE
        .mockResolvedValueOnce([{ stock_actual: 40 }])  // 10: registrarSalida SELECT item 2
        .mockResolvedValueOnce([])                       // 11: registrarSalida INSERT
        .mockResolvedValueOnce([])                       // 12: registrarSalida UPDATE
        .mockResolvedValueOnce([]);                      // 13: COMMIT

      const venta = await firstValueFrom(service.registrar(1, mockItems, 1, 'efectivo'));

      expect(venta.id).toBe(1);

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // _validarStock must run BEFORE BEGIN
      expect(allCalls[0][0]).toContain('SELECT stock_actual');
      expect(allCalls[1][0]).toContain('SELECT stock_actual');

      // BEGIN after validation, before writes
      expect(allCalls[2][0]).toContain('BEGIN TRANSACTION');

      // COMMIT at the end
      expect(allCalls[allCalls.length - 1][0]).toContain('COMMIT');
    });

    it('0.1 RED: debería hacer ROLLBACK si falla tras BEGIN y NO hacer COMMIT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_actual: 40 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockRejectedValueOnce(new Error('DB error'))    // 3: INSERT ventas falla
        .mockResolvedValueOnce([]);                      // 4: ROLLBACK

      await expect(firstValueFrom(service.registrar(1, mockItems, 1, 'efectivo')))
        .rejects.toThrow('DB error');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // ROLLBACK debe haberse ejecutado
      const rollbackCall = allCalls.find((c) => c[0].includes('ROLLBACK'));
      expect(rollbackCall).toBeDefined();

      // COMMIT NO debe haberse ejecutado
      const commitCalls = allCalls.filter((c) => c[0] === 'COMMIT');
      expect(commitCalls.length).toBe(0);
    });

    it('0.1 RED: debería rechazar con stock insuficiente en _validarStock (sin BEGIN)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1 — ok
        .mockResolvedValueOnce([{ stock_actual: 0 }]);   // 1: _validarStock item 2 — sin stock

      await expect(
        firstValueFrom(service.registrar(1, mockItems, 1, 'efectivo')),
      ).rejects.toThrow('Stock insuficiente');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // BEGIN TRANSACTION NO debe haberse llamado
      const beginCalls = allCalls.filter((c) => c[0].includes('BEGIN TRANSACTION'));
      expect(beginCalls.length).toBe(0);
    });
  });
});
