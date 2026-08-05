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
  stock_almacen: 50,
  stock_shop: 20,
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

const mockConsumos = [
  { lote_id: 1, cantidad: 2, precio_costo_real: 550 },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockStockService() {
  return {
    registrarSalida: vi.fn().mockResolvedValue(mockConsumos),
    registrarEntrada: vi.fn().mockResolvedValue(undefined),
    registrarAjuste: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VentaService', () => {
  let mockDb: Database;
  let mockStockService: ReturnType<typeof createMockStockService>;
  let service: VentaService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockStockService = createMockStockService();

    TestBed.configureTestingModule({
      providers: [
        VentaService,
        { provide: StockMovimientoService, useValue: mockStockService },
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    service = TestBed.inject(VentaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrar', () => {
    it('debería llamar a StockMovimientoService.registrarSalida por cada item', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle_ventas
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes item 1
        .mockResolvedValueOnce([])                       // 7: INSERT venta_lotes item 2
        .mockResolvedValueOnce([]);                      // 8: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'efectivo',
      }));

      expect(venta.id).toBe(1);
      expect(venta.total).toBe(2600);

      // Verify registrarSalida called for each item via mocked service
      expect(mockStockService.registrarSalida).toHaveBeenCalledTimes(2);
      expect(mockStockService.registrarSalida).toHaveBeenCalledWith(
        mockItems[0].producto.id, mockItems[0].cantidad,
      );
      expect(mockStockService.registrarSalida).toHaveBeenCalledWith(
        mockItems[1].producto.id, mockItems[1].cantidad,
      );
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
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle_ventas
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes item 1
        .mockResolvedValueOnce([])                       // 7: INSERT venta_lotes item 2
        .mockResolvedValueOnce([]);                      // 8: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: mockItems,
        usuarioId: 1,
        formaPago: 'efectivo',
      }));

      expect(venta.id).toBe(1);

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // _validarStock must run BEFORE BEGIN
      expect(allCalls[0][0]).toContain('SELECT stock_shop');
      expect(allCalls[1][0]).toContain('SELECT stock_shop');

      // BEGIN after validation, before writes
      expect(allCalls[2][0]).toContain('BEGIN TRANSACTION');

      // COMMIT at the end
      expect(allCalls[allCalls.length - 1][0]).toContain('COMMIT');
    });

    it('0.1 RED: debería hacer ROLLBACK si falla tras BEGIN y NO hacer COMMIT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 1: _validarStock item 2
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
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 0: _validarStock item 1 — ok
        .mockResolvedValueOnce([{ stock_shop: 0 }]);   // 1: _validarStock item 2 — sin stock

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

    // ─── 2.8 RED: divisas — INSERT + UPDATE jornadas con vuelto ────

    it('2.8 RED: debería incluir divisa_tipo, monto_divisa, tasa_cambio en el INSERT y descontar vuelto de saldo_esperado', async () => {
      // items: subtotal 850 → total 850
      // billete 5 USD @ 700 → 3500, vuelto = 2650
      // efectivoEnCaja = 0 - 2650 = -2650 (sale de caja)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ saldo_esperado: 5000 }]) // 2: SELECT saldo_esperado (guard)
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 850, divisa_tipo: 'USD', monto_divisa: 5, tasa_cambio: 700, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes
        .mockResolvedValueOnce([]);                      // 7: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 5,
        tasaCambio: 700,
      }));

      expect(venta.total).toBe(850);
      expect(venta.divisa_tipo).toBe('USD');
      expect(venta.monto_divisa).toBe(5);
      expect(venta.tasa_cambio).toBe(700);

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const updateJornada = allCalls.find(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      ) as [string, unknown[]] | undefined;
      expect(updateJornada).toBeDefined();
      // [total_ventas, efectivoEnCaja, updated_at, jornada_id]
      expect(updateJornada![1][0]).toBe(850);         // total_ventas += total
      expect(updateJornada![1][1]).toBe(-2650);        // saldo_esperado -= vuelto
    });

    it('2.8 RED: debería sumar completacionEfectivo al saldo_esperado cuando falta', async () => {
      // items: subtotal 850 → total 850
      // billete 1 USD @ 700 = 700, falta = 150
      // completacionEfectivo = 200, vuelto = 1*700-850 = -150 → no hay vuelto (Math.max(0, -150) = 0)
      // efectivoEnCaja = 200 - 0 = 200
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 850, divisa_tipo: 'USD', monto_divisa: 1, tasa_cambio: 700, completacion_efectivo: 200, created_at: '2026-06-04T10:00:00Z' }])  // 2: INSERT ventas
        .mockResolvedValueOnce([])                       // 3: INSERT detalle
        .mockResolvedValueOnce([])                       // 4: UPDATE jornada
        .mockResolvedValueOnce([])                       // 5: INSERT venta_lotes
        .mockResolvedValueOnce([]);                      // 6: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 1,
        tasaCambio: 700,
        completacionEfectivo: 200,
      }));

      expect(venta.total).toBe(850);
      expect(venta.completacion_efectivo).toBe(200);

      const allCalls = vi.mocked(mockDb.sql).mock.calls;
      const updateJornada = allCalls.find(
        (c) => c[0].includes('UPDATE') && c[0].includes('jornadas'),
      ) as [string, unknown[]] | undefined;
      expect(updateJornada).toBeDefined();
      expect(updateJornada![1][0]).toBe(850);         // total_ventas += total
      expect(updateJornada![1][1]).toBe(200);          // saldo_esperado += completacion
    });

    // ─── 2.9: pendiente INSERT + stock + UPDATE jornadas (incluye pendientes en saldo_esperado) ──

    it('2.9: debería INSERT venta, descontar stock Y actualizar jornada cuando formaPago=pendiente', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, comprador_nombre: 'Carlos', autorizado_por: 'María', descripcion: 'Pago quincenal', created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: INSERT venta_lotes item 1
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes item 2
        .mockResolvedValueOnce([])                       // 7: UPDATE jornadas (pendiente ahora actualiza saldo_esperado)
        .mockResolvedValueOnce([]);                      // 8: COMMIT

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
      expect(jornadaUpdates.length).toBe(1);
    });

    // ─── 2.2 RED: service guard — saldo_esperado antes de vuelto divisa ──

    it('2.2 RED: debería permitir divisa con vuelto cuando saldo_esperado >= vuelto', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ saldo_esperado: 5000 }]) // 2: SELECT saldo_esperado (guard)
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 850, divisa_tipo: 'USD', monto_divisa: 5, tasa_cambio: 700, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes
        .mockResolvedValueOnce([]);                      // 7: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 5,
        tasaCambio: 700,
      }));

      expect(venta.id).toBe(1);
      // vuelto = 5*700 - 850 = 2650, saldo_esperado = 5000 >= 2650 → OK
    });

    it('2.2 RED: debería rechazar divisa con vuelto cuando saldo_esperado < vuelto', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ saldo_esperado: 1000 }]); // 2: SELECT saldo_esperado (guard) — insuficiente

      await expect(
        firstValueFrom(service.registrar({
          jornadaId: 1,
          items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
          usuarioId: 1,
          formaPago: 'divisas',
          divisaTipo: 'USD',
          billeteRecibido: 5,
          tasaCambio: 700,
        })),
      ).rejects.toThrow('Saldo insuficiente');
      // vuelto = 5*700 - 850 = 2650, saldo = 1000 < 2650 → throw
    });

    it('2.2 RED: debería permitir divisa sin vuelto (pago exacto) sin validar saldo', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 850, divisa_tipo: 'USD', monto_divisa: 1, tasa_cambio: 850, created_at: '2026-06-04T10:00:00Z' }])  // 2: INSERT ventas
        .mockResolvedValueOnce([])                       // 3: INSERT detalle
        .mockResolvedValueOnce([])                       // 4: UPDATE jornada
        .mockResolvedValueOnce([])                       // 5: INSERT venta_lotes
        .mockResolvedValueOnce([]);                      // 6: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 1,
        tasaCambio: 850,
      }));

      expect(venta.id).toBe(1);
      // vuelto = 1*850 - 850 = 0 → no hay vuelto, no se valida saldo
    });

    it('2.2 RED: debería permitir efectivo sin validar saldo (no aplica guard)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 20 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 1700, created_at: '2026-06-04T10:00:00Z' }])  // 2: INSERT ventas
        .mockResolvedValueOnce([])                       // 3: INSERT detalle
        .mockResolvedValueOnce([])                       // 4: UPDATE jornada
        .mockResolvedValueOnce([])                       // 5: INSERT venta_lotes item 1
        .mockResolvedValueOnce([])                       // 6: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 2, subtotal: 1700 }],
        usuarioId: 1,
        formaPago: 'efectivo',
      }));

      expect(venta.id).toBe(1);
    });

    it('2.2 RED: debería rechazar divisa con vuelto cuando saldo_esperado === 0', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ saldo_esperado: 0 }]); // 2: SELECT saldo_esperado (guard) — insuficiente

      await expect(
        firstValueFrom(service.registrar({
          jornadaId: 1,
          items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
          usuarioId: 1,
          formaPago: 'divisas',
          divisaTipo: 'USD',
          billeteRecibido: 2,
          tasaCambio: 700,
        })),
      ).rejects.toThrow('Saldo insuficiente');
      // vuelto = 2*700 - 850 = 550, saldo = 0 < 550 → throw
    });

    it('2.2 RED: debería permitir divisa con saldo exacto al vuelto (borde exacto)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock
        .mockResolvedValueOnce([])                       // 1: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ saldo_esperado: 550 }]) // 2: SELECT saldo_esperado (guard)
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 850, divisa_tipo: 'USD', monto_divisa: 2, tasa_cambio: 700, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: UPDATE jornada
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes
        .mockResolvedValueOnce([]);                      // 7: COMMIT

      const venta = await firstValueFrom(service.registrar({
        jornadaId: 1,
        items: [{ producto: mockProducto, cantidad: 1, subtotal: 850 }],
        usuarioId: 1,
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 2,
        tasaCambio: 700,
      }));

      expect(venta.id).toBe(1);
      // vuelto = 2*700 - 850 = 550, saldo = 550 >= 550 → OK (borde exacto)
    });
    it('2.9: debería incluir comprador_nombre, autorizado_por, descripcion en el INSERT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 0: _validarStock item 1
        .mockResolvedValueOnce([{ stock_shop: 50 }])   // 1: _validarStock item 2
        .mockResolvedValueOnce([])                       // 2: BEGIN TRANSACTION
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, comprador_nombre: 'Ana', autorizado_por: 'Pedro', descripcion: null, created_at: '2026-06-04T10:00:00Z' }])  // 3: INSERT ventas
        .mockResolvedValueOnce([])                       // 4: INSERT detalle
        .mockResolvedValueOnce([])                       // 5: INSERT venta_lotes item 1
        .mockResolvedValueOnce([])                       // 6: INSERT venta_lotes item 2
        .mockResolvedValueOnce([])                       // 7: UPDATE jornadas (pendiente ahora actualiza saldo_esperado)
        .mockResolvedValueOnce([]);                      // 8: COMMIT

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
      expect(jornadaUpdates.length).toBe(1);
    });
  });
});
