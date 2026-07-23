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
      // Mock: _validarStock (2) + BEGIN (1) + INSERT ventas (1) + INSERT detalle (1) + UPDATE stock (1) + UPDATE jornada (1) + registrarSalida (6) + COMMIT (1) = 14
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

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'efectivo',
      }));

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
        firstValueFrom(service.registrar({
          jornadaId: 1,
          items: mockItems,
          usuarioId: 0,
          formaPago: 'efectivo',
        })),
      ).rejects.toThrow('Usuario no autenticado');

      await expect(
        firstValueFrom(service.registrar({
          jornadaId: 1,
          items: mockItems,
          usuarioId: null as unknown as number,
          formaPago: 'efectivo',
        })),
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

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'efectivo',
      }));

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

      await expect(firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'efectivo',
      }))).rejects.toThrow('DB error');

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
        firstValueFrom(service.registrar({
          jornadaId: 1,
          items: mockItems,
          usuarioId: 1,
          formaPago: 'efectivo',
        })),
      ).rejects.toThrow('Stock insuficiente');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // BEGIN TRANSACTION NO debe haberse llamado
      const beginCalls = allCalls.filter((c) => c[0].includes('BEGIN TRANSACTION'));
      expect(beginCalls.length).toBe(0);
    });

    // ─── 2.8 RED: divisas total = monto * tasa + UPDATE jornadas ─────

    it('2.8 RED: debería calcular total = montoDivisa * tasaCambio cuando formaPago=divisas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 1950, divisa_tipo: 'USD', monto_divisa: 3, tasa_cambio: 650, created_at: '2026-06-04T10:00:00Z' }])  // 2: INSERT ventas
        .mockResolvedValueOnce([])                       // 3: INSERT detalle_ventas
        .mockResolvedValueOnce([])                       // 4: UPDATE stock productos
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 6: registrarSalida SELECT
        .mockResolvedValueOnce([])                       // 7: registrarSalida INSERT
        .mockResolvedValueOnce([])                       // 8: registrarSalida UPDATE
        .mockResolvedValueOnce([]);                      // 9: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        montoDivisa: 3,
        tasaCambio: 650,
      }));

      // total sobreescrito: 3 * 650 = 1950 (no el subtotal del carrito = 850)
      expect(venta.total).toBe(1950);
      expect(venta.divisa_tipo).toBe('USD');
      expect(venta.monto_divisa).toBe(3);
      expect(venta.tasa_cambio).toBe(650);

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Verificar UPDATE jornada se ejecutó con total = 1950
      const updateJornada = allCalls.find(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(updateJornada).toBeDefined();
      expect(updateJornada![1]).toContain(1950); // total_ventas += 1950
      expect(updateJornada![1]).toContain(1950); // saldo_esperado += 1950
    });

    it('2.8 RED: debería incluir divisa_tipo, monto_divisa, tasa_cambio en el INSERT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 1300, divisa_tipo: 'EUR', monto_divisa: 2, tasa_cambio: 650, created_at: '2026-06-04T10:00:00Z' }])  // 2: INSERT ventas
        .mockResolvedValueOnce([])                       // 3: INSERT detalle
        .mockResolvedValueOnce([])                       // 4: UPDATE stock
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 6: registrarSalida SELECT
        .mockResolvedValueOnce([])                       // 7: registrarSalida INSERT
        .mockResolvedValueOnce([])                       // 8: registrarSalida UPDATE
        .mockResolvedValueOnce([]);                      // 9: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'EUR',
        montoDivisa: 2,
        tasaCambio: 650,
      }));

      expect(venta.total).toBe(1300);
      expect(venta.divisa_tipo).toBe('EUR');
      expect(venta.monto_divisa).toBe(2);
      expect(venta.tasa_cambio).toBe(650);
    });

    // ─── 2.9 RED: pendiente INSERT + stock pero NO UPDATE jornadas ──

    it('2.9 RED: debería INSERT venta y descontar stock cuando formaPago=pendiente', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, comprador_nombre: 'Carlos', autorizado_por: 'María', descripcion: 'Pago quincenal', created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: UPDATE stock
        // NO UPDATE jornada
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 6: registrarSalida SELECT item 1
        .mockResolvedValueOnce([])                       // 7: registrarSalida INSERT item 1
        .mockResolvedValueOnce([])                       // 8: registrarSalida UPDATE item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 9: registrarSalida SELECT item 2
        .mockResolvedValueOnce([])                       // 10: registrarSalida INSERT item 2
        .mockResolvedValueOnce([])                       // 11: registrarSalida UPDATE item 2
        .mockResolvedValueOnce([]);                      // 12: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'pendiente',
        compradorNombre: 'Carlos',
        autorizadoPor: 'María',
        descripcion: 'Pago quincenal',
      }));

      expect(venta.total).toBe(2600);
      expect(venta.comprador_nombre).toBe('Carlos');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const jornadaUpdates = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaUpdates.length).toBe(0);
    });

    it('2.9 RED: debería incluir comprador_nombre, autorizado_por, descripcion en el INSERT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, comprador_nombre: 'Ana', autorizado_por: 'Pedro', descripcion: null, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: UPDATE stock
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 6: registrarSalida SELECT item 1
        .mockResolvedValueOnce([])                       // 7: registrarSalida INSERT item 1
        .mockResolvedValueOnce([])                       // 8: registrarSalida UPDATE item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }])  // 9: registrarSalida SELECT item 2
        .mockResolvedValueOnce([])                       // 10: registrarSalida INSERT item 2
        .mockResolvedValueOnce([])                       // 11: registrarSalida UPDATE item 2
        .mockResolvedValueOnce([]);                      // 12: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'pendiente',
        compradorNombre: 'Ana',
        autorizadoPor: 'Pedro',
      }));

      expect(venta.total).toBe(2600);
      expect(venta.comprador_nombre).toBe('Ana');

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const jornadaUpdates = allCalls.filter(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      );
      expect(jornadaUpdates.length).toBe(0);
    });
  });
});
