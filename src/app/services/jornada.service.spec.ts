import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { JornadaService } from './jornada.service';
import { ExcelService } from './excel.service';
import { DATABASE, type Database } from './database';
import type { Jornada } from '../models';
import type { Producto } from '../models';
import type { UsuarioPublico } from '../models';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { ArqueoCajaEntry, ArqueoDbRow } from '../models';
import { ElectronFileService } from './electron-file.service';
import { ProductoService } from './producto.service';
import type { PerProductInvestment } from '../models';
import { of } from 'rxjs';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-02',
  hora_apertura: '08:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_movimientos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  user_apertura_id: null,
  total_merma: 0,
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

/** Shared mock for ElectronFileService — resets in beforeEach. */
let mockElectronFileService: {
  isElectronPackaged: boolean;
  saveIndividual: ReturnType<typeof vi.fn>;
  saveMonthly: ReturnType<typeof vi.fn>;
  saveRange: ReturnType<typeof vi.fn>;
};

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

    mockElectronFileService = {
      isElectronPackaged: false,
      saveIndividual: vi.fn().mockResolvedValue(undefined),
      saveMonthly: vi.fn().mockResolvedValue(undefined),
      saveRange: vi.fn().mockResolvedValue(undefined),
    };

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
        {
          provide: ProductoService,
          useValue: {
            obtenerInversionPorProducto: vi.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: ElectronFileService,
          useValue: mockElectronFileService,
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
        // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
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
      expect(resultado.user_cierre_id).toBe(1);
    });

    it('debería cerrar la jornada incluso para worker', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
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

    it('debería llamar ElectronFileService.saveIndividual en cerrar cuando isElectronPackaged=true', async () => {
      mockElectronFileService.isElectronPackaged = true;

      const mockVentasConData: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta
        .mockResolvedValueOnce(mockVentasConData) // ventas
        .mockResolvedValueOnce([]) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        // venta_lotes cost (returns empty -> triggers fallback) + fallback (returns empty)
        .mockResolvedValueOnce([]) // SELECT venta_lotes cost
        .mockResolvedValueOnce([]) // fallback
        .mockResolvedValueOnce([{ nombre: 'Admin' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT venta_lotes detalle
        .mockResolvedValueOnce([]); // INSERT jornada_reportes

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      expect(mockElectronFileService.saveIndividual).toHaveBeenCalledTimes(1);
      expect(mockElectronFileService.saveIndividual).toHaveBeenCalledWith(
        mockExcelBase64,
        expect.objectContaining({ id: 1 }),
      );
    });

    it('debería lanzar error si la jornada no existe', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 0, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        { id: 1, nombre: 'Prod A', descripcion: null, precio_venta: 2500, precio_costo: 10, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Prod B', descripcion: null, precio_venta: 1000, precio_costo: 5, stock_almacen: 20, stock_shop: 0, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce(mockVentasConDetalles) // ventas
        .mockResolvedValueOnce(mockDetalles) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        { id: 1, nombre: 'Prod Sin Costo', descripcion: null, precio_venta: 1500, precio_costo: null, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce(mockVentasConDetalles) // ventas
        .mockResolvedValueOnce(mockDetalles) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Agua 1L', descripcion: null, precio_venta: 1500, precio_costo: null, stock_almacen: 20, stock_shop: 0, created_at: '', updated_at: '' },
      ];
      const mockCC: CuentaCosa[] = [
        { id: 1, jornada_id: 1, producto_id: 1, cantidad: 2, descripcion: 'Retiro personal', autorizado_por: 'Juan', created_at: '' },
        { id: 2, jornada_id: 1, producto_id: 2, cantidad: 1, descripcion: null, autorizado_por: 'María', created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
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
        ...mockJornada, total_movimientos: 500, saldo_esperado: 4500,
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
      // total_movimientos += -500, saldo_esperado += -500 (ajuste = -monto para gasto)
      expect(updateCall![1]).toEqual([-500, -500, expect.any(String), 1]);
    });

    it('1.1 RED: debería insertar movimiento y actualizar jornada para ingreso_extra', async () => {
      const mockMovimiento: Movimiento = {
        id: 2, jornada_id: 1, tipo: 'ingreso_extra', descripcion: 'Venta envases', monto: 300, created_at: '2026-06-05T12:00:00Z',
      };
      const mockJornadaActualizada: Jornada = {
        ...mockJornada, total_movimientos: 300, saldo_esperado: 5300,
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
      // total_movimientos += 300, saldo_esperado += 300 (ajuste = +monto para ingreso_extra)
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
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
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
        // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
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
        { id: 1, nombre: 'Coca-Cola', descripcion: null, precio_venta: 2500, precio_costo: null, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
        { id: 2, nombre: 'Agua 1L', descripcion: null, precio_venta: 1500, precio_costo: null, stock_almacen: 20, stock_shop: 0, created_at: '', updated_at: '' },
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
        // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
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

  describe('inversionPorProducto en JornadaReportData', () => {
    const mockPerProduct: PerProductInvestment[] = [
      { producto_id: 1, total_invertido: 55000 },
      { producto_id: 2, total_invertido: 18000 },
    ];

    it('4.2 RED: _ejecutarCierre debe pasar inversionPorProducto a ExcelService', async () => {
      const mockVentas: Venta[] = [
        { id: 10, jornada_id: 1, fecha_hora: '2026-06-02T10:00:00', total: 5000, usuario_id: 1, forma_pago: 'efectivo', created_at: '' },
      ];
      const mockDetalles: DetalleVenta[] = [
        { id: 1, venta_id: 10, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
      ];
      const productoService = TestBed.inject(ProductoService);
      vi.mocked(productoService.obtenerInversionPorProducto).mockReturnValue(of(mockPerProduct));

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce(mockVentas) // ventas
        .mockResolvedValueOnce(mockDetalles) // detalles
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 0 }]) // total_costo
        .mockResolvedValueOnce([{ nombre: 'Admin' }]) // user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      expect(callArg.inversionPorProducto).toBeDefined();
      expect(callArg.inversionPorProducto instanceof Map).toBe(true);
      expect(callArg.inversionPorProducto!.get(1)).toBe(55000);
      expect(callArg.inversionPorProducto!.get(2)).toBe(18000);
    });

    it('4.2 RED: obtenerDatosJornada debe incluir inversionPorProducto', async () => {
      const productoService = TestBed.inject(ProductoService);
      vi.mocked(productoService.obtenerInversionPorProducto).mockReturnValue(of(mockPerProduct));

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerDatosJornada(1, 1));

      expect(resultado.inversionPorProducto).toBeDefined();
      expect(resultado.inversionPorProducto instanceof Map).toBe(true);
      expect(resultado.inversionPorProducto!.get(1)).toBe(55000);
    });

    it('4.2 RED: generarExportacionMensual debe incluir inversionPorProducto en cada jornada', async () => {
      const junJornada: Jornada = { ...mockJornadaCerrada, id: 10, fecha: '2026-06-05' };
      const productoService = TestBed.inject(ProductoService);
      vi.mocked(productoService.obtenerInversionPorProducto).mockReturnValue(of(mockPerProduct));

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([junJornada]) // jornadasDelMes
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.generarExportacionMensual(2026, 5));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg[0].inversionPorProducto).toBeDefined();
      expect(callArg[0].inversionPorProducto!.get(1)).toBe(55000);
    });
  });

  describe('arqueo-caja', () => {
    it('2.1 RED: debería usar saldoRealCalculado en UPDATE (monto_inicial + ventas_efectivo + total_movimientos)', async () => {
      // monto_inicial=5000, ventas=[], total_movimientos=0 → saldoRealCalculado = 5000
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE jornadas') && call[0].includes('saldo_real'),
      );
      expect(updateCall).toBeTruthy();
      // saldo_real uses saldoRealCalculado = monto_inicial(5000) + ventas_efectivo(0) + total_movimientos(0) = 5000
      const params = updateCall![1] as number[];
      expect(params[1]).toBe(5000);
    });

    it('2.2 RED: debería insertar arqueo entries en arqueo_caja cuando se proporcionan', async () => {
      const arqueoEntries: ArqueoCajaEntry[] = [
        { denominacion: 1000, cantidad: 5, subtotal: 5000 },
        { denominacion: 500, cantidad: 3, subtotal: 1500 },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        // INSERT arqueo entry 1
        .mockResolvedValueOnce([])
        // INSERT arqueo entry 2
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1, arqueoEntries));

      const arqueoInserts = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO arqueo_caja'),
      );
      expect(arqueoInserts).toHaveLength(2);
      expect(arqueoInserts[0][1]).toEqual([1, 1000, 5, expect.any(String)]);
      expect(arqueoInserts[1][1]).toEqual([1, 500, 3, expect.any(String)]);
    });

    it('2.2 RED: no debería insertar arqueo entries con cantidad 0', async () => {
      const arqueoEntries: ArqueoCajaEntry[] = [
        { denominacion: 1000, cantidad: 5, subtotal: 5000 },
        { denominacion: 200, cantidad: 0, subtotal: 0 },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce([]) // INSERT arqueo 1 (solo cantidad > 0)
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1, arqueoEntries));

      const arqueoInserts = vi.mocked(mockDb.sql).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO arqueo_caja'),
      );
      expect(arqueoInserts).toHaveLength(1);
      expect(arqueoInserts[0][1]).toEqual([1, 1000, 5, expect.any(String)]);
    });

    it('2.3 RED: debería incluir arqueo entries en JornadaReportData cuando existen en DB', async () => {
      const mockArqueoRows: ArqueoDbRow[] = [
        { id: 1, jornada_id: 1, denominacion: 1000, cantidad: 5, created_at: '' },
        { id: 2, jornada_id: 1, denominacion: 500, cantidad: 3, created_at: '' },
      ];

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre (userId=1, but mock returns [])
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce(mockArqueoRows); // arqueo_caja query (NEW)

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerDatosJornada(1, 1));

      expect(resultado.arqueo).toBeDefined();
      expect(resultado.arqueo).toHaveLength(2);
      expect(resultado.arqueo![0]).toEqual({ denominacion: 1000, cantidad: 5, subtotal: 5000 });
      expect(resultado.arqueo![1]).toEqual({ denominacion: 500, cantidad: 3, subtotal: 1500 });
    });

    it('2.3 RED: arqueo debería ser array vacío si no hay entries en DB', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja query -> empty

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerDatosJornada(1, 1));

      expect(resultado.arqueo).toBeDefined();
      expect(resultado.arqueo).toHaveLength(0);
    });
  });

  describe('calcularTotalMerma', () => {
    it('debería retornar 0 cuando no hay mermas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([{ total: 0 }]); // SELECT SUM

      const service = TestBed.inject(JornadaService);
      const resultado = await service.calcularTotalMerma(1);

      expect(resultado).toBe(0);
    });

    it('debería retornar la suma de costo_total de mermas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([{ total: 580 }]); // SELECT SUM

      const service = TestBed.inject(JornadaService);
      const resultado = await service.calcularTotalMerma(1);

      expect(resultado).toBe(580);
    });

    it('debería llamar SQL con filtro tipo=merma', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([{ total: 0 }]);

      const service = TestBed.inject(JornadaService);
      await service.calcularTotalMerma(42);

      const sqlCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes("tipo = 'merma'"),
      );
      expect(sqlCall).toBeTruthy();
      expect(sqlCall![1]).toEqual([42]);
    });
  });

  describe('saldo_esperado con merma', () => {
    it('debería restar total_merma de saldo_esperado al cerrar', async () => {
      const mockJornadaConMerma: Jornada = {
        ...mockJornadaCerrada,
        total_merma: 300,
        saldo_esperado: 4700, // 5000 - 300
      };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas
        .mockResolvedValueOnce([]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial + total_movimientos
        .mockResolvedValueOnce([mockJornadaConMerma]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 4700, 1));

      expect(resultado.total_merma).toBe(300);
      expect(resultado.saldo_esperado).toBe(4700);
    });

    it('saldo_esperado inicial debería ser monto_inicial sin merma', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.abrir(5000));

      expect(resultado.saldo_esperado).toBe(5000);
      expect(resultado.total_merma).toBe(0);
    });
  });

  describe('autoCerrarSiOtroUsuario', () => {
    const mockUser1: UsuarioPublico = { id: 1, nombre: 'Admin', rol: 'admin', activo: 1, created_at: '', updated_at: '' };
    const mockUser2: UsuarioPublico = { id: 2, nombre: 'Worker', rol: 'trabajador', activo: 1, created_at: '', updated_at: '' };

    const mockJornadaUser1: Jornada = { ...mockJornada, user_apertura_id: 1 };
    const mockJornadaLegacy: Jornada = { ...mockJornada, user_apertura_id: null };

    it('debería retornar null si no hay jornada abierta', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]); // constructor: obtenerAbierta -> null

      const service = TestBed.inject(JornadaService);
      const resultado = await service.autoCerrarSiOtroUsuario(mockUser1);

      expect(resultado).toBeNull();
    });

    it('debería retornar la jornada si user_apertura_id coincide (mismo usuario)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([mockJornadaUser1]); // SELECT open jornada

      const service = TestBed.inject(JornadaService);
      const resultado = await service.autoCerrarSiOtroUsuario(mockUser1);

      expect(resultado).toEqual(mockJornadaUser1);
      expect(resultado!.user_apertura_id).toBe(1);
    });

    it('debería retornar la jornada si user_apertura_id es NULL (legacy)', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaLegacy]);

      const service = TestBed.inject(JornadaService);
      const resultado = await service.autoCerrarSiOtroUsuario(mockUser2);

      expect(resultado).toEqual(mockJornadaLegacy);
      expect(resultado!.user_apertura_id).toBeNull();
    });

    it('debería cerrar la jornada si es de OTRO usuario, generar Excel, y retornar null', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor: obtenerAbierta -> null
        .mockResolvedValueOnce([mockJornadaUser1]) // SELECT open jornada (user1)
        .mockResolvedValueOnce([{ total: 0 }]) // SELECT ventas efectivo
        .mockResolvedValueOnce([]) // UPDATE (auto-close)
        // _recolectarDatosJornada calls
        .mockResolvedValueOnce([]) // SELECT ventas
        .mockResolvedValueOnce([]) // SELECT movimientos
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Worker' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT arqueo_caja
        .mockResolvedValueOnce([]); // INSERT jornada_reportes (Excel)

      const service = TestBed.inject(JornadaService);
      const resultado = await service.autoCerrarSiOtroUsuario(mockUser2);

      expect(resultado).toBeNull();

      // Verificar que se llamó al UPDATE para cerrar
      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes("estado = 'cerrada'"),
      );
      expect(updateCall).toBeTruthy();
      expect(updateCall![1]).toContain(mockUser2.id); // user_cierre_id = usuario.id
    });

    it('debería calcular saldo_real = monto_inicial + efectivo + total_movimientos al auto-cerrar', async () => {
      const mockJornadaConMovs: Jornada = { ...mockJornadaUser1, total_movimientos: 500 };
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaConMovs]) // SELECT open jornada
        .mockResolvedValueOnce([{ total: 3000 }]) // SELECT ventas efectivo
        .mockResolvedValueOnce([]) // UPDATE
        // _recolectarDatosJornada calls
        .mockResolvedValueOnce([]) // SELECT ventas
        .mockResolvedValueOnce([]) // SELECT movimientos
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Worker' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT arqueo_caja
        .mockResolvedValueOnce([]); // INSERT jornada_reportes (Excel)

      const service = TestBed.inject(JornadaService);
      await service.autoCerrarSiOtroUsuario(mockUser2);

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes("estado = 'cerrada'"),
      );
      expect(updateCall).toBeTruthy();
      // saldo_real = 5000 (monto_inicial) + 3000 (efectivo) + 500 (total_movimientos) = 8500
      expect(updateCall![1]).toContain(8500); // saldo_real calculado
    });

    it('debería llamar ExcelService cuando se auto-cierra por otro usuario', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1]) // SELECT open jornada
        .mockResolvedValueOnce([{ total: 3000 }]) // SELECT ventas efectivo
        .mockResolvedValueOnce([]) // UPDATE
        // _recolectarDatosJornada calls
        .mockResolvedValueOnce([]) // SELECT ventas
        .mockResolvedValueOnce([]) // SELECT movimientos
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Worker' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT arqueo_caja
        .mockResolvedValueOnce([]); // INSERT jornada_reportes (Excel)

      const service = TestBed.inject(JornadaService);
      await service.autoCerrarSiOtroUsuario(mockUser2);

      // Verify ExcelService was called
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).toHaveBeenCalledTimes(1);
      expect(excelService.generarExcelJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          jornada: expect.objectContaining({ id: mockJornadaUser1.id }),
        }),
      );

      // Verify INSERT into jornada_reportes
      const insertCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO jornada_reportes'),
      );
      expect(insertCall).toBeTruthy();
    });

    it('debería llamar ElectronFileService.saveIndividual cuando isElectronPackaged=true en auto-cierre', async () => {
      mockElectronFileService.isElectronPackaged = true;

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1]) // SELECT open jornada
        .mockResolvedValueOnce([{ total: 3000 }]) // SELECT ventas efectivo
        .mockResolvedValueOnce([]) // UPDATE
        // _recolectarDatosJornada calls
        .mockResolvedValueOnce([]) // SELECT ventas
        .mockResolvedValueOnce([]) // SELECT movimientos
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Worker' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT arqueo_caja
        .mockResolvedValueOnce([]); // INSERT jornada_reportes (Excel)

      const service = TestBed.inject(JornadaService);
      await service.autoCerrarSiOtroUsuario(mockUser2);

      expect(mockElectronFileService.saveIndividual).toHaveBeenCalledTimes(1);
      expect(mockElectronFileService.saveIndividual).toHaveBeenCalledWith(
        mockExcelBase64,
        expect.objectContaining({ id: mockJornadaUser1.id }),
      );
    });

    it('NO debería llamar ElectronFileService cuando isElectronPackaged=false en auto-cierre', async () => {
      mockElectronFileService.isElectronPackaged = false;

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1]) // SELECT open jornada
        .mockResolvedValueOnce([{ total: 3000 }]) // SELECT ventas efectivo
        .mockResolvedValueOnce([]) // UPDATE
        // _recolectarDatosJornada calls
        .mockResolvedValueOnce([]) // SELECT ventas
        .mockResolvedValueOnce([]) // SELECT movimientos
        .mockResolvedValueOnce([]) // SELECT stock_movimientos
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Worker' }]) // SELECT user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]) // SELECT arqueo_caja
        .mockResolvedValueOnce([]); // INSERT jornada_reportes (Excel)

      const service = TestBed.inject(JornadaService);
      await service.autoCerrarSiOtroUsuario(mockUser2);

      expect(mockElectronFileService.saveIndividual).not.toHaveBeenCalled();
    });

    it('debería NO llamar ExcelService cuando es el mismo usuario', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornadaUser1]); // SELECT open jornada (same user)

      const service = TestBed.inject(JornadaService);
      await service.autoCerrarSiOtroUsuario(mockUser1);

      // ExcelService should NOT have been called
      const excelService = TestBed.inject(ExcelService);
      expect(excelService.generarExcelJornada).not.toHaveBeenCalled();
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

  describe('divisas en cierre', () => {
    const mockVentaUSD: Venta = {
      id: 10, jornada_id: 1, fecha_hora: '2026-07-28T10:00:00', total: 65000,
      usuario_id: 1, forma_pago: 'divisas', divisa_tipo: 'USD', monto_divisa: 100,
      created_at: '',
    };
    const mockVentaEUR: Venta = {
      id: 11, jornada_id: 1, fecha_hora: '2026-07-28T11:00:00', total: 85000,
      usuario_id: 1, forma_pago: 'divisas', divisa_tipo: 'EUR', monto_divisa: 200,
      created_at: '',
    };
    const mockDetalleUSD: DetalleVenta = {
      id: 1, venta_id: 10, producto_id: 1, cantidad: 1, precio_unitario: 65000, subtotal: 65000,
    };
    const mockDetalleEUR: DetalleVenta = {
      id: 2, venta_id: 11, producto_id: 2, cantidad: 1, precio_unitario: 85000, subtotal: 85000,
    };
    const mockCompraUSD: Movimiento = {
      id: 1, jornada_id: 1, tipo: 'compra_divisa', descripcion: 'Compra USD',
      monto: 1000, divisa_tipo: 'USD', monto_divisa: 50, created_at: '',
    };
    const mockCompraEUR: Movimiento = {
      id: 2, jornada_id: 1, tipo: 'compra_divisa', descripcion: 'Compra EUR',
      monto: 2000, divisa_tipo: 'EUR', monto_divisa: 30, created_at: '',
    };

    it('3.1 RED: debería calcular total_usd desde ventas USD + compra_divisa USD', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockVentaUSD]) // ventas
        .mockResolvedValueOnce([mockDetalleUSD]) // detalles
        .mockResolvedValueOnce([mockCompraUSD]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }]) // SELECT monto_inicial
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE jornada
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 0 }]) // FIFO venta_lotes
        .mockResolvedValueOnce([{ nombre: 'Admin' }]) // user nombre
        .mockResolvedValueOnce([]) // SELECT cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte (rest use default)

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      // Verificar que el UPDATE incluyó total_usd = 150 (100 venta + 50 compra)
      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('total_usd'),
      );
      expect(updateCall).toBeTruthy();
      expect(updateCall![0]).toContain('total_usd = ?');
      const params = updateCall![1] as unknown[];
      const totalUsdIdx = params.findIndex((p, i) => i >= 2 && typeof p === 'number' && p === 150);
      expect(totalUsdIdx).toBeGreaterThanOrEqual(0);
    });

    it('3.1 RED: debería calcular total_eur desde ventas EUR + compra_divisa EUR', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockVentaEUR]) // ventas
        .mockResolvedValueOnce([mockDetalleEUR]) // detalles
        .mockResolvedValueOnce([mockCompraEUR]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 0 }]) // FIFO
        .mockResolvedValueOnce([{ nombre: 'Admin' }])
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('total_eur'),
      );
      expect(updateCall).toBeTruthy();
      expect(updateCall![0]).toContain('total_eur = ?');
    });

    it('3.1 RED: debería tener total_usd=0 y total_eur=0 sin actividad de divisas', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([]) // ventas (sin divisas)
        .mockResolvedValueOnce([]) // movimientos (sin compra_divisa)
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ nombre: 'Admin' }])
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const updateCall = vi.mocked(mockDb.sql).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('total_usd'),
      );
      expect(updateCall).toBeTruthy();
      const params = updateCall![1] as unknown[];
      // total_usd and total_eur should be 0 when no divisa activity
      const usdIdx = params.findIndex((p, i) => i >= 2 && p === 0);
      expect(usdIdx).toBeGreaterThanOrEqual(0);
    });

    it('3.2 RED: JornadaReportData debe contener total_usd y total_eur', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockVentaUSD, mockVentaEUR]) // ventas
        .mockResolvedValueOnce([mockDetalleUSD, mockDetalleEUR]) // detalles
        .mockResolvedValueOnce([mockCompraUSD, mockCompraEUR]) // movimientos
        .mockResolvedValueOnce([{ monto_inicial: 5000, total_movimientos: 0 }])
        .mockResolvedValueOnce([mockJornadaCerrada]) // UPDATE
        .mockResolvedValueOnce([]) // SELECT productos
        .mockResolvedValueOnce([{ total_costo: 0 }]) // FIFO
        .mockResolvedValueOnce([{ nombre: 'Admin' }])
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // INSERT reporte (rest default)

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.cerrar(1, 7200, 1));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelJornada).mock.calls[0][0];
      expect(callArg).toHaveProperty('total_usd');
      expect(callArg).toHaveProperty('total_eur');
      expect(callArg.total_usd).toBe(150); // 100 USD venta + 50 USD compra
      expect(callArg.total_eur).toBe(230); // 200 EUR venta + 30 EUR compra
    });

    it('3.2 RED: obtenerDatosJornada debe incluir total_usd y total_eur', async () => {
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockVentaUSD]) // ventas
        .mockResolvedValueOnce([mockDetalleUSD]) // detalles
        .mockResolvedValueOnce([mockCompraUSD]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre (userId=1, mock returns [])
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerDatosJornada(1, 1));

      expect(resultado).toHaveProperty('total_usd');
      expect(resultado.total_usd).toBe(150); // 100 venta + 50 compra
    });

    it('3.2 RED: generarExportacionMensual debe incluir total_usd y total_eur', async () => {
      const junJornada: Jornada = { ...mockJornadaCerrada, id: 10, fecha: '2026-07-28' };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([junJornada]) // jornadasDelMes
        .mockResolvedValueOnce([mockVentaUSD]) // ventas
        .mockResolvedValueOnce([mockDetalleUSD]) // detalles
        .mockResolvedValueOnce([mockCompraUSD]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.generarExportacionMensual(2026, 6));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg[0]).toHaveProperty('total_usd');
      expect(callArg[0].total_usd).toBe(150);
    });

    it('3.2 RED: generarExportacionPorRango debe incluir total_usd y total_eur', async () => {
      const mockJornada: Jornada = { ...mockJornadaCerrada, id: 10, fecha: '2026-07-28' };

      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([]) // constructor
        .mockResolvedValueOnce([mockJornada]) // jornadasDelRango
        .mockResolvedValueOnce([mockVentaUSD]) // ventas
        .mockResolvedValueOnce([mockDetalleUSD]) // detalles
        .mockResolvedValueOnce([mockCompraUSD]) // movimientos
        .mockResolvedValueOnce([]) // stock_movimientos
        .mockResolvedValueOnce([]) // productos
        .mockResolvedValueOnce([]) // user nombre
        .mockResolvedValueOnce([]) // cuenta_cosas
        .mockResolvedValueOnce([]); // arqueo_caja

      const service = TestBed.inject(JornadaService);
      await firstValueFrom(service.generarExportacionPorRango('2026-07-01', '2026-07-31'));

      const excelService = TestBed.inject(ExcelService);
      const callArg = vi.mocked(excelService.generarExcelMensual).mock.calls[0][0];
      expect(callArg[0]).toHaveProperty('total_usd');
      expect(callArg[0].total_usd).toBe(150);
    });
  });
});
});
