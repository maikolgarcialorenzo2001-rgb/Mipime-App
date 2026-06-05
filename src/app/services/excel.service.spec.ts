import { TestBed } from '@angular/core/testing';
import { ExcelService, type JornadaReportData } from './excel.service';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { VentaConDetalles } from './excel.service';
import type { Movimiento } from '../models/movimiento';

describe('ExcelService', () => {
  let service: ExcelService;

  const jornada: Jornada = {
    id: 1,
    fecha: '2026-06-04',
    hora_apertura: '09:00:00',
    hora_cierre: '18:30:00',
    monto_inicial: 5000,
    total_ventas: 15000,
    total_gastos: 2000,
    saldo_esperado: 18000,
    saldo_real: 17800,
    estado: 'cerrada',
    user_cierre_id: 1,
    created_at: '2026-06-04T09:00:00Z',
    updated_at: '2026-06-04T18:30:00Z',
  };

  const ventaConDetalles: VentaConDetalles[] = [
    {
      id: 1,
      jornada_id: 1,
      fecha_hora: '2026-06-04T10:00:00',
      total: 850,
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
      const productosMap = new Map<number, string>([
        [1, 'Coca-Cola 500ml'],
        [2, 'Agua 1L'],
        [3, 'Chocolate'],
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

    it('2.2 RED: debería omitir fila "Total gastos" cuando total_gastos = 0', () => {
      const jornadaSinGastos: Jornada = {
        ...jornada,
        total_gastos: 0,
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

      expect(json).not.toContainEqual(['Total gastos', 0]);
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
      expect(json).toContainEqual(['Monto inicial', 5000]);
      expect(json).toContainEqual(['Total ventas', 15000]);
      expect(json).toContainEqual(['Total gastos', 2000]);
      expect(json).toContainEqual(['Saldo esperado', 18000]);
      expect(json).toContainEqual(['Saldo real', 17800]);
    });

    it('debería listar todas las ventas con sus detalles', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });

      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      // Header row + 4 detail rows + empty row + footer row
      expect(json.length).toBe(7);

      // Primera fila de detalle: [producto_id, cantidad, precio_unitario, subtotal, forma_pago]
      expect(json[1]).toContainEqual(850);
      // Segunda venta, primer detalle
      expect(json[2]).toContainEqual(1700);
      expect(json[3]).toContainEqual(1100);
      expect(json[4]).toContainEqual(150);

      // Footer row
      const footerRow = json[6] as unknown[];
      expect(footerRow[0]).toBe('Total ingresos');
      expect(footerRow[3]).toBe(3800);
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
      expect(ventasJson.length).toBe(3); // header + empty row + footer row
    });
  });

  describe('Ventas restructuring', () => {
    it('3.1 RED: header debería tener columnas Producto, Cantidad, Precio unitario, Total, Forma de pago', () => {
      const result = service.generarExcelJornada(data);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Ventas'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const header = json[0] as string[];
      expect(header[0]).toBe('Producto');
      expect(header[1]).toBe('Cantidad');
      expect(header[2]).toBe('Precio unitario');
      expect(header[3]).toBe('Total');
      expect(header[4]).toBe('Forma de pago');
      expect(header).toHaveLength(5);
    });

    it('3.1 RED: una fila por detalle con nombre de producto resuelto', () => {
      const productosMap = new Map<number, string>([
        [1, 'Coca-Cola 500ml'],
        [2, 'Agua 1L'],
        [3, 'Chocolate'],
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

      // 1 header + 4 detalle rows + 1 footer + 1 empty = 7
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
      // Find footer row - should contain 'Total ingresos' and the grand total
      const footerRow = filas.find((f) => f[0] === 'Total ingresos');
      expect(footerRow).toBeTruthy();
      // Total = 850 + 1700 + 1100 + 150 = 3800
      expect(footerRow![3]).toBe(3800);
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
      const footerRow = filas.find((f) => f[0] === 'Total ingresos');
      expect(footerRow).toBeTruthy();
      expect(footerRow![3]).toBe(0);
    });
  });

  describe('Ganancia bruta y Firmado por en Resumen', () => {
    it('3.3 RED: Resumen debe incluir Ganancia bruta = total_ventas - total_costo', () => {
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

      expect(json).toContainEqual(['Ganancia bruta', 14960]); // 15000 - 40
    });

    it('3.3 RED: Ganancia bruta debe ser total_ventas cuando total_costo = 0', () => {
      const dataSinCosto: JornadaReportData = {
        ...data,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataSinCosto);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Ganancia bruta', 15000]);
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

    it('4.1 RED: Resumen debería tener desglose total efectivo/transferencia', () => {
      const dataConForma: JornadaReportData = {
        jornada,
        ventas: ventasConFormaPago,
        movimientos,
        totalCosto: 0,
        userCierreNombre: null,
      };

      const result = service.generarExcelJornada(dataConForma);
      const workbook = XLSX.read(result, { type: 'base64' });
      const sheet = workbook.Sheets['Resumen'];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      expect(json).toContainEqual(['Total efectivo', 1000]);
      expect(json).toContainEqual(['Total transferencia', 2500]);
    });
  });
});
