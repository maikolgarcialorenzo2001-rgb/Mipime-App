import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';

export interface VentaConDetalles extends Venta {
  detalles: DetalleVenta[];
}

export interface JornadaReportData {
  jornada: Jornada;
  ventas: VentaConDetalles[];
  movimientos: Movimiento[];
}

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  /**
   * Genera un archivo Excel (.xlsx) con el resumen de una jornada:
   * - Hoja "Resumen": datos generales de la jornada
   * - Hoja "Ventas": listado de ventas con detalle de productos
   * - Hoja "Movimientos": gastos e ingresos extra
   *
   * @returns string en base64 del archivo xlsx
   */
  generarExcelJornada(data: JornadaReportData): string {
    const wb = XLSX.utils.book_new();

    this._agregarResumen(wb, data);
    this._agregarVentas(wb, data);
    this._agregarMovimientos(wb, data);

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  private _agregarResumen(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const j = data.jornada;
    const filas: unknown[][] = [
      ['Mipime-Cuentas — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', j.estado === 'abierta' ? 'Abierta' : 'Cerrada'],
      [],
      ['Monto inicial', j.monto_inicial],
      ['Total ventas', j.total_ventas],
      ['Total gastos', j.total_gastos],
      ['Saldo esperado', j.saldo_esperado],
    ];

    if (j.saldo_real !== null) {
      filas.push(['Saldo real', j.saldo_real]);
      filas.push(['Diferencia', j.saldo_esperado - j.saldo_real]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);

    // Ajustar ancho de columnas
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  }

  private _agregarVentas(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const filas: unknown[][] = [
      ['#', 'Fecha/Hora', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Total venta'],
    ];

    let nro = 1;
    for (const venta of data.ventas) {
      let primerDetalle = true;
      for (const detalle of venta.detalles) {
        filas.push([
          primerDetalle ? nro : '',
          primerDetalle ? venta.fecha_hora : '',
          detalle.producto_id,
          detalle.cantidad,
          detalle.precio_unitario,
          detalle.subtotal,
          primerDetalle ? venta.total : '',
        ]);
        primerDetalle = false;
      }
      nro++;
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  }

  private _agregarMovimientos(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const filas: unknown[][] = [
      ['Tipo', 'Descripción', 'Monto'],
    ];

    for (const mov of data.movimientos) {
      filas.push([
        mov.tipo === 'gasto' ? 'Gasto' : 'Ingreso extra',
        mov.descripcion,
        mov.monto,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 40 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  }
}
