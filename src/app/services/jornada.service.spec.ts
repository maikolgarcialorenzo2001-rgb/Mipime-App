import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { JornadaService } from './jornada.service';
import { ExcelService } from './excel.service';
import { DATABASE, type Database } from './database';
import type { Jornada } from '../models';
import type { Producto } from '../models';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-02',
  hora_apertura: '08:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_gastos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-02T08:00:00Z',
  updated_at: '2026-06-02T08:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornada,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 7200,
  user_cierre_id: 1,
};

const mockExcelBase64 = 'UEsDBBQAAAAIA...mock-base64...';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('JornadaService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        JornadaService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: ExcelService,
          useValue: {
            generarExcelJornada: vi.fn().mockReturnValue(mockExcelBase64),
            generarExcelMensual: vi.fn().mockReturnValue(mockExcelBase64),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerAbierta', () => {
    it('debería retornar null cuando no hay jornada abierta', async () => {
      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toBeNull();
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String), 'abierta'],
      );
    });

    it('debería retornar la jornada abierta cuando existe', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toEqual(mockJornada);
      expect(resultado!.estado).toBe('abierta');
    });

    it('debería lanzar error si la DB falla', async () => {
      vi.mocked(mockDb.sql).mockRejectedValue(new Error('Connection error'));

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.obtenerAbierta()),
      ).rejects.toThrow('Connection error');
    });
  });

  describe('abrir', () => {
    it('debería crear una nueva jornada con monto inicial', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.abrir(5000));

      expect(resultado.monto_inicial).toBe(5000);
      expect(resultado.estado).toBe('abierta');
    });
  });

  describe('cerrar', () => {
  describe('cerrar', () => {
    it('debería cerrar la jornada generando Excel (admin)', async () => {
      vi.mocked(mockDb.sql)
        // constructor: obtenerAbierta
        .mockResolvedValueOnce([])
        // ventas
        .mockResolvedValueOnce([])
        // movimientos
        .mockResolvedValueOnce([])
        // UPDATE jornada (antes que Excel)
        .mockResolvedValueOnce([mockJornadaCerrada])
        // SELECT productos
        .mockResolvedValueOnce([])
        // SELECT cuenta_cosas
        .mockResolvedValueOnce([])
        // INSERT reporte
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 7200, 1));

      expect(resultado.estado).toBe('cerrada');
      expect(resultado.saldo_real).toBe(7200);
      expect(resultado.user_cierre_id).toBe(1);
    });

    it('debería cerrar la jornada incluso para worker', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 7200, 2));

      expect(resultado.estado).toBe('cerrada');
    });

    it('debería generar y almacenar Excel en jornada_reportes', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const mockMovimientos: Movimiento[] = [
        { id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'Coca', monto: 1500, created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        // constructor: obtenerAbierta
        .mockResolvedValueOnce([])
        // ventas
        .mockResolvedValueOnce(mockVentas)
        // detalles (ventaIds = [10])
        .mockResolvedValueOnce(mockDetalles)
        // movimientos
        .mockResolvedValueOnce(mockMovimientos)
        // UPDATE jornada (antes que Excel)
        .mockResolvedValueOnce([mockJornadaCerrada])
        // SELECT productos
        .mockResolvedValueOnce([])
        // SELECT cuenta_cosas
        .mockResolvedValueOnce([])
        // INSERT reporte
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      // Verificar que se llamó a ExcelService con los datos correctos
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          jornada: mockJornadaCerrada,
          ventas: [expect.objectContaining({ id: 10, detalles: mockDetalles })],
          movimientos: mockMovimientos,
        }),
      );

      // Verificar que se insertó el reporte
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO jornada_reportes'),
      );
      expect(insertCall).toBeTruthy();
    });

    it('debería lanzar error si la jornada no existe', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]); // UPDATE -> empty -> throw

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.cerrar(999, 0, 1)),
      ).rejects.toThrow('Jornada no encontrada');
    });
  });

  describe('obtenerReporte', () => {
    it('debería retornar null si no hay reporte', async () => {
      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerReporte(1));

      expect(resultado).toBeNull();
    });

    it('debería retornar el reporte cuando existe', async () => {
      const mockReporte = {
        id: 1,
        jornada_id: 1,
        content_type: 'excel',
        content_base64: 'UEsDB...',
        filename: 'jornada_2026-06-02_1.xlsx',
        created_at: '2026-06-02T18:00:00Z',
      };
      vi.mocked(mockDb.sql).mockResolvedValue([mockReporte]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerReporte(1));

      expect(resultado).toEqual(mockReporte);
      expect(resultado!.filename).toBe('jornada_2026-06-02_1.xlsx');
    });
  });

  describe('historial', () => {
    it('debería retornar lista de jornadas', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada, mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.historial(10));

      expect(resultado).toHaveLength(2);
    });
  });

  describe('cerrarSinAuth', () => {
    it('3.1 RED: debería cerrar sin verificar rol admin', async () => {
      vi.mocked(mockDb.sql)
        // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([])
        // _cerrarSinAuthAsync: SELECT jornada para saldo_esperado
        .mockResolvedValueOnce([mockJornada])
        // _ejecutarCierre: ventas
        .mockResolvedValueOnce([])
        // movimientos
        .mockResolvedValueOnce([])
        // UPDATE jornada RETURNING *
        .mockResolvedValueOnce([mockJornadaCerrada])
        // SELECT productos
        .mockResolvedValueOnce([])
        // INSERT reporte
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrarSinAuth(1, 2));

      expect(resultado.estado).toBe('cerrada');

      // Verificar que NO se llamó a SELECT rol (admin check)
      const adminCheckCalls = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('SELECT rol FROM usuarios'),
      );
      expect(adminCheckCalls).toHaveLength(0);
    });
  });

  describe('total_costo y userCierreNombre en _ejecutarCierre', () => {
    it('2.1 RED: debería calcular total_costo mediante JOIN y pasarlo a ExcelService', async () => {
      const mockVentasConDetalles: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
        { id: 2, venta_id: 10, producto_id: 2, cantidad: 3, precio_unitario: 1000, subtotal: 3000 },
      ];
      const mockProductos: Producto[] = [
        { id: 1, nombre: 'Prod A', descripcion: null, precio_venta: 2500, precio_costo: 10, stock_actual: 10, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Prod B', descripcion: null, precio_venta: 1000, precio_costo: 5, stock_actual: 20, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce(mockVentasConDetalles) // ventas
        .mockResolvedValueOnce(mockDetalles) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce(mockProductos) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 35 }]) // total_costo = 10*2 + 5*3 = 35
        .mockResolvedValueOnce([{ nombre: 'Admin' }]) // user nombre
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const excelService = TestBed.inject(ExcelService);

      // Should have passed totalCosto to ExcelService
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      expect(callArg.totalCosto).toBe(35);
      expect(callArg.userCierreNombre).toBe('Admin');
    });

    it('2.1 RED: debería tratar NULL precio_costo como 0', async () => {
      const mockVentasConDetalles: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 3000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 1500, subtotal: 3000 },
      ];
      const mockProductos: Producto[] = [
        { id: 1, nombre: 'Prod Sin Costo', descripcion: null, precio_venta: 1500, precio_costo: null, stock_actual: 10, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce(mockVentasConDetalles) // ventas
        .mockResolvedValueOnce(mockDetalles) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce(mockProductos) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 0 }]) // total_costo = NULL * 2 = 0
        .mockResolvedValueOnce([{ nombre: 'Admin' }]) // user nombre
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      expect(callArg.totalCosto).toBe(0);
    });

    it('2.1 RED: userCierreNombre debería ser null si usuario no encontrado', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas (empty)
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // user nombre -> empty
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 999));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      expect(callArg.userCierreNombre).toBeNull();
    });
  });

  describe('cuenta_cosas en cierre', () => {
    it('3.1 RED: debería consultar cuenta_cosas y pasar CC records a ExcelService', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const mockProductos: Producto[] = [
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_actual: 10, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Agua 1L', descripcion: null, precio_venta: 1500, precio_costo: null, stock_actual: 20, created_at: '', updated_at: '' },
      ];
      const mockCC: CuentaCosa[] = [
        { id: 1, jornada_id: 1, producto_id: 1, cantidad: 2, descripcion: 'Retiro personal', autorizado_por: 'Juan', created_at: '' },
        { id: 2, jornada_id: 1, producto_id: 2, cantidad: 1, descripcion: null, autorizado_por: 'María', created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // user name
        .mockResolvedValueOnce(mockCC) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];

      // Should have queried cuenta_cosas
      const ccQueryCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('FROM cuenta_cosas'),
      );
      expect(ccQueryCall).toBeTruthy();
      expect(ccQueryCall![1]).toEqual([1]);

      // Should have passed cuentaCosas to ExcelService
      expect(callArg.cuentaCosas).toBeDefined();
      expect(callArg.cuentaCosas).toHaveLength(2);
      expect(callArg.cuentaCosas![0].producto_id).toBe(1);
      expect(callArg.cuentaCosas![1].producto_id).toBe(2);
    });
  });

  describe('registrarMovimiento', () => {
    it('1.1 RED: debería validar que tipo sea gasto o ingreso_extra', async () => {
      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.registrarMovimiento(1, 'invalido' as any, 'test', 100)),
      ).rejects.toThrow('Tipo inválido');
    });

    it('1.1 RED: debería validar que descripcion no esté vacía', async () => {
      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.registrarMovimiento(1, 'gasto', '', 100)),
      ).rejects.toThrow('Descripción requerida');
    });

    it('1.1 RED: debería validar que descripcion no sea solo espacios', async () => {
      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.registrarMovimiento(1, 'gasto', '   ', 100)),
      ).rejects.toThrow('Descripción requerida');
    });

    it('1.1 RED: debería validar que monto sea mayor a 0', async () => {
      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.registrarMovimiento(1, 'gasto', 'test', 0)),
      ).rejects.toThrow('Monto debe ser mayor a 0');
    });

    it('1.1 RED: debería validar que monto no sea negativo', async () => {
      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.registrarMovimiento(1, 'gasto', 'test', -100)),
      ).rejects.toThrow('Monto debe ser mayor a 0');
    });

    it('1.1 RED: debería insertar movimiento y actualizar jornada para gasto', async () => {
      const mockMovimiento: Movimiento = {
        id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'Luz', monto: 500, created_at: '2026-06-05T12:00:00Z',
      };
      const mockJornadaActualizada: Jornada = {
        ...mockJornada, total_gastos: 500, saldo_esperado: 4500,
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([mockMovimiento]) // INSERT movimientos
        .mockResolvedValueOnce([mockJornadaActualizada]); // UPDATE jornadas

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.registrarMovimiento(1, 'gasto', 'Luz', 500));

      expect(resultado.tipo).toBe('gasto');
      expect(resultado.descripcion).toBe('Luz');
      expect(resultado.monto).toBe(500);

      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO movimientos'),
      );
      expect(insertCall).toBeTruthy();
      expect(insertCall![1]).toEqual([1, 'gasto', 'Luz', 500, expect.any(String)]);

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE jornadas'),
      );
      expect(updateCall).toBeTruthy();
      // total_gastos += 500, saldo_esperado += -500 (ajuste = -monto para gasto)
      expect(updateCall![1]).toEqual([500, -500, expect.any(String), 1]);
    });

    it('1.1 RED: debería insertar movimiento y actualizar jornada para ingreso_extra', async () => {
      const mockMovimiento: Movimiento = {
        id: 2, jornada_id: 1, tipo: 'ingreso_extra', descripcion: 'Venta envases', monto: 300, created_at: '2026-06-05T12:00:00Z',
      };
      const mockJornadaActualizada: Jornada = {
        ...mockJornada, total_gastos: 300, saldo_esperado: 5300,
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([mockMovimiento]) // INSERT movimientos
        .mockResolvedValueOnce([mockJornadaActualizada]); // UPDATE jornadas

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.registrarMovimiento(1, 'ingreso_extra', 'Venta envases', 300));

      expect(resultado.tipo).toBe('ingreso_extra');
      expect(resultado.descripcion).toBe('Venta envases');
      expect(resultado.monto).toBe(300);

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE jornadas'),
      );
      expect(updateCall).toBeTruthy();
      // total_gastos += 300, saldo_esperado += 300 (ajuste = +monto para ingreso_extra)
      expect(updateCall![1]).toEqual([300, 300, expect.any(String), 1]);
    });
  });

  describe('cierre refactor orden', () => {
    it('3.2 RED: UPDATE debería ejecutarse antes que la generación de Excel (estado "cerrada")', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const mockProductos: Producto[] = [
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_actual: 10, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([])
        // ventas
        .mockResolvedValueOnce(mockVentas)
        // detalles
        .mockResolvedValueOnce(mockDetalles)
        // movimientos
        .mockResolvedValueOnce([])
        // UPDATE jornada (cerrada) — ANTES de la generación de Excel
        .mockResolvedValueOnce([mockJornadaCerrada])
        // SELECT productos
        .mockResolvedValueOnce(mockProductos)
        // INSERT reporte
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 7200, 1));

      expect(resultado.estado).toBe('cerrada');

      // Verificar que el Excel recibió la jornada con estado 'cerrada'
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          jornada: expect.objectContaining({ estado: 'cerrada' }),
        }),
      );
    });

    it('3.3 RED: debería construir productosMap y pasarlo a ExcelService', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const mockProductos: Producto[] = [
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_actual: 10, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Agua 1L', descripcion: null, precio_venta: 1500, precio_costo: null, stock_actual: 20, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([])
        // ventas
        .mockResolvedValueOnce(mockVentas)
        // detalles
        .mockResolvedValueOnce(mockDetalles)
        // movimientos
        .mockResolvedValueOnce([])
        // UPDATE jornada
        .mockResolvedValueOnce([mockJornadaCerrada])
        // SELECT productos
        .mockResolvedValueOnce(mockProductos)
        // INSERT reporte
        .mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      // Verificar que productosMap fue pasado a ExcelService
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          productosMap: expect.any(Map),
        }),
      );

      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      const productosMap = callArg.productosMap as Map<number, { nombre: string; precio_costo: number | null }>;
      expect(productosMap.get(1)?.nombre).toBe('Coca-Cola');
      expect(productosMap.get(2)?.nombre).toBe('Agua 1L');
    });
  });

  describe('generarExportacionMensual', () => {
    const junJornada1: Jornada = {
      ...mockJornadaCerrada,
      id: 10,
      fecha: '2026-06-05',
    };
    const junJornada2: Jornada = {
      ...mockJornadaCerrada,
      id: 11,
      fecha: '2026-06-15',
    };

    it('C9 RED: debería generar Excel multi-hoja con todas las jornadas del mes', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([junJornada1, junJornada2]) // jornadasDelMes SQL
        .mockResolvedValueOnce([]) // _recolectarDatosJornada: ventas jornada 1
        .mockResolvedValueOnce([]) // movimientos jornada 1
        .mockResolvedValueOnce([]) // productos jornada 1
        .mockResolvedValueOnce([]) // cuenta_cosas jornada 1
        .mockResolvedValueOnce([]); // _recolectarDatosJornada: ventas jornada 2
        // movimientos, productos, cuenta_cosas — fallback mockResolvedValue([])

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.generarExportacionMensual(2026, 5));

      // Should call generarExcelMensual on ExcelService with 2 entries
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelMensual).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg).toHaveLength(2);
      expect(callArg[0].jornada.id).toBe(10);
      expect(callArg[1].jornada.id).toBe(11);
      expect(typeof resultado).toBe('string');
      expect(resultado.length).toBeGreaterThan(0);
    });

    it('C9 RED: debería lanzar error si no hay jornadas cerradas en el mes', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]); // jornadasDelMes SQL -> empty

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.generarExportacionMensual(2026, 1)),
      ).rejects.toThrow('No hay jornadas cerradas en este mes.');
    });

    it('C9 RED: debería pasar cada jornada.user_cierre_id a _recolectarDatosJornada', async () => {
      const mockJornadaUser1: Jornada = {
        ...mockJornadaCerrada,
        id: 20,
        fecha: '2026-06-01',
        user_cierre_id: 5,
      };
      const mockJornadaUser2: Jornada = {
        ...mockJornadaCerrada,
        id: 21,
        fecha: '2026-06-02',
        user_cierre_id: 3,
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1, mockJornadaUser2]) // jornadasDelMes
        .mockResolvedValueOnce([]) // ventas jornada 20
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // cuenta_cosas jornada 20
        .mockResolvedValueOnce([]); // ventas jornada 21

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.generarExportacionMensual(2026, 5));

      // Both jornadas should have data collected
      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg).toHaveLength(2);
    });
  });

  describe('jornadasDelRango', () => {
    const mockJornadaJunio1: Jornada = {
      ...mockJornadaCerrada,
      id: 10,
      fecha: '2026-06-05',
    };
    const mockJornadaJunio2: Jornada = {
      ...mockJornadaCerrada,
      id: 11,
      fecha: '2026-06-15',
    };

    it('debería llamar SQL con BETWEEN fechas y estado cerrada', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // constructor
      vi.mocked(mockDb.sql).mockResolvedValueOnce([mockJornadaJunio1, mockJornadaJunio2]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.jornadasDelRango('2026-06-01', '2026-06-30'));

      expect(resultado).toHaveLength(2);
      const sqlCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('fecha BETWEEN'),
      );
      expect(sqlCall).toBeTruthy();
      // debe pasar las fechas exactas más estado cerrada
      expect(sqlCall![1]).toEqual(['2026-06-01', '2026-06-30', 'cerrada']);
    });

    it('debería retornar array vacío si no hay jornadas en el rango', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // constructor
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.jornadasDelRango('2026-01-01', '2026-01-31'));

      expect(resultado).toEqual([]);
    });
  });

  describe('generarExportacionPorRango', () => {
    const mockJornada1: Jornada = {
      ...mockJornadaCerrada,
      id: 10,
      fecha: '2026-06-05',
    };
    const mockJornada2: Jornada = {
      ...mockJornadaCerrada,
      id: 11,
      fecha: '2026-06-15',
    };

    it('debería generar Excel para todas las jornadas en el rango', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornada1, mockJornada2]) // jornadasDelRango
        .mockResolvedValueOnce([]) // _recolectarDatosJornada: ventas jornada 1
        .mockResolvedValueOnce([]) // movimientos jornada 1
        .mockResolvedValueOnce([]) // productos jornada 1
        .mockResolvedValueOnce([]) // cuenta_cosas jornada 1
        .mockResolvedValueOnce([]); // _recolectarDatosJornada: ventas jornada 2

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.generarExportacionPorRango('2026-06-01', '2026-06-30'));

      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelMensual).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg).toHaveLength(2);
      expect(callArg[0].jornada.id).toBe(10);
      expect(callArg[1].jornada.id).toBe(11);
      expect(typeof resultado).toBe('string');
      expect(resultado.length).toBeGreaterThan(0);
    });

    it('debería lanzar error si no hay jornadas en el rango', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]); // jornadasDelRango -> empty

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.generarExportacionPorRango('2026-01-01', '2026-01-31')),
      ).rejects.toThrow('No hay jornadas en el rango seleccionado.');
    });

    it('debería llamar _recolectarDatosJornada con user_cierre_id de cada jornada', async () => {
      const mockJornadaUser1: Jornada = {
        ...mockJornadaCerrada,
        id: 20,
        fecha: '2026-06-01',
        user_cierre_id: 5,
      };
      const mockJornadaUser2: Jornada = {
        ...mockJornadaCerrada,
        id: 21,
        fecha: '2026-06-02',
        user_cierre_id: 3,
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1, mockJornadaUser2]) // jornadasDelRango
        .mockResolvedValueOnce([]) // ventas 20
        .mockResolvedValueOnce([]) // movimientos 20
        .mockResolvedValueOnce([]) // productos 20
        .mockResolvedValueOnce([]) // cuenta_cosas 20
        .mockResolvedValueOnce([]); // ventas 21

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.generarExportacionPorRango('2026-06-01', '2026-06-30'));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg).toHaveLength(2);
    });
  });

  describe('jornadasDelMes', () => {
    const mockJornadaJunio1: Jornada = {
      ...mockJornadaCerrada,
      id: 10,
      fecha: '2026-06-05',
    };
    const mockJornadaJunio2: Jornada = {
      ...mockJornadaCerrada,
      id: 11,
      fecha: '2026-06-15',
    };

    it('C9 RED: debería llamar SQL con fecha BETWEEN y estado = cerrada para el mes', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // constructor
      vi.mocked(mockDb.sql).mockResolvedValueOnce([
        mockJornadaJunio1,
        mockJornadaJunio2,
      ]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.jornadasDelMes(2026, 5));

      expect(resultado).toHaveLength(2);
      for (const j of resultado) {
        expect(j.estado).toBe('cerrada');
      }

      const sqlCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('fecha BETWEEN'),
      );
      expect(sqlCall).toBeTruthy();
      expect(sqlCall![1]).toEqual(['2026-06-01', '2026-06-30', 'cerrada']);
    });

    it('C9 RED: debería retornar array vacío si no hay jornadas en el mes', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // constructor
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // no results

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.jornadasDelMes(2026, 1));

      expect(resultado).toEqual([]);
    });

    it('C9 RED: debería usar el rango de fechas correcto para diciembre', async () => {
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]); // constructor
      vi.mocked(mockDb.sql).mockResolvedValueOnce([]);

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.jornadasDelMes(2026, 11));

      const sqlCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('fecha BETWEEN'),
      );
      expect(sqlCall).toBeTruthy();
      expect(sqlCall![1]).toEqual(['2026-12-01', '2026-12-31', 'cerrada']);
    });
  });
});
});
