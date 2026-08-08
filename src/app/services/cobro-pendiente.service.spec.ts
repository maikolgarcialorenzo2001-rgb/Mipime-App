import { TestBed } from '@angular/core/testing';
import { CobroPendienteService, type CobroOpciones } from './cobro-pendiente.service';
import { DATABASE, type Database } from './database';
import type { Venta } from '../models';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function ventaPendiente(overrides: Partial<Venta> = {}): Venta {
  return {
    id: 1,
    jornada_id: 7,
    fecha_hora: '2026-08-05T10:00:00Z',
    total: 1000,
    usuario_id: 1,
    forma_pago: 'pendiente',
    comprador_nombre: 'Carlos',
    created_at: '2026-08-05T10:00:00Z',
    ...overrides,
  };
}

describe('CobroPendienteService', () => {
  let mockDb: Database;
  let service: CobroPendienteService;

  beforeEach(() => {
    mockDb = createMockDb();
    TestBed.configureTestingModule({
      providers: [
        CobroPendienteService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
    service = TestBed.inject(CobroPendienteService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listarPendientes', () => {
    it('RED: lista pendientes del mismo día y de días previos, ordenados por fecha desc', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([
          { id: 2, comprador_nombre: 'Ana', fecha_hora: '2026-08-05T11:00:00Z', total: 500, jornada_id: 1 },
          { id: 1, comprador_nombre: 'Carlos', fecha_hora: '2026-08-03T09:00:00Z', total: 1000, jornada_id: 2 },
        ]);

      const items = await service.listarPendientes();

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        id: 2,
        compradorNombre: 'Ana',
        fechaHora: '2026-08-05T11:00:00Z',
        total: 500,
        jornadaId: 1,
        autorizadoPor: null,
        descripcion: null,
      });
      expect(items[1].fechaHora).toBe('2026-08-03T09:00:00Z');

      const [query] = vi.mocked(mockDb.sql).mock.calls[0];
      // La query es GLOBAL (sin filtro de jornada) y excluye los ya cobrados
      expect(String(query)).toContain("forma_pago = 'pendiente'");
      expect(String(query)).toContain('pagado_en IS NULL');
      expect(String(query)).toContain('ORDER BY fecha_hora DESC');
      expect(String(query)).not.toContain('jornada_id =');
    });

    it('RED: excluye los ya cobrados (filtro pagado_en IS NULL en la query)', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 3, comprador_nombre: null, fecha_hora: '2026-08-05T08:00:00Z', total: 700, jornada_id: 1 },
      ]);

      const items = await service.listarPendientes();

      // sol o el pendiente sin pagado_en entra al resultado
      expect(items.map((i) => i.id)).toEqual([3]);
      // el filtro anti-cobrados es parte del SQL emitido por el servicio
      const [query] = vi.mocked(mockDb.sql).mock.calls[0];
      expect(String(query)).toContain('AND pagado_en IS NULL');
    });

    it('RED: devuelve lista vacía cuando no hay pendientes sin cobrar', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]);

      const items = await service.listarPendientes();

      expect(items).toEqual([]);
    });

    it('RED: preserva comprador_nombre null como compradorNombre null (fallback en UI)', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 5, comprador_nombre: null, fecha_hora: '2026-08-04T12:00:00Z', total: 300, jornada_id: 2 },
      ]);

      const items = await service.listarPendientes();

      expect(items[0].compradorNombre).toBeNull();
    });

    it('RED: mapea autorizadoPor y descripcion desde autorizado_por/descripcion y el SELECT las incluye', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 8, comprador_nombre: 'María', fecha_hora: '2026-08-05T10:00:00Z', total: 1200, jornada_id: 1, autorizado_por: 'María', descripcion: 'Se lo lleva en cuenta' },
      ]);

      const items = await service.listarPendientes();

      expect(items[0].autorizadoPor).toBe('María');
      expect(items[0].descripcion).toBe('Se lo lleva en cuenta');

      // el SELECT emitido incluye ambas columnas y conserva el filtro (REQ-1 + REQ-6)
      const [query] = vi.mocked(mockDb.sql).mock.calls[0];
      expect(String(query)).toContain('autorizado_por');
      expect(String(query)).toContain('descripcion');
      expect(String(query)).toContain("forma_pago = 'pendiente'");
      expect(String(query)).toContain('pagado_en IS NULL');
    });

    it('RED: autorizado_por/descripcion null se mapean como null (detalle oculto en UI)', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        { id: 9, comprador_nombre: null, fecha_hora: '2026-08-04T12:00:00Z', total: 300, jornada_id: 2, autorizado_por: null, descripcion: null },
      ]);

      const items = await service.listarPendientes();

      expect(items[0].autorizadoPor).toBeNull();
      expect(items[0].descripcion).toBeNull();
    });
  });

  describe('registrarCobroPendiente', () => {
    function opciones(overrides: Partial<CobroOpciones> = {}): CobroOpciones {
      return { jornadaId: 10, usuarioId: 3, formaPago: 'efectivo', ...overrides };
    }

    it('RED: cobro efectivo — inserta venta sin detalles, marca original y suma a jornada', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                                                        // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente()])                                        // 1: guard
        .mockResolvedValueOnce([
          { id: 101, jornada_id: 10, fecha_hora: '2026-08-05T15:00:00Z', total: 1000, usuario_id: 1, forma_pago: 'efectivo', cobro_de_venta_id: 1, created_at: '2026-08-05T15:00:00Z' },
        ])                                                                                  // 2: INSERT venta cobro
        .mockResolvedValueOnce([])                                                        // 3: UPDATE original
        .mockResolvedValueOnce([])                                                        // 4: UPDATE jornada
        .mockResolvedValueOnce([]);                                                       // 5: COMMIT

      const venta = await service.registrarCobroPendiente(1, opciones());

      expect(venta.id).toBe(101);
      expect(venta.cobro_de_venta_id).toBe(1); // el cobro apunta al pendiente original

      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // original marcado (pagado_en + cobro_de_venta_id), nunca recibe dinero
      const updateOriginal = allCalls.find(
        (c) => String(c[0]).includes('UPDATE ventas') && String(c[0]).includes('pagado_en'),
      );
      expect(updateOriginal).toBeDefined();
      expect(String(updateOriginal![0])).toContain('cobro_de_venta_id');

      // jornada: total_ventas += total, saldo_esperado += netCash(efectivo=total)
      const updateJornada = allCalls.find(
        (c) => String(c[0]).includes('UPDATE') && String(c[0]).includes('jornadas'),
      ) as [string, unknown[]];
      expect(updateJornada![1]![0]).toBe(1000);
      expect(updateJornada![1]![1]).toBe(1000);

      // COMMIT al final, sin INSERT de detalles/stock
      expect(allCalls[allCalls.length - 1][0]).toContain('COMMIT');
      const tieneDetalles = allCalls.some((c) => String(c[0]).includes('detalle_ventas'));
      expect(tieneDetalles).toBe(false);
    });

    it('RED: cobro divisas con vuelto — netCash espeja VentaService._ejecutar (completacion - vuelto)', async () => {
      // pendiente total 850; billete 2 USD @700=1400 → vuelto 550, saldo caja 500 OK
      // netCash = completacion 0 - max(0, 550) = -550 (sale de caja)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente({ total: 850 })]) // 1: guard
        .mockResolvedValueOnce([{ saldo_esperado: 600 }])        // 2: guard saldo (vuelto>0)
        .mockResolvedValueOnce([
          { id: 201, jornada_id: 10, fecha_hora: '2026-08-05T15:00:00Z', total: 850, usuario_id: 1, forma_pago: 'divisas', divisa_tipo: 'USD', monto_divisa: 2, tasa_cambio: 700, cobro_de_venta_id: 1, created_at: '2026-08-05T15:00:00Z' },   // 3: INSERT
        ])
        .mockResolvedValueOnce([])                                // 4: UPDATE original
        .mockResolvedValueOnce([])                                // 5: UPDATE jornada
        .mockResolvedValueOnce([]);                               // 6: COMMIT

      const venta = await service.registrarCobroPendiente(1, opciones({
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 2,
        tasaCambio: 700,
      }));

      expect(venta.total).toBe(850);
      expect(venta.divisa_tipo).toBe('USD');

      const updateJornada = vi.mocked(mockDb.sql).mock.calls.find(
        (c) => String(c[0]).includes('UPDATE') && String(c[0]).includes('jornadas'),
      ) as [string, unknown[]];
      expect(updateJornada![1]![0]).toBe(850);  // total_ventas += total
      expect(updateJornada![1]![1]).toBe(-550); // netCash = 0 - 550
    });

    it('RED: cobro divisas pago exacto — sin consulta de saldo y netCash 0', async () => {
      // pendiente total 850; billete 1 EUR @850=850 → vuelto 0 → no hay guard de saldo
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente({ total: 850 })]) // 1: guard
        .mockResolvedValueOnce([
          { id: 301, jornada_id: 10, fecha_hora: '2026-08-05T15:00:00Z', total: 850, usuario_id: 1, forma_pago: 'divisas', divisa_tipo: 'EUR', monto_divisa: 1, tasa_cambio: 850, cobro_de_venta_id: 1, created_at: '2026-08-05T15:00:00Z' },
        ])   // 2: INSERT (sin consulta de saldo previa)
        .mockResolvedValueOnce([])                 // 3: UPDATE original
        .mockResolvedValueOnce([])                 // 4: UPDATE jornada
        .mockResolvedValueOnce([]);                // 5: COMMIT

      const venta = await service.registrarCobroPendiente(1, opciones({
        formaPago: 'divisas',
        divisaTipo: 'EUR',
        billeteRecibido: 1,
        tasaCambio: 850,
      }));

      expect(venta.divisa_tipo).toBe('EUR');

      const calls = vi.mocked(mockDb.sql).mock.calls;
      // el guard de saldo NO se ejecutó (vuelto 0)
      const saldoQuery = calls.find(
        (c) =>
          String(c[0]).includes('SELECT saldo_esperado') &&
          String(c[0]).includes('FROM jornadas'),
      );
      expect(saldoQuery).toBeUndefined();

      const updateJornada = calls.find(
        (c) => String(c[0]).includes('UPDATE') && String(c[0]).includes('jornadas'),
      ) as [string, unknown[]];
      expect(updateJornada![1]![1]).toBe(0); // netCash 0
    });

    it('RED: transferencia — netCash 0, total cuenta en total_ventas, sin detalles', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente()]) // 1: guard
        .mockResolvedValueOnce([
          { id: 401, jornada_id: 10, fecha_hora: '2026-08-05T15:00:00Z', total: 1000, usuario_id: 1, forma_pago: 'transferencia', cobro_de_venta_id: 1, created_at: '2026-08-05T15:00:00Z' },
        ])                                          // 2: INSERT
        .mockResolvedValueOnce([])                  // 3: UPDATE original
        .mockResolvedValueOnce([])                  // 4: UPDATE jornada
        .mockResolvedValueOnce([]);                 // 5: COMMIT

      const venta = await service.registrarCobroPendiente(1, opciones({ formaPago: 'transferencia' }));

      expect(venta.forma_pago).toBe('transferencia');

      const updateJornada = vi.mocked(mockDb.sql).mock.calls.find(
        (c) => String(c[0]).includes('UPDATE') && String(c[0]).includes('jornadas'),
      ) as [string, unknown[]];
      expect(updateJornada![1]![0]).toBe(1000); // total_ventas += total
      expect(updateJornada![1]![1]).toBe(0);    // netCash 0
    });

    it('RED: doble cobro — segundo intento falla con "Pendiente ya cobrado" y hace ROLLBACK sin COMMIT', async () => {
      // el guard no encuentra el pendiente con pagado_en IS NULL (ya cobrado)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([]);                // 1: guard -> vacío

      await expect(service.registrarCobroPendiente(1, opciones()))
        .rejects.toThrow('Pendiente ya cobrado');

      const calls = vi.mocked(mockDb.sql).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('ROLLBACK'))).toBe(true);
      expect(calls.some((c) => String(c[0]) === 'COMMIT')).toBe(false);
    });

    it('RED: pendiente no encontrado -> throw + ROLLBACK sin COMMIT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([]);                // 1: guard -> no existe

      await expect(service.registrarCobroPendiente(99, opciones()))
        .rejects.toThrow('Pendiente ya cobrado');

      const calls = vi.mocked(mockDb.sql).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('ROLLBACK'))).toBe(true);
      expect(calls.some((c) => String(c[0]) === 'COMMIT')).toBe(false);
    });

    it('RED: fallo mid-transacción -> ROLLBACK rethrow sin COMMIT', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                 // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente()]) // 1: guard
        .mockRejectedValueOnce(new Error('DB caído')); // 2: INSERT falla

      await expect(service.registrarCobroPendiente(1, opciones()))
        .rejects.toThrow('DB caído');

      const calls = vi.mocked(mockDb.sql).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('ROLLBACK'))).toBe(true);
      expect(calls.some((c) => String(c[0]) === 'COMMIT')).toBe(false);
    });

    it('RED: divisa con vuelto > saldo_esperado bloquea el cobro (guard de caja)', async () => {
      // pendiente 850; billete 2 USD @700=1400 => vuelto 550; saldo caja 100 < 550
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([])                              // 0: BEGIN
        .mockResolvedValueOnce([ventaPendiente({ total: 850 })]) // 1: guard
        .mockResolvedValueOnce([{ saldo_esperado: 100 }]);      // 2: guard saldo insuficiente

      await expect(service.registrarCobroPendiente(1, opciones({
        formaPago: 'divisas',
        divisaTipo: 'USD',
        billeteRecibido: 2,
        tasaCambio: 700,
      }))).rejects.toThrow('Saldo insuficiente');

      const calls = vi.mocked(mockDb.sql).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('ROLLBACK'))).toBe(true);
      // NO se insertó venta de cobro
      const insert = calls.find((c) => String(c[0]).includes('INSERT INTO ventas'));
      expect(insert).toBeUndefined();
      expect(calls.some((c) => String(c[0]) === 'COMMIT')).toBe(false);
    });
  });
});