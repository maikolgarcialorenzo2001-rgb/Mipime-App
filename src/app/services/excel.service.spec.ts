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

      // Header row + 4 detail rows
      expect(json.length).toBe(5);

      // Primera fila de detalle
      expect(json[1]).toContainEqual(850);
      // Segunda venta, primer detalle
      expect(json[2]).toContainEqual(1700);
      expect(json[3]).toContainEqual(1100);
      expect(json[4]).toContainEqual(150);
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
      };

      const result = service.generarExcelJornada(dataVacia);
      const workbook = XLSX.read(result, { type: 'base64' });

      expect(workbook.SheetNames).toContain('Resumen');
      expect(workbook.SheetNames).toContain('Ventas');

      const ventasSheet = workbook.Sheets['Ventas'];
      const ventasJson = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 }) as unknown[][];
      expect(ventasJson.length).toBe(1); // solo header
    });
  });
});
