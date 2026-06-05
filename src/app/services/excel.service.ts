import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';

export interface ProductoInfo {
  nombre: string;
  precio_costo: number | null;
}

export interface VentaConDetalles extends Venta {
  detalles: DetalleVenta[];
}

export interface JornadaReportData {
  jornada: Jornada;
  ventas: VentaConDetalles[];
  movimientos: Movimiento[];
  productosMap?: Map<number, ProductoInfo>;
  totalCosto: number;
  userCierreNombre: string | null;
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
    const ventas = data.ventas;
    const gananciaBruta = j.total_ventas - data.totalCosto;

    // Calcular desglose por forma de pago
    const totalEfectivo = ventas
      .filter((v) => v.forma_pago === 'efectivo')
      .reduce((sum, v) => sum + v.total, 0);
    const totalTransferencia = ventas
      .filter((v) => v.forma_pago === 'transferencia')
      .reduce((sum, v) => sum + v.total, 0);

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
      ['Total efectivo', totalEfectivo],
      ['Total transferencia', totalTransferencia],
      ['Total gastos', j.total_gastos],
      ['Ganancia bruta', gananciaBruta],
      ['Saldo esperado', j.saldo_esperado],
    ];

    if (j.saldo_real !== null) {
      filas.push(['Saldo real', j.saldo_real]);
      filas.push(['Diferencia', j.saldo_esperado - j.saldo_real]);
    }

    if (data.userCierreNombre) {
      filas.push(['Firmado por', data.userCierreNombre]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);

    // Ajustar ancho de columnas
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }];
    ws['!protect'] = true;

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  }

  private _agregarVentas(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const filas: unknown[][] = [
      ['Producto', 'Cantidad', 'Precio unitario', 'Precio base', 'Total', 'Forma de pago'],
    ];

    const pmap = data.productosMap;

    let granTotal = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        const info = pmap?.get(detalle.producto_id);
        const nombreProducto = info?.nombre ?? detalle.producto_id;
        const precioBase = info?.precio_costo ?? null;
        filas.push([
          nombreProducto,
          detalle.cantidad,
          detalle.precio_unitario,
          precioBase,
          detalle.subtotal,
          (venta as any).forma_pago ?? 'efectivo',
        ]);
        granTotal += detalle.subtotal;
      }
    }

    filas.push([], ['Total ingresos', '', '', '', granTotal, '']);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
    ];
    ws['!protect'] = true;

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
    ws['!protect'] = true;

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  }
}
