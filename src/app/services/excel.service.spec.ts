import { TestBed } from '@angular/core/testing';
import { ExcelService, type JornadaReportData, type PendienteAcumulado } from './excel.service';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { VentaConDetalles } from './excel.service';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { StockMovimiento } from '../models/stock-movimiento';
import type { VentaLote } from '../models/venta-lote';
import type { ArqueoCajaEntry } from '../models/arqueo-caja';

describe('ExcelService', () => {
  let service: ExcelService;

  const jornada: Jornada = {
    id: 1,
    fecha: '2026-06-04',
    hora_apertura: '09:00:00',
    hora_cierre: '18:30:00',
    monto_inicial: 5000,
    total_ventas: 15000,
    total_movimientos: 2000,
    saldo_esperado: 18000,
    saldo_real: 17800,
    estado: 'cerrada',
    user_cierre_id: 1,
    user_apertura_id: null,
    total_merma: 0,
    created_at: '2026-06-04T09:00:00Z',
    updated_at: '2026-06-04T18:30:00Z',
  };

  const ventaConDetalles: VentaConDetalles[] = [
    {
      id: 1,
      jornada_id: 1,
      fecha_hora: '2026-06-04T10:00:00',
      total: 850,
      usuario_id: 1,
      forma_pago: 'efectivo',
      created_at: '2026-06-04T10:00:00Z',
      detalles: [
        { id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 850, subtotal: 850 },
      ],
    },
    {
      id: 2,
      jornada_id: 1,
      fecha_hora: '2026-06-04T11:30:00',
      total: 2950,
      usuario_id: 1,
      forma_pago: 'efectivo',
      created_at: '2026-06-04T11:30:00Z',
      detalles: [
        { id: 2, venta_id: 2, producto_id: 1, cantidad: 2, precio_unitario: 850, subtotal: 1700 },
        { id: 3, venta_id: 2, producto_id: 2, cantidad: 1, precio_unitario: 1100, subtotal: 1100 },
        { id: 4, venta_id: 2, producto_id: 3, cantidad: 1, precio_unitario: 150, subtotal: 150 },
      ],
    },
  ];

  const movimientos: Movimiento[] = [
    { id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'Coca Cola para el empleado', monto: 1500, created_at: '2026-06-04T12:00:00Z' },
    { id: 2, jornada_id: 1, tipo: 'gasto', descripcion: 'Bidón de agua', monto: 500, created_at: '2026-06-04T14:00:00Z' },
  ];

  const data: JornadaReportData = {
    jornada,
    ventas: ventaConDetalles,
    movimientos,
    totalCosto: 0,
    userCierreNombre: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExcelService] });
    service = TestBed.inject(ExcelService);
  });

  it('debería crearse', () => {
    expect(service).toBeTruthy();
  });

  describe('generarExcelJornada', () => {
    it('debería devolver un string base64 válido', () => {
      const result = service.generarExcelJornada(data);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Decodificar y verificar que es un xlsx válido
      const binary = atob(result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const workbook = XLSX.read(bytes, { type: 'array' });

      expect(workbook.SheetNames).toContain('Resumen');
      expect(workbook.SheetNames).toContain('Ventas');
      expect(workbook.SheetNames).toContain('Movimientos');
    });

    it('2.1 RED: debería mostrar nombre de producto vía productosMap, no producto_id', () => {
      const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: null }],
        [2, { nombre: 'Agua 1L', precio_costo: null }],
        [3, { nombre: 'Chocolate', precio_costo: null }],
      ]);
      const dataConMap: JornadaReportData = {
        ...data,
        productosMap,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConMap);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Debe mostrar nombres, no IDs
      const filas = json as unknown[][];
      expect(filas.some((f) => f.includes('Coca-Cola 500ml'))).toBe(true);
      expect(filas.some((f) => f.includes('Agua 1L'))).toBe(true);
      expect(filas.some((f) => f.includes('Chocolate'))).toBe(true);
      // No debe mostrar IDs numéricos en la columna de producto (index 0)
      expect(filas.some((f) => f[0] === 1)).toBe(false);
      expect(filas.some((f) => f[0] === 2)).toBe(false);
      expect(filas.some((f) => f[0] === 3)).toBe(false);
    });

    it('2.2 RED: debería mostrar fila "Total gastos" incluso cuando es 0', () => {
      const jornadaSinGastos: Jornada = {
        ...jornada,
        total_movimientos: 0,
      };
      const dataSinGastos: JornadaReportData = {
        jornada: jornadaSinGastos,
        ventas: [],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataSinGastos);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Total gastos', 0]);
    });

    it('debería tener la data correcta en la hoja Resumen', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });

      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Fecha', '2026-06-04']);
      expect(json).toContainEqual(['Apertura', '09:00:00']);
      expect(json).toContainEqual(['Cierre', '18:30:00']);
      expect(json).toContainEqual(['Estado', 'Cerrada']);
      // Ganancia Bruta table — totalVentasSinPendientes from ventas array (3800)
      expect(json).toContainEqual(['Total ventas + ingresos extra', 3800]);
      expect(json).toContainEqual(['Total gastos', -2000]);
      expect(json).toContainEqual(['Ganancia bruta', 1800]);
      // Efectivo del Día table
      expect(json).toContainEqual(['Monto inicial', 5000]);
      // totalEfectivo=3800, ingresosExtra=0, gastos=2000 -> totalEnCaja = 5000+3800+0-2000 = 6800
      expect(json).toContainEqual(['Total en caja', 6800]);
      expect(json).toContainEqual(['Transferencias', 0]);
      expect(json).toContainEqual(['Total del día', 6800]);
      // Removed fields — Saldo esperado, Saldo real, Diferencia must NOT appear
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Saldo esperado')).toBe(false);
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Saldo real')).toBe(false);
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Diferencia')).toBe(false);
    });

    it('debería listar todas las ventas con sus detalles', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });

      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Header row + 4 detail rows + 1 subtotal row (venta #2 multi-item) + empty row + 5 footer rows
      expect(json.length).toBe(12);

      // Primera fila de detalle: [producto_id, cantidad, precio_unitario, precio_venta, subtotal, forma_pago]
      expect(json[1]).toContainEqual(850);
      // Segunda venta, primer detalle
      expect(json[2]).toContainEqual(1700);
      expect(json[3]).toContainEqual(1100);
      expect(json[4]).toContainEqual(150);

      // Footer rows: Total de ingresos en ventas, Total divisas, Total pendientes, Total transferencia, Total esperado
      const cajaRow = json.find((f) => f[0] === 'Total de ingresos en ventas') as unknown[];
      expect(cajaRow).toBeTruthy();
      expect(cajaRow[4]).toBe(3800);
      const esperadoRow = json.find((f) => f[0] === 'Total esperado') as unknown[];
      expect(esperadoRow).toBeTruthy();
      expect(esperadoRow[4]).toBe(3800);
    });

    it('debería listar los movimientos', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });

      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json.length).toBe(3); // header + 2 movimientos
      expect(json[1]).toContainEqual('Gasto');
      expect(json[1]).toContainEqual('Coca Cola para el empleado');
      expect(json[2]).toContainEqual('Bidón de agua');
    });

    it('debería manejar jornada sin ventas ni movimientos', () => {
      const dataVacia: JornadaReportData = {
        jornada,
        ventas: [],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataVacia);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('Resumen');
      expect(workbook.SheetNames).toContain('Ventas');

      const ventasSheet = workbook.Sheets['Ventas'];
      const ventasJson = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 }) as unknown[][];
      expect(ventasJson.length).toBe(7); // header + empty row + 5 footer rows
    });
  });

  describe('Ventas restructuring', () => {
    it('3.1 RED: header debería tener columnas Producto, Cantidad, Precio unitario, Precio venta, Total, Forma de pago', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const header = json[0] as string[];
      expect(header[0]).toBe('Producto');
      expect(header[1]).toBe('Cantidad');
      expect(header[2]).toBe('Precio unitario');
      expect(header[3]).toBe('Precio venta');
      expect(header[4]).toBe('Total');
      expect(header[5]).toBe('Forma de pago');
      expect(header).toHaveLength(6);
    });

    it('3.1 RED: una fila por detalle con nombre de producto resuelto', () => {
      const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: 400 }],
        [2, { nombre: 'Agua 1L', precio_costo: 600 }],
        [3, { nombre: 'Chocolate', precio_costo: 80 }],
      ]);
      const dataConMap: JornadaReportData = {
        ...data,
        productosMap,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConMap);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // 1 header + 4 detalle rows + 1 empty + 1 footer = 7
      expect(json.length).toBeGreaterThanOrEqual(5);

      // Product names resolved
      const filas = json as unknown[][];
      expect(filas.some((f) => f[0] === 'Coca-Cola 500ml')).toBe(true);
      expect(filas.some((f) => f[0] === 'Agua 1L')).toBe(true);
      expect(filas.some((f) => f[0] === 'Chocolate')).toBe(true);

      // No numeric IDs in product column
      expect(filas.some((f) => f[0] === 1)).toBe(false);
    });

    it('3.1 RED: fila footer debe tener suma total de todos los subtotales', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      // Find footer row - should contain 'Total de ingresos en ventas' and the grand total
      const footerRow = filas.find((f) => f[0] === 'Total de ingresos en ventas');
      expect(footerRow).toBeTruthy();
      // Total = 850 + 1700 + 1100 + 150 = 3800 (index 4 = columna Total, shifted from [3])
      expect(footerRow![4]).toBe(3800);
    });

    it('3.1 RED: footer suma debe ser 0 cuando no hay ventas', () => {
      const dataSinVentas: JornadaReportData = {
        jornada,
        ventas: [],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataSinVentas);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      const footerRow = filas.find((f) => f[0] === 'Total de ingresos en ventas');
      expect(footerRow).toBeTruthy();
      expect(footerRow![4]).toBe(0);
    });
  });

  describe('Ganancia bruta y Firmado por en Resumen', () => {
    it('3.3 RED: Resumen debe incluir Ganancia bruta = total_ventas - total_costo - gastos - merma', () => {
      const dataConGanancia: JornadaReportData = {
        jornada,
        ventas: ventaConDetalles,
        movimientos,
        totalCosto: 40,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConGanancia);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Ganancia bruta', 1760]); // 3800 (ventas array) - 40 - 2000 - 0
    });

    it('3.3 RED: Ganancia bruta = total_ventas - gastos cuando total_costo y merma = 0', () => {
      const dataSinCosto: JornadaReportData = {
        ...data,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataSinCosto);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Ganancia bruta', 1800]); // 3800 (ventas array) - 0 - 2000 - 0
    });

    it('3.3 RED: Resumen debe incluir Firmado por cuando userCierreNombre no es null', () => {
      const dataConFirma: JornadaReportData = {
        jornada,
        ventas: ventaConDetalles,
        movimientos,
        totalCosto: 0,
        userCierreNombre: 'Admin',
      };

      const result = service.generarExcelJornada(dataConFirma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Firmado por', 'Admin']);
    });

    it('3.3 RED: NO debe incluir Firmado por cuando userCierreNombre es null', () => {
      const dataSinFirma: JornadaReportData = {
        ...data,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataSinFirma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).not.toContainEqual(['Firmado por', 'Admin']);
      expect(json.some((f: unknown) => (f as unknown[])[0] === 'Firmado por')).toBe(false);
    });
  });

  describe('Forma de pago en Excel', () => {
    const ventasConFormaPago: VentaConDetalles[] = [
      {
        id: 1,
        jornada_id: 1,
        fecha_hora: '2026-06-04T10:00:00',
        total: 1000,
        usuario_id: 1,
        forma_pago: 'efectivo',
        created_at: '2026-06-04T10:00:00Z',
        detalles: [
          { id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 1000, subtotal: 1000 },
        ],
      },
      {
        id: 2,
        jornada_id: 1,
        fecha_hora: '2026-06-04T11:00:00',
        total: 2500,
        usuario_id: 1,
        forma_pago: 'transferencia',
        created_at: '2026-06-04T11:00:00Z',
        detalles: [
          { id: 2, venta_id: 2, producto_id: 2, cantidad: 1, precio_unitario: 2500, subtotal: 2500 },
        ],
      },
    ];

    it('4.1 RED: Ventas sheet debería tener columna "Forma de pago"', () => {
      const dataConForma: JornadaReportData = {
        jornada,
        ventas: ventasConFormaPago,
        movimientos,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConForma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const header = json[0];
      expect(header).toContain('Forma de pago');
    });

    it('4.1 RED: Ventas sheet debería mostrar forma_pago de cada venta', () => {
      const dataConForma: JornadaReportData = {
        jornada,
        ventas: ventasConFormaPago,
        movimientos,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConForma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Debería mostrar 'efectivo' y 'transferencia' en alguna fila
      const filas = json as unknown[][];
      expect(filas.some((f) => f.includes('efectivo'))).toBe(true);
      expect(filas.some((f) => f.includes('transferencia'))).toBe(true);
    });

    it('4.1 RED: Resumen debería tener desglose total efectivo/transferencia en Efectivo del Día', () => {
      const dataConForma: JornadaReportData = {
        ...data,
        ventas: ventasConFormaPago,
        movimientos,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConForma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Efectivo: 1000 (from ventasConFormaPago), Transferencia: 2500
      expect(json).toContainEqual(['Transferencias', 2500]);
      // Total en caja = 5000 + 1000 + 0 - 2000 = 4000
      expect(json).toContainEqual(['Total en caja', 4000]);
      // Total del día = 4000 + 2500 = 6500
      expect(json).toContainEqual(['Total del día', 6500]);
    });
  });

  describe('generarExcelMensual', () => {
    const jornada1: Jornada = {
      id: 1,
      fecha: '2026-03-15',
      hora_apertura: '09:00:00',
      hora_cierre: '18:00:00',
      monto_inicial: 5000,
      total_ventas: 15000,
      total_movimientos: 2000,
      saldo_esperado: 18000,
      saldo_real: 17800,
      estado: 'cerrada',
      user_cierre_id: 1,
      user_apertura_id: null,
      total_merma: 0,
      created_at: '',
      updated_at: '',
    };

    const jornada2: Jornada = {
      id: 2,
      fecha: '2026-03-20',
      hora_apertura: '08:00:00',
      hora_cierre: '17:30:00',
      monto_inicial: 3000,
      total_ventas: 25000,
      total_movimientos: 5000,
      saldo_esperado: 23000,
      saldo_real: 23000,
      estado: 'cerrada',
      user_cierre_id: 2,
      user_apertura_id: null,
      total_merma: 0,
      created_at: '',
      updated_at: '',
    };

    const dataMulti: JornadaReportData[] = [
      {
        jornada: jornada1,
        ventas: [
          {
            id: 1, jornada_id: 1, fecha_hora: '', total: 5000,
            usuario_id: 1, forma_pago: 'efectivo',
            created_at: '', detalles: [
              { id: 1, venta_id: 1, producto_id: 1, cantidad: 2, precio_unitario: 2500, subtotal: 5000 },
            ],
          },
        ],
        movimientos: [
          { id: 1, jornada_id: 1, tipo: 'gasto', descripcion: 'Luz', monto: 1500, created_at: '' },
        ],
        totalCosto: 0,
        userCierreNombre: 'Admin',
      },
      {
        jornada: jornada2,
        ventas: [],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      },
    ];

    it('C9 RED: debería generar workbook con hoja "Resumen del Mes" + una hoja por jornada', () => {
      const result = service.generarExcelMensual(dataMulti);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toEqual(['Resumen del Mes', '2026-03-15 (1)', '2026-03-20 (2)']);
    });

    it('C9 RED: Resumen del Mes debería mostrar mes, cantidad, totales consolidados', () => {
      const result = service.generarExcelMensual(dataMulti);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen del Mes'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Mes', 'marzo de 2026']);
      expect(json).toContainEqual(['Cantidad de jornadas', 2]);
      expect(json).toContainEqual(['Total ventas + ingresos extra', 5000]); // 5000 (solo efectivo, sin pendientes)
      expect(json).toContainEqual(['Total gastos', 1500]);  // gastos from movimientos array
    });

    it('C9 RED: hoja por jornada debería tener resumen header + ventas + movimientos', () => {
      const result = service.generarExcelMensual(dataMulti);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-03-15 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Should have resumen header fields
      expect(json.some((r) => r[0] === 'Fecha' && r[1] === '2026-03-15')).toBe(true);
      expect(json.some((r) => r[0] === 'Total ventas + ingresos extra' && r[1] === 5000)).toBe(true);
      // Should have Efectivo del Día table
      expect(json.some((r) => r[0] === 'Efectivo del día')).toBe(true);
      expect(json.some((r) => r[0] === 'Monto inicial' && r[1] === 5000)).toBe(true);
      // Should have ventas table header
      expect(json.some((r) => r[0] === 'Producto')).toBe(true);
      // Should have movimientos table header
      expect(json.some((r) => r[0] === 'Tipo')).toBe(true);
      // Footer rows were removed (Total caja, Total divisas, etc.)
      expect(json.some((r) => r[0] === 'Total caja')).toBe(false);
    });

    it('C9 RED: debería manejar una sola jornada', () => {
      const result = service.generarExcelMensual([dataMulti[0]]);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toEqual(['Resumen del Mes', '2026-03-15 (1)']);
    });

    it('C9 RED: no debería colisionar cuando dos jornadas tienen la misma fecha', () => {
      const dataSameDate: JornadaReportData[] = [
        {
          ...dataMulti[0],
          jornada: { ...jornada1, id: 5 },
        },
        {
          ...dataMulti[1],
          jornada: { ...jornada2, fecha: '2026-03-15', id: 6 },
        },
      ];

      const result = service.generarExcelMensual(dataSameDate);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('2026-03-15 (5)');
      expect(workbook.SheetNames).toContain('2026-03-15 (6)');
      // No debería haber duplicados
      const uniqueNames = new Set(workbook.SheetNames);
      expect(uniqueNames.size).toBe(workbook.SheetNames.length);
    });

it('C9 RED: Resumen del Mes no debe incluir Diferencia consolidada', () => {
      const result = service.generarExcelMensual(dataMulti);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen del Mes'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Diferencia consolidada was removed per restructure
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Diferencia consolidada')).toBe(false);
    });
  });

  describe('C11 — Nuevos Métodos de Pago en Excel', () => {
    const ventasConDivisas: VentaConDetalles[] = [
      {
        id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00',
        total: 850, usuario_id: 1, forma_pago: 'efectivo',
        created_at: '2026-06-04T10:00:00Z',
        detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 850, subtotal: 850 }],
      },
      {
        id: 2, jornada_id: 1, fecha_hora: '2026-06-04T11:00:00',
        total: 200, usuario_id: 1, forma_pago: 'divisas',
        divisa_tipo: 'USD', monto_divisa: 20, tasa_cambio: 10,
        created_at: '2026-06-04T11:00:00Z',
        detalles: [{ id: 2, venta_id: 2, producto_id: 1, cantidad: 1, precio_unitario: 200, subtotal: 200 }],
      },
    ];

    const ventasConPendientes: VentaConDetalles[] = [
      {
        id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00',
        total: 850, usuario_id: 1, forma_pago: 'efectivo',
        created_at: '2026-06-04T10:00:00Z',
        detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 850, subtotal: 850 }],
      },
      {
        id: 2, jornada_id: 1, fecha_hora: '2026-06-04T11:00:00',
        total: 1500, usuario_id: 1, forma_pago: 'pendiente',
        comprador_nombre: 'Juan Pérez',
        created_at: '2026-06-04T11:00:00Z',
        detalles: [{ id: 2, venta_id: 2, producto_id: 1, cantidad: 1, precio_unitario: 1500, subtotal: 1500 }],
      },
    ];

    const cuentaCosas: CuentaCosa[] = [
      { id: 1, jornada_id: 1, producto_id: 2, cantidad: 3, descripcion: 'Coca cola', autorizado_por: 'Admin', created_at: '' },
      { id: 2, jornada_id: 1, producto_id: 3, cantidad: 2, descripcion: 'Papas', autorizado_por: 'Admin', created_at: '' },
    ];

    it('3.3 RED: Resumen debe mostrar desglose de divisas por tipo con tasa de cambio', () => {
      const dataTest: JornadaReportData = { ...data, ventas: ventasConDivisas };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      // Debe mostrar fila "Divisas" con total de unidades
      expect(json).toContainEqual(['Divisas', 20]);
      // Debe mostrar desglose por tipo: USD, monto, tasa, total en pesos
      expect(json).toContainEqual(['USD', 20, 10, 200]);
      // Debe mostrar total en pesos
      expect(json).toContainEqual(['Total divisas en pesos cubanos', 200]);
    });

    it('3.3 RED: Resumen debe mostrar "Pendientes del día" sin paréntesis', () => {
      const dataTest: JornadaReportData = { ...data, ventas: ventasConPendientes };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      expect(json).toContainEqual(['Pendientes del día', 1500]);
    });

    it('3.3 RED: Resumen debe mostrar tabla Cuenta Casas con valores negativos', () => {
      const pmap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [2, { nombre: 'Coca cola', precio_costo: 100 }],
        [3, { nombre: 'Papas', precio_costo: 50 }],
      ]);
      const dataTest: JornadaReportData = { ...data, cuentaCosas: cuentaCosas, productosMap: pmap };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      // Debería tener encabezado 'Cuenta Casas'
      expect(json.some((r) => r[0] === 'Cuenta Casas')).toBe(true);
      // Debería tener header de columnas: Producto, Cantidad, Descripción, Autorizado por, Total
      expect(json.some((r) => r[0] === 'Producto' && r[4] === 'Total')).toBe(true);
      // Los valores deben ser negativos
      const filas = json as unknown[][];
      // Buscar fila con -3 y fila con -2
      const valoresNegativos = filas.filter((f) => typeof f[4] === 'number' && f[4] < 0);
      expect(valoresNegativos.length).toBeGreaterThan(0);
    });

    it('3.4 RED: Ventas debe mostrar columnas divisa_tipo, monto_divisa, tasa_cambio cuando hay divisas', () => {
      const dataTest: JornadaReportData = { ...data, ventas: ventasConDivisas };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const header = json[0] as string[];
      expect(header).toContain('Divisa');
      expect(header).toContain('Monto en divisa');
      expect(header).toContain('Tasa de cambio');
      // Filas no-divisa deben tener campos vacíos (forma_pago shifted to [5], divisas start at [6])
      const filaEfectivo = json.find((r) => r[5] === 'efectivo') as unknown[];
      expect(filaEfectivo[6]).toBe('');
      expect(filaEfectivo[7]).toBe('');
    });

    it('3.4 RED: Ventas debe mostrar columna "Comprador" cuando hay pendientes', () => {
      const dataTest: JornadaReportData = { ...data, ventas: ventasConPendientes };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const header = json[0] as string[];
      expect(header).toContain('Comprador');
      // Fila pendiente debe tener el nombre del comprador (forma_pago shifted to [5], comprador at [6])
      const filaPendiente = json.find((r) => r[5] === 'pendiente') as unknown[];
      expect(filaPendiente[6]).toBe('Juan Pérez');
    });

    // ─── Bug 2: CuentaCosas debe usar precio_costo ───────────
    it('5.1 RED: Cuenta Casas debe usar cantidad * precio_costo para calcular valores', () => {
      const pmap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [2, { nombre: 'Coca cola', precio_costo: 100 }],
        [3, { nombre: 'Papas', precio_costo: 50 }],
      ]);
      const dataTest: JornadaReportData = { ...data, cuentaCosas: cuentaCosas, productosMap: pmap };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      // Buscar las filas de Coca cola (3 * 100 = -300) y Papas (2 * 50 = -100)
      const cocaFila = filas.find((r) => r[0] === 'Coca cola');
      const papasFila = filas.find((r) => r[0] === 'Papas');
      expect(cocaFila).toBeTruthy();
      expect(papasFila).toBeTruthy();
      // index 1 = cantidad, index 4 = total
      expect(cocaFila![4]).toBe(-300); // -(3 * 100)
      expect(papasFila![4]).toBe(-100); // -(2 * 50)
      const totalFila = filas.find((r) => r[0] === 'Total C.C.');
      expect(totalFila![4]).toBe(-400); // -(300 + 100)
    });

    // ─── Bug 3: Pendientes separados en filas de footer ───
    it('5.2 RED: Ventas sheet debe separar formas de pago en 5 filas de footer', () => {
      const dataTest: JornadaReportData = { ...data, ventas: ventasConPendientes };
      const result = service.generarExcelJornada(dataTest);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      const cajaRow = filas.find((f) => f[0] === 'Total de ingresos en ventas');
      const pendientesRow = filas.find((f) => f[0] === 'Total pendientes');
      const esperadoRow = filas.find((f) => f[0] === 'Total esperado');
      expect(cajaRow).toBeTruthy();
      expect(pendientesRow).toBeTruthy();
      expect(esperadoRow).toBeTruthy();
      // efectivo: 850, pendiente: 1500 (footer total column shifted to [4])
      expect(cajaRow![4]).toBe(850);
      expect(pendientesRow![4]).toBe(1500);
      expect(esperadoRow![4]).toBe(2350); // 850 + 1500
    });

  describe('C3 — Stock Movements en Excel', () => {
    const stockMovimientos: StockMovimiento[] = [
      { id: 1, producto_id: 1, cantidad: 100, tipo: 'entrada', motivo: 'Compra a proveedor', costo_total: 55000, created_at: '2026-06-04T08:00:00Z' },
      { id: 2, producto_id: 2, cantidad: 10, tipo: 'salida', motivo: 'Venta al público', costo_total: 3500, created_at: '2026-06-04T10:30:00Z' },
      { id: 3, producto_id: 3, cantidad: 25, tipo: 'ajuste', motivo: 'Inventario físico', costo_total: 12500, created_at: '2026-06-04T15:00:00Z' },
    ];

    const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>([
      [1, { nombre: 'Harina 0000 1kg', precio_costo: 550 }],
      [2, { nombre: 'Azúcar 1kg', precio_costo: 600 }],
      [3, { nombre: 'Leche Entera 1L', precio_costo: 750 }],
    ]);

    const dataConStock = (): JornadaReportData => ({
      ...data,
      stockMovimientos,
      productosMap,
    });

    it('C3 RED: hoja Movimientos debe incluir detalle de stock cuando hay stockMovimientos', () => {
      const result = service.generarExcelJornada(dataConStock());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Find the stock section header (after movimientos rows + blank row)
      const stockHeaderIdx = json.findIndex(
        (row: unknown) => Array.isArray(row) && row[0] === 'Producto',
      );
      expect(stockHeaderIdx).toBeGreaterThan(0);
      const header = json[stockHeaderIdx] as string[];
      expect(header[0]).toBe('Producto');
      expect(header[1]).toBe('Tipo');
      expect(header[2]).toBe('Cantidad');
      expect(header[3]).toBe('Costo');
      expect(header[4]).toBe('Motivo');
      expect(header[5]).toBe('Fecha');

      // Should have header + 3 movimientos
      const stockData = json.slice(stockHeaderIdx + 1) as unknown[][];
      expect(stockData.length).toBe(3);

      // First data row: Harina 0000 1kg | Entrada | 100 | 55000 | Compra a proveedor | fecha
      expect(stockData[0][0]).toBe('Harina 0000 1kg');
      expect(stockData[0][1]).toBe('Entrada');
      expect(stockData[0][2]).toBe(100);
      expect(stockData[0][3]).toBe(55000);
      expect(stockData[0][4]).toBe('Compra a proveedor');
      expect(stockData[1][1]).toBe('Salida');
      expect(stockData[2][1]).toBe('Ajuste');
    });

    it('C3 RED: Movimientos sheet no debe tener sección de stock si stockMovimientos vacío', () => {
      const dataSinStock: JornadaReportData = { ...data, stockMovimientos: undefined };
      const result = service.generarExcelJornada(dataSinStock);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const stockHeaderIdx = json.findIndex(
        (row: unknown) => Array.isArray(row) && row[0] === 'Producto',
      );
      expect(stockHeaderIdx).toBe(-1);
    });

    it('C3 RED: generarExcelMensual debe incluir hoja "Movimientos de Stock" consolidada', () => {
      const stockMovs = stockMovimientos;
      const data1: JornadaReportData = { ...dataConStock(), jornada: { ...jornada, id: 1 }, stockMovimientos: [stockMovs[0]] };
      const data2: JornadaReportData = { ...data, jornada: { ...jornada, id: 2, fecha: '2026-06-05' }, stockMovimientos: [stockMovs[1], stockMovs[2]] };

      const result = service.generarExcelMensual([data1, data2]);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('Movimientos de Stock');
    });

    it('C3 RED: hoja Movimientos de Stock debe tener todos los movimientos del mes', () => {
      const stockMovs = stockMovimientos;
      const data1: JornadaReportData = { ...dataConStock(), jornada: { ...jornada, id: 1 }, stockMovimientos: [stockMovs[0]] };
      const data2: JornadaReportData = { ...data, jornada: { ...jornada, id: 2, fecha: '2026-06-05' }, stockMovimientos: [stockMovs[1], stockMovs[2]] };

      const result = service.generarExcelMensual([data1, data2]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos de Stock'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // header + 3 movimientos
      expect(json.length).toBe(4);
      const filas = json as unknown[][];
      expect(filas[1][1]).toBe('Entrada');
      expect(filas[2][1]).toBe('Salida');
      expect(filas[3][1]).toBe('Ajuste');
    });

  });

    it('3.5 GREEN: Cuenta Casas en hoja por jornada del Excel mensual', () => {
      const pmap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [2, { nombre: 'Coca cola', precio_costo: 100 }],
        [3, { nombre: 'Papas', precio_costo: 50 }],
      ]);
      const dataTest: JornadaReportData = { ...data, cuentaCosas: cuentaCosas, productosMap: pmap };
      const result = service.generarExcelMensual([dataTest]);
      const workbook = XLSX.read(result, { type: 'base64' });
      // La hoja por jornada debería tener la sección Cuenta Casas
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      expect(json.some((r) => r[0] === 'Cuenta Casas')).toBe(true);
      const filas = json as unknown[][];
      const totalFila = filas.find((r) => r[0] === 'Total C.C.');
      expect(totalFila).toBeDefined();
      expect(totalFila![4]).toBe(-400); // -(3*100 + 2*50)
    });
  });

  describe('Fase 3 — Arqueo de Caja en Excel', () => {
    const arqueoFaltante: ArqueoCajaEntry[] = [
      { denominacion: 500, cantidad: 10, subtotal: 5000 },
      { denominacion: 100, cantidad: 20, subtotal: 2000 },
      { denominacion: 50, cantidad: 100, subtotal: 5000 },
    ];
    // total = 12000, saldo_esperado = 18000 → diferencia = 6000 → FALTANTE

    const arqueoSobrante: ArqueoCajaEntry[] = [
      { denominacion: 1000, cantidad: 5, subtotal: 5000 },
      { denominacion: 500, cantidad: 10, subtotal: 5000 },
      { denominacion: 100, cantidad: 30, subtotal: 3000 },
    ];
    // total = 13000, saldo_esperado = 10000 → diferencia = -3000 → SOBRANTE

    it('6.1 RED: generarExcelJornada incluye hoja "Arqueo" cuando hay arqueo entries', () => {
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelJornada(dataConArqueo);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('Arqueo');
    });

    it('6.2 RED: hoja Arqueo contiene filas de denominación con valores correctos', () => {
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelJornada(dataConArqueo);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json.some((r) => r[0] === '$500' && r[1] === 10 && r[2] === 5000)).toBe(true);
      expect(json.some((r) => r[0] === '$100' && r[1] === 20 && r[2] === 2000)).toBe(true);
      expect(json.some((r) => r[0] === '$50' && r[1] === 100 && r[2] === 5000)).toBe(true);
      expect(json).toContainEqual(['Total contado', '', 12000]);
    });

    it('6.3 RED: cuando totalEnCaja < totalArqueo, muestra SOBRANTE', () => {
      // totalEnCaja = 5000+3800+0-2000 = 6800 → diff = 6800-12000 = -5200
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelJornada(dataConArqueo);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['SOBRANTE', 5200]);
    });

    it('6.4 RED: cuando totalEnCaja < totalArqueo con otro monto, muestra SOBRANTE', () => {
      // totalEnCaja = 5000+3800+0-2000 = 6800, arqueoTotal=13000 → diff = -6200
      const dataConSobrante: JornadaReportData = { ...data, arqueo: arqueoSobrante };
      const result = service.generarExcelJornada(dataConSobrante);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['SOBRANTE', 6200]);
    });

    it('6.5 RED: cuando data.arqueo es undefined, no hay hoja "Arqueo"', () => {
      const dataSinArqueo: JornadaReportData = { ...data, arqueo: undefined };
      const result = service.generarExcelJornada(dataSinArqueo);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).not.toContain('Arqueo');
    });

    it('6.6 RED: hoja por jornada del Excel mensual incluye sección Arqueo', () => {
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelMensual([dataConArqueo]);
      const workbook = XLSX.read(result, { type: 'base64' });

      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json.some((r) => r[0] === 'Arqueo de Caja')).toBe(true);
      expect(json.some((r) => r[0] === '$500' && r[1] === 10 && r[2] === 5000)).toBe(true);
      expect(json).toContainEqual(['Total contado', '', 12000]);
      // totalEnCaja = 5000+3800+0-2000 = 6800, arqueo=12000 → diff = -5200 → SOBRANTE
      expect(json).toContainEqual(['SOBRANTE', 5200]);
    });

    it('6.7 RED: cuando totalEnCaja === totalArqueo, muestra CUADRADO', () => {
      const arqueoCuadrado: ArqueoCajaEntry[] = [
        { denominacion: 5000, cantidad: 1, subtotal: 5000 },
        { denominacion: 200, cantidad: 4, subtotal: 800 },
        { denominacion: 100, cantidad: 10, subtotal: 1000 },
      ];
      // arqueoTotal = 5000+800+1000 = 6800 matches totalEnCaja
      const dataCuadrado: JornadaReportData = { ...data, arqueo: arqueoCuadrado };
      const result = service.generarExcelJornada(dataCuadrado);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['CUADRADO', 0]);
    });
  });

  // ─── fix-cierre-jornada-calculos: Task 1.3 — pendientes exclusion + net cash row ───

  describe('fix-cierre-jornada-calculos — Resumen pendientes y net cash', () => {
    const ventasConPendientes: VentaConDetalles[] = [
      {
        id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00',
        total: 850, usuario_id: 1, forma_pago: 'efectivo',
        created_at: '2026-06-04T10:00:00Z',
        detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 850, subtotal: 850 }],
      },
      {
        id: 2, jornada_id: 1, fecha_hora: '2026-06-04T11:00:00',
        total: 1500, usuario_id: 1, forma_pago: 'pendiente',
        comprador_nombre: 'Juan Pérez',
        created_at: '2026-06-04T11:00:00Z',
        detalles: [{ id: 2, venta_id: 2, producto_id: 1, cantidad: 1, precio_unitario: 1500, subtotal: 1500 }],
      },
    ];

    it('1.3 RED: Resumen "Total ventas + ingresos extra" excluye pendientes', () => {
      const dataConPendientes: JornadaReportData = {
        ...data,
        ventas: ventasConPendientes,
        movimientos: [],
        totalCosto: 0,
      };
      const result = service.generarExcelJornada(dataConPendientes);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // totalVentasSinPendientes = 850 (efectivo), totalIngresosExtra = 0
      expect(json).toContainEqual(['Total ventas + ingresos extra', 850]);
    });

    it('1.3 RED: Resumen tiene fila "Total después de retirar monto inicial"', () => {
      // totalEnCaja = 5000+3800+0-2000 = 6800, net cash = 6800-5000 = 1800
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Total después de retirar monto inicial', 1800]);
    });
  });

  // ─── fix-cierre-jornada-calculos: Task 1.4 — Arqueo usa totalEnCaja ───

  describe('fix-cierre-jornada-calculos — Arqueo sheet', () => {
    const arqueoFaltante: ArqueoCajaEntry[] = [
      { denominacion: 500, cantidad: 10, subtotal: 5000 },
      { denominacion: 100, cantidad: 20, subtotal: 2000 },
      { denominacion: 50, cantidad: 100, subtotal: 5000 },
    ];

    it('1.4 RED: Arqueo sheet faltante/sobrante usa totalEnCaja, no saldo_esperado', () => {
      // totalEnCaja = 5000+3800+0-2000 = 6800, arqueo=12000 → SOBRANTE 5200
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelJornada(dataConArqueo);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // If using saldo_esperado (18000) → FALTANTE 6000
      // If using totalEnCaja (6800) → SOBRANTE 5200
      expect(json).toContainEqual(['SOBRANTE', 5200]);
    });

    it('1.4 RED: Arqueo sheet no usa saldo_esperado (incluso si saldo_esperado difiere)', () => {
      const jornadaConSaldoAlto: Jornada = { ...jornada, saldo_esperado: 99999 };
      const dataConSaldoAlto: JornadaReportData = {
        ...data,
        jornada: jornadaConSaldoAlto,
        arqueo: arqueoFaltante,
      };
      const result = service.generarExcelJornada(dataConSaldoAlto);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Arqueo'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // SOBRANTE 5200 (from totalEnCaja), NOT FALTANTE 87999 (from saldo_esperado)
      expect(json).toContainEqual(['SOBRANTE', 5200]);
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'FALTANTE')).toBe(false);
    });
  });

  // ─── fix-cierre-jornada-calculos: Task 1.5 — Jornada sheet ───

  describe('fix-cierre-jornada-calculos — Jornada sheet (Excel mensual)', () => {
    const arqueoFaltante: ArqueoCajaEntry[] = [
      { denominacion: 500, cantidad: 10, subtotal: 5000 },
      { denominacion: 100, cantidad: 20, subtotal: 2000 },
      { denominacion: 50, cantidad: 100, subtotal: 5000 },
    ];

    const ventasConPendientes: VentaConDetalles[] = [
      {
        id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00',
        total: 1000, usuario_id: 1, forma_pago: 'efectivo',
        created_at: '2026-06-04T10:00:00Z',
        detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
      },
      {
        id: 2, jornada_id: 1, fecha_hora: '2026-06-04T11:00:00',
        total: 2000, usuario_id: 1, forma_pago: 'pendiente',
        created_at: '2026-06-04T11:00:00Z',
        detalles: [{ id: 2, venta_id: 2, producto_id: 1, cantidad: 2, precio_unitario: 1000, subtotal: 2000 }],
      },
    ];

    it('1.5 RED: Jornada sheet "Total ventas + ingresos extra" excluye pendientes', () => {
      const dataConPendientes: JornadaReportData = {
        ...data,
        ventas: ventasConPendientes,
        movimientos: [],
        totalCosto: 0,
      };
      const result = service.generarExcelMensual([dataConPendientes]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // totalVentasSinPendientes = 1000, totalIngresosExtra = 0 → 1000
      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Total ventas + ingresos extra' && (r as unknown[])[1] === 1000)).toBe(true);
    });

    it('1.5 RED: Jornada sheet tiene fila "Total después de retirar monto inicial"', () => {
      // totalEnCajaJ = 5000+3800+0-2000 = 6800, net = 6800-5000 = 1800
      const result = service.generarExcelMensual([data]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json.some((r: unknown) => (r as unknown[])[0] === 'Total después de retirar monto inicial' && (r as unknown[])[1] === 1800)).toBe(true);
    });

    it('1.5 RED: Jornada sheet arqueo usa totalEnCaja no saldo_esperado', () => {
      // totalEnCaja = 5000+3800+0-2000 = 6800, arqueo=12000 → SOBRANTE 5200
      const dataConArqueo: JornadaReportData = { ...data, arqueo: arqueoFaltante };
      const result = service.generarExcelMensual([dataConArqueo]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['SOBRANTE', 5200]);
    });
  });

  // ─── Step 4: IPVE sheet (inversión por producto) ───

  describe('IPVE sheet', () => {
    const ipveProductosMap = new Map<number, { nombre: string; precio_costo: number | null; stock_almacen?: number; stock_shop?: number; precio_venta?: number }>([
      [1, { nombre: 'Harina 0000 1kg', precio_costo: 550, precio_venta: 850, stock_almacen: 80, stock_shop: 20 }],
      [2, { nombre: 'Azúcar 1kg', precio_costo: 600, precio_venta: 900, stock_almacen: 25, stock_shop: 5 }],
      [3, { nombre: 'Leche Entera 1L', precio_costo: 750, precio_venta: 1100, stock_almacen: 50, stock_shop: 10 }],
    ]);
    const ipveInversion = new Map<number, number>([
      [1, 55000],
      [2, 18000],
      [3, 37500],
    ]);

    const ipveData = (): JornadaReportData => ({
      ...data,
      productosMap: ipveProductosMap,
      inversionPorProducto: ipveInversion,
    });

    it('4.1 RED: debería incluir hoja "ipve" cuando inversionPorProducto está definido', () => {
      const result = service.generarExcelJornada(ipveData());
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('ipve');
    });

    it('4.2 RED: hoja ipve debe tener 7 columnas con precio_venta, ingreso y ganancia', () => {
      const result = service.generarExcelJornada(ipveData());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const header = json[0] as string[];
      expect(header[0]).toBe('Nombre');
      expect(header[1]).toBe('Stock Almacén');
      expect(header[2]).toBe('Stock Tienda');
      expect(header[3]).toBe('Precio Venta');
      expect(header[4]).toBe('Ingreso Esperado');
      expect(header[5]).toBe('Total Invertido');
      expect(header[6]).toBe('Ganancia Potencial');
    });

    it('4.3 RED: hoja ipve debe calcular ingreso y ganancia por producto', () => {
      const result = service.generarExcelJornada(ipveData());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      // Harina: precio_venta=850, ingreso=(80+20)*850=85000, inversion=55000, ganancia=85000-55000=30000
      const harinaRow = filas.find((r) => r[0] === 'Harina 0000 1kg');
      expect(harinaRow).toBeTruthy();
      expect(harinaRow![1]).toBe(80);
      expect(harinaRow![2]).toBe(20);
      expect(harinaRow![3]).toBe(850);
      expect(harinaRow![4]).toBe(85000);
      expect(harinaRow![5]).toBe(55000);
      expect(harinaRow![6]).toBe(30000);

      // Azúcar: precio_venta=900, ingreso=(25+5)*900=27000, inversion=18000, ganancia=27000-18000=9000
      const azucarRow = filas.find((r) => r[0] === 'Azúcar 1kg');
      expect(azucarRow).toBeTruthy();
      expect(azucarRow![1]).toBe(25);
      expect(azucarRow![2]).toBe(5);
      expect(azucarRow![3]).toBe(900);
      expect(azucarRow![4]).toBe(27000);
      expect(azucarRow![5]).toBe(18000);
      expect(azucarRow![6]).toBe(9000);
    });

    it('4.6 RED: merma debe estar en columna 8 (después de 7 columnas + blank)', () => {
      const jornadaConMerma: Jornada = { ...jornada, total_merma: 2500 };
      const dataConMerma: JornadaReportData = { ...ipveData(), jornada: jornadaConMerma };
      const result = service.generarExcelJornada(dataConMerma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Merma is placed at column offset 8 (0-indexed) — after 7 data cols + 1 blank
      const mermaRow = (json as unknown[][]).find((r) => r[8] === 'Merma del día');
      expect(mermaRow).toBeTruthy();
      expect(mermaRow![9]).toBe(2500);
    });

    it('4.4 RED: hoja ipve debe tener fila de totales con suma correcta', () => {
      const result = service.generarExcelJornada(ipveData());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      const totalRow = filas.find((r) => r[0] === 'TOTALES');
      expect(totalRow).toBeTruthy();
      // Totales esperados: ingreso=178000, inversion=110500, ganancia=67500
      expect(totalRow![4]).toBe(178000);
      expect(totalRow![5]).toBe(110500);
      expect(totalRow![6]).toBe(67500);
    });

    it('4.5 RED: producto con precio_venta null debe renderizar "—" en precio, ingreso y ganancia', () => {
      const pmapSinPrecio = new Map<number, { nombre: string; precio_costo: number | null; stock_almacen?: number; stock_shop?: number; precio_venta?: number }>([
        [1, { nombre: 'Producto Sin Precio', precio_costo: 500, precio_venta: undefined, stock_almacen: 10, stock_shop: 5 }],
      ]);
      const invSinPrecio = new Map<number, number>([[1, 7500]]);
      const dataSinPrecio: JornadaReportData = { ...data, productosMap: pmapSinPrecio, inversionPorProducto: invSinPrecio };
      const result = service.generarExcelJornada(dataSinPrecio);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      const row = filas.find((r) => r[0] === 'Producto Sin Precio');
      expect(row![3]).toBe('—');
      expect(row![4]).toBe('—');
      expect(row![6]).toBe('—');
    });

    it('4.1 RED: cuando inversionPorProducto es undefined, no debe incluir hoja ipve', () => {
      const dataSinIpve: JornadaReportData = { ...data, inversionPorProducto: undefined };
      const result = service.generarExcelJornada(dataSinIpve);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).not.toContain('ipve');
    });

    it('4.1 RED: producto sin inversión debe mostrar 0 en Total Invertido', () => {
      const inversionParcial = new Map<number, number>([
        [1, 55000],
        // producto 2 no tiene inversión
        [3, 37500],
      ]);
      const dataParcial = (): JornadaReportData => ({
        ...data,
        productosMap: ipveProductosMap,
        inversionPorProducto: inversionParcial,
      });
      const result = service.generarExcelJornada(dataParcial());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['ipve'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const azucarRow = (json as unknown[][]).find((r) => r[0] === 'Azúcar 1kg');
      expect(azucarRow).toBeTruthy();
      // Azúcar has precio_venta, so Total Invertido is at column 5
      expect(azucarRow![5]).toBe(0);
    });
  });

  // ─── Step 5: Movimientos stock operations summary ───

  describe('Movimientos summary', () => {
    const stockConResumen: StockMovimiento[] = [
      { id: 1, producto_id: 1, cantidad: 100, tipo: 'entrada', motivo: 'Compra', costo_total: 0, created_at: '' },
      { id: 2, producto_id: 2, cantidad: 50, tipo: 'entrada', motivo: 'Compra 2', costo_total: 0, created_at: '' },
      { id: 3, producto_id: 1, cantidad: 10, tipo: 'salida', motivo: 'Venta', costo_total: 0, created_at: '' },
      { id: 4, producto_id: 2, cantidad: 5, tipo: 'merma', motivo: 'Vencido', costo_total: 0, created_at: '' },
      { id: 5, producto_id: 3, cantidad: 3, tipo: 'ajuste', motivo: 'Inventario', costo_total: 0, created_at: '' },
    ];

    const dataConResumen = (): JornadaReportData => ({
      ...data,
      stockMovimientos: stockConResumen,
    });

    it('5.1 RED: Movimientos sheet debe incluir detalle de stock después de movimientos', () => {
      const result = service.generarExcelJornada(dataConResumen());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Find "Producto" header which marks start of stock section
      const stockHeader = (json as unknown[][]).find((r) => r[0] === 'Producto');
      expect(stockHeader).toBeTruthy();
    });

    it('5.1 RED: detalle de stock debe tener filas por cada movimiento', () => {
      const result = service.generarExcelJornada(dataConResumen());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      const stockHeaderIdx = filas.findIndex((r) => r[0] === 'Producto');
      expect(stockHeaderIdx).toBeGreaterThan(0);

      const stockData = filas.slice(stockHeaderIdx + 1);
      // 5 movimientos: 2 entrada + 1 salida + 1 merma + 1 ajuste
      expect(stockData.length).toBe(5);

      const entradaRows = stockData.filter((r) => r[1] === 'Entrada');
      expect(entradaRows.length).toBe(2);

      const salidaRow = stockData.find((r) => r[1] === 'Salida');
      expect(salidaRow).toBeTruthy();

      const mermaRow = stockData.find((r) => r[1] === 'Merma');
      expect(mermaRow).toBeTruthy();

      const ajusteRow = stockData.find((r) => r[1] === 'Ajuste');
      expect(ajusteRow).toBeTruthy();
    });

    it('5.1 RED: detalle de stock debe incluir costo_total por fila', () => {
      const result = service.generarExcelJornada(dataConResumen());
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filas = json as unknown[][];
      const stockHeaderIdx = filas.findIndex((r) => r[0] === 'Producto');
      const stockData = filas.slice(stockHeaderIdx + 1);
      // All test data has costo_total: 0, so each row should have 0 in the Costo column (index 3)
      stockData.forEach((r) => {
        expect(r[3]).toBe(0);
      });
    });

    it('5.1 RED: detalle de stock debe aparecer aunque no haya movimientos tradicionales', () => {
      const dataSoloStock: JornadaReportData = {
        ...data,
        movimientos: [],
        stockMovimientos: stockConResumen,
      };
      const result = service.generarExcelJornada(dataSoloStock);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Debe tener la tabla de detalle de stock con header Producto
      expect((json as unknown[][]).some((r) => r[0] === 'Producto')).toBe(true);
    });
  });

  // ─── fix-cierre-jornada-calculos: Task 1.6 — Resumen del Mes ───

  describe('fix-cierre-jornada-calculos — Resumen del Mes', () => {
    it('1.6 RED: Resumen del Mes "Total ventas + ingresos extra" excluye pendientes', () => {
      const dataConPendientes: JornadaReportData = {
        ...data,
        ventas: [
          {
            id: 1, jornada_id: 1, fecha_hora: '',
            total: 3000, usuario_id: 1, forma_pago: 'efectivo',
            created_at: '',
            detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 1, precio_unitario: 3000, subtotal: 3000 }],
          },
          {
            id: 2, jornada_id: 1, fecha_hora: '',
            total: 1000, usuario_id: 1, forma_pago: 'pendiente',
            created_at: '',
            detalles: [{ id: 2, venta_id: 2, producto_id: 1, cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
          },
        ],
        movimientos: [],
        totalCosto: 0,
      };
      const result = service.generarExcelMensual([dataConPendientes]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen del Mes'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // totalVentasSinPendientes = 3000, totalIngresosExtra = 0 → 3000
      expect(json).toContainEqual(['Total ventas + ingresos extra', 3000]);
    });
  });

  // ─── PR 1: mejoras-excel-divisas ───

  describe('PR 1 — mejoras-excel-divisas', () => {
    const productosConVenta =
      new Map<number, { nombre: string; precio_costo: number | null; precio_venta?: number }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: 400, precio_venta: 850 }],
        [2, { nombre: 'Agua 1L', precio_costo: 600, precio_venta: 1100 }],
        [3, { nombre: 'Chocolate', precio_costo: 80, precio_venta: 150 }],
      ]);

    it('PR1 RED: header debe incluir columna "Precio venta" entre Precio unitario y Total', () => {
      const dataConMap: JornadaReportData = { ...data, productosMap: productosConVenta, totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataConMap);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const header = json[0] as string[];
      expect(header[0]).toBe('Producto');
      expect(header[1]).toBe('Cantidad');
      expect(header[2]).toBe('Precio unitario');
      expect(header[3]).toBe('Precio venta');
      expect(header[4]).toBe('Total');
      expect(header[5]).toBe('Forma de pago');
    });

    it('PR1 RED: detalle debe mostrar precio_venta del producto en columna 3', () => {
      const dataConMap: JornadaReportData = { ...data, productosMap: productosConVenta, totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataConMap);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      const cocaRow = filas.find((r) => r[0] === 'Coca-Cola 500ml') as unknown[];
      expect(cocaRow[3]).toBe(850);
    });

    it('PR1 RED: producto sin precio_venta debe mostrar "—"', () => {
      const pmap = new Map<number, { nombre: string; precio_costo: number | null }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: 400 }],
      ]);
      const dataSinPV: JornadaReportData = {
        ...data,
        ventas: [ventaConDetalles[0]],
        productosMap: pmap,
        totalCosto: 0,
        userCierreNombre: null,
      };
      const result = service.generarExcelJornada(dataSinPV);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      const cocaRow = filas.find((r) => r[0] === 'Coca-Cola 500ml') as unknown[];
      expect(cocaRow[3]).toBe('—');
    });

    it('PR1 RED: venta con 1 solo producto NO debe tener fila de subtotal', () => {
      const singleVenta = ventaConDetalles.slice(0, 1);
      const dataSingle: JornadaReportData = { ...data, ventas: singleVenta, totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataSingle);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      expect(filas.some((f) => String(f[0] ?? '').startsWith('Total venta'))).toBe(false);
    });

    it('PR1 RED: venta con 2+ productos debe mostrar fila de subtotal con total', () => {
      const dataMulti: JornadaReportData = { ...data, totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataMulti);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      const subRow = filas.find((f) => f[0] === 'Total venta #2');
      expect(subRow).toBeTruthy();
      expect(subRow![4]).toBe(2950); // venta 2 total
    });

    it('PR1 RED: multi-lot debe mostrar desglose por lote + fila de subtotal del producto', () => {
      const ventaLotes: VentaLote[] = [
        { id: 1, venta_id: 1, lote_id: 10, producto_id: 1, cantidad: 2, precio_costo_real: 400, created_at: '' },
        { id: 2, venta_id: 1, lote_id: 11, producto_id: 1, cantidad: 3, precio_costo_real: 400, created_at: '' },
      ];
      const pmap = new Map<number, { nombre: string; precio_costo: number | null; precio_venta?: number }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: 400, precio_venta: 850 }],
      ]);
      const dataConLotes: JornadaReportData = {
        jornada,
        ventas: [{
          id: 1, jornada_id: 1, fecha_hora: '', total: 4250,
          usuario_id: 1, forma_pago: 'efectivo',
          created_at: '',
          detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 5, precio_unitario: 850, subtotal: 4250 }],
        }],
        movimientos: [],
        ventaLotes,
        productosMap: pmap,
        totalCosto: 0,
        userCierreNombre: null,
      };
      const result = service.generarExcelJornada(dataConLotes);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      // Debe tener filas de lote
      expect(filas.some((f) => f[0] === '  └ Lote #10')).toBe(true);
      expect(filas.some((f) => f[0] === '  └ Lote #11')).toBe(true);
      // Debe tener subtotal del producto con suma de subtotales de lotes
      const subRow = filas.find((f) => String(f[0] ?? '').includes('Subtotal Coca-Cola 500ml'));
      expect(subRow).toBeTruthy();
      expect(subRow![4]).toBe(4250); // 2*850 + 3*850
    });

    it('PR1 RED: multi-item + multi-lot combinados deben mostrar ambos subtotales', () => {
      const ventaLotes: VentaLote[] = [
        { id: 1, venta_id: 2, lote_id: 20, producto_id: 1, cantidad: 1, precio_costo_real: 400, created_at: '' },
        { id: 2, venta_id: 2, lote_id: 21, producto_id: 1, cantidad: 1, precio_costo_real: 400, created_at: '' },
      ];
      const pmap = new Map<number, { nombre: string; precio_costo: number | null; precio_venta?: number }>([
        [1, { nombre: 'Coca-Cola 500ml', precio_costo: 400, precio_venta: 850 }],
        [2, { nombre: 'Agua 1L', precio_costo: 600, precio_venta: 1100 }],
        [3, { nombre: 'Chocolate', precio_costo: 80, precio_venta: 150 }],
      ]);
      const dataMix: JornadaReportData = { ...data, ventaLotes, productosMap: pmap, totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataMix);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];
      // Venta #2 debe tener subtotal
      expect(filas.some((f) => f[0] === 'Total venta #2')).toBe(true);
      // Lotes para venta #2 deben aparecer
      expect(filas.some((f) => f[0] === '  └ Lote #20')).toBe(true);
      expect(filas.some((f) => f[0] === '  └ Lote #21')).toBe(true);
      // Subtotal de producto debe estar
      expect(filas.some((f) => String(f[0] ?? '').includes('Subtotal Coca-Cola 500ml'))).toBe(true);
      // Venta #1 (1 producto) NO debe tener subtotal
      expect(filas.some((f) => f[0] === 'Total venta #1')).toBe(false);
    });
  });

  describe('Compra divisa en Excel', () => {
    const ventaDivisaUSD = {
      id: 1, jornada_id: 1, fecha_hora: '2026-07-28T10:00:00Z',
      total: 12000, usuario_id: 1, forma_pago: 'divisas',
      divisa_tipo: 'USD', monto_divisa: 20, tasa_cambio: 600,
      created_at: '',
      detalles: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: 10, precio_unitario: 1200, subtotal: 12000 }],
    };

    const movCompraUSD = {
      id: 1, jornada_id: 1, tipo: 'compra_divisa' as const,
      descripcion: 'Compra USD 100 @ 120',
      monto: 12000, divisa_tipo: 'USD' as const, monto_divisa: 100, tasa_cambio: 120,
      created_at: '',
    };

    const movCompraEUR = {
      id: 2, jornada_id: 1, tipo: 'compra_divisa' as const,
      descripcion: 'Compra EUR 50 @ 130',
      monto: 6500, divisa_tipo: 'EUR' as const, monto_divisa: 50, tasa_cambio: 130,
      created_at: '',
    };

    it('Resumen debe mostrar USD/EUR de ventas y de compra separados', () => {
      const dataDivisa: JornadaReportData = {
        ...data,
        ventas: [ventaDivisaUSD as VentaConDetalles],
        movimientos: [movCompraUSD, movCompraEUR],
        totalCosto: 0,
        userCierreNombre: null,
      };
      const result = service.generarExcelJornada(dataDivisa);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];

      // Should show USD de ventas: 20 (from ventaDivisaUSD)
      expect(filas.some(r => r[0] === 'USD de ventas' && r[1] === 20)).toBe(true);
      // USD de compra: 100
      expect(filas.some(r => r[0] === 'USD de compra' && r[1] === 100)).toBe(true);
      // Total USD: 120
      expect(filas.some(r => r[0] === 'Total USD' && r[1] === 120)).toBe(true);
      // EUR de compra: 50
      expect(filas.some(r => r[0] === 'EUR de compra' && r[1] === 50)).toBe(true);
    });

    it('Movimientos sheet debe mostrar compra_divisa con detalles de divisa', () => {
      const dataMov: JornadaReportData = {
        ...data,
        movimientos: [movCompraUSD, movCompraEUR],
        totalCosto: 0,
        userCierreNombre: null,
      };
      const result = service.generarExcelJornada(dataMov);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Movimientos'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const filas = json as unknown[][];

      // Header should have Divisa, Monto en divisa, Tasa de cambio, Total CUP columns
      const header = filas[0];
      expect(header).toContain('Divisa');
      expect(header).toContain('Monto en divisa');
      expect(header).toContain('Tasa de cambio');
      expect(header).toContain('Total CUP');

      // Rows should show compra_divisa details
      expect(filas.some(r => r[0] === 'Compra divisa' && r[1] === 'Compra USD 100 @ 120' && r[2] === 'USD' && r[3] === 100 && r[4] === 120 && r[5] === 12000)).toBe(true);
      expect(filas.some(r => r[0] === 'Compra divisa' && r[1] === 'Compra EUR 50 @ 130' && r[2] === 'EUR' && r[3] === 50 && r[4] === 130 && r[5] === 6500)).toBe(true);
    });
  });

  // ─── PR 3 (pagar-pendiente): fila cobro + hoja Pendientes Acumulados (FR-7/9, AC8/11) ───

  describe('Pagar Pendiente — fila cobro en Excel Ventas (FR-7/AC8)', () => {
    const ventaCobro: VentaConDetalles = {
      id: 100,
      jornada_id: 1,
      fecha_hora: '2026-06-04T16:00:00',
      total: 2000,
      usuario_id: 1,
      forma_pago: 'efectivo',
      cobro_de_venta_id: 42,
      created_at: '2026-06-04T16:00:00Z',
      detalles: [],
    };

    it('RED: venta sin detalles se renderiza como fila única "Cobrar Pendiente #42" sin crash', () => {
      const dataCobro: JornadaReportData = {
        ...data,
        ventas: [ventaCobro],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataCobro);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const fila = json.find((f) => f[0] === 'Cobrar Pendiente #42') as unknown[];
      expect(fila).toBeTruthy();
      expect(fila[4]).toBe(2000); // Total = total del cobro
    });

    it('RED: el total del cobro suma a totalCaja y a Total esperado del día', () => {
      const dataCobro: JornadaReportData = {
        ...data,
        ventas: [...ventaConDetalles, ventaCobro],
        movimientos,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataCobro);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const cajaRow = json.find((f) => f[0] === 'Total de ingresos en ventas') as unknown[];
      expect(cajaRow).toBeTruthy();
      expect(cajaRow[4]).toBe(5800); // 3800 (ventas con detalle) + 2000 (cobro)

      const esperadoRow = json.find((f) => f[0] === 'Total esperado') as unknown[];
      expect(esperadoRow).toBeTruthy();
      expect(esperadoRow[4]).toBe(5800);
    });

    it('RED: Resumen "Total ventas + ingresos extra" incluye el cobro como cualquier venta', () => {
      const dataCobro: JornadaReportData = {
        ...data,
        ventas: [ventaCobro],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataCobro);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Total ventas + ingresos extra', 2000]);
    });
  });

  describe('Pagar Pendiente — hoja Pendientes Acumulados (FR-9/AC11)', () => {
    const pendientes: PendienteAcumulado[] = [
      { id: 1, comprador: 'Ana', fechaOriginal: '2026-06-01T10:00:00Z', monto: 500, antiguedadDias: 3 },
      { id: 2, comprador: 'Pendiente #2', fechaOriginal: '2026-06-04T09:00:00Z', monto: 1500, antiguedadDias: 0 },
    ];

    function dataConPendientes(): JornadaReportData {
      return {
        ...data,
        ventas: [],
        movimientos: [],
        totalCosto: 0,
        userCierreNombre: null,
        pendientesAcumulados: pendientes,
      };
    }

    it('RED: genera hoja "Pendientes Acumulados" con header y filas cross-day', () => {
      const result = service.generarExcelJornada(dataConPendientes());
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('Pendientes Acumulados');
      const sheet = workbook.Sheets['Pendientes Acumulados'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json[0]).toEqual(['Comprador', 'Fecha original', 'Monto', 'Antigüedad (días)']);
      // Cada pendiente con su fecha original y antigüedad (días desde la venta original)
      expect(json[1]).toEqual(['Ana', '2026-06-01T10:00:00Z', 500, 3]);
      expect(json[2]).toEqual(['Pendiente #2', '2026-06-04T09:00:00Z', 1500, 0]);
      // Fila total con la suma de montos (label en col A, suma en col Monto)
      expect(json[json.length - 1]).toEqual(['Total', '', 2000, '']);
    });

    it('RED: caso mixto mismo día — antigüedad 0 en pendientes creados hoy', () => {
      const mixto: PendienteAcumulado[] = [
        { id: 3, comprador: 'Hoy', fechaOriginal: '2026-06-04T08:00:00Z', monto: 300, antiguedadDias: 0 },
        { id: 1, comprador: 'Ayer', fechaOriginal: '2026-06-03T08:00:00Z', monto: 700, antiguedadDias: 1 },
      ];
      const dataMixto: JornadaReportData = { ...dataConPendientes(), pendientesAcumulados: mixto };

      const result = service.generarExcelJornada(dataMixto);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Pendientes Acumulados'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const filaHoy = json.find((f) => f[0] === 'Hoy') as unknown[];
      expect(filaHoy[3]).toBe(0);
      const filaAyer = json.find((f) => f[0] === 'Ayer') as unknown[];
      expect(filaAyer[3]).toBe(1);
    });

    it('RED: cero pendientes → hoja omitida y Resumen "Pendientes del día" intacto', () => {
      const dataSinPend: JornadaReportData = { ...data, pendientesAcumulados: [], totalCosto: 0, userCierreNombre: null };
      const result = service.generarExcelJornada(dataSinPend);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).not.toContain('Pendientes Acumulados');
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      expect(json).toContainEqual(['Pendientes del día', 0]);
    });
  });

  // ─── fix-reanudar-jornada-acceso: FR-6 — "Abierta por A / Cerrada por B" ───

  describe('FR-6 — Abierta por / Cerrada por (firma condicional)', () => {
    it('RED: A≠B — Resumen muestra "Abierta por Ana" + "Cerrada por Beto" (no "Firmado por")', () => {
      const dataAB: JornadaReportData = {
        ...data,
        userAperturaNombre: 'Ana',
        userCierreNombre: 'Beto',
      };

      const result = service.generarExcelJornada(dataAB);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Abierta por', 'Ana']);
      expect(json).toContainEqual(['Cerrada por', 'Beto']);
      expect(json.some((f) => (f as unknown[])[0] === 'Firmado por')).toBe(false);
    });

    it('RED: A===B — Resumen muestra única fila "Firmado por" (igual que hoy)', () => {
      const dataAB: JornadaReportData = {
        ...data,
        userAperturaNombre: 'Beto',
        userCierreNombre: 'Beto',
      };

      const result = service.generarExcelJornada(dataAB);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Firmado por', 'Beto']);
      expect(json.some((f) => (f as unknown[])[0] === 'Abierta por')).toBe(false);
      expect(json.some((f) => (f as unknown[])[0] === 'Cerrada por')).toBe(false);
    });

    it('RED: apertura NULL legacy — Resumen mantiene "Firmado por" (back-compat)', () => {
      const dataLegacy: JornadaReportData = {
        ...data,
        userAperturaNombre: null,
        userCierreNombre: 'Admin',
      };

      const result = service.generarExcelJornada(dataLegacy);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Firmado por', 'Admin']);
      expect(json.some((f) => (f as unknown[])[0] === 'Abierta por')).toBe(false);
    });

    it('RED: A≠B — hoja de jornada del Excel mensual muestra "Abierta por"/"Cerrada por"', () => {
      const dataAB: JornadaReportData = {
        ...data,
        userAperturaNombre: 'Ana',
        userCierreNombre: 'Beto',
      };

      const result = service.generarExcelMensual([dataAB]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Abierta por', 'Ana']);
      expect(json).toContainEqual(['Cerrada por', 'Beto']);
      expect(json.some((f) => (f as unknown[])[0] === 'Firmado por')).toBe(false);
    });

    it('RED: A===B — hoja de jornada mantiene "Firmado por" única', () => {
      const dataAB: JornadaReportData = {
        ...data,
        userAperturaNombre: 'Beto',
        userCierreNombre: 'Beto',
      };

      const result = service.generarExcelMensual([dataAB]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Firmado por', 'Beto']);
      expect(json.some((f) => (f as unknown[])[0] === 'Abierta por')).toBe(false);
    });

    it('RED: apertura NULL — hoja de jornada mantiene "Firmado por" (back-compat)', () => {
      const dataLegacy: JornadaReportData = {
        ...data,
        userAperturaNombre: null,
        userCierreNombre: 'Admin',
      };

      const result = service.generarExcelMensual([dataLegacy]);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['2026-06-04 (1)'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Firmado por', 'Admin']);
      expect(json.some((f) => (f as unknown[])[0] === 'Abierta por')).toBe(false);
    });
  });
});
