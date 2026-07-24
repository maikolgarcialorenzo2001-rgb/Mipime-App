import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { StockMovimiento } from '../models/stock-movimiento';

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
  cuentaCosas?: CuentaCosa[];
  stockMovimientos?: StockMovimiento[];
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
    this._agregarMovimientosStock(wb, data);

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
    const totalDivisas = ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);
    const totalPendientes = ventas
      .filter((v) => v.forma_pago === 'pendiente')
      .reduce((sum, v) => sum + v.total, 0);
    const cc = data.cuentaCosas ?? [];

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

    // Fila informativa de divisas
    if (totalDivisas > 0) {
      filas.push(['Total divisas', totalDivisas]);
    }

    // Fila informativa de pendientes (entre paréntesis)
    if (totalPendientes > 0) {
      filas.push(['Pendientes del día', `(${totalPendientes})`]);
    }

    // Tabla Cuenta Cosas
    if (cc.length > 0) {
      filas.push([]);
      filas.push(['Cuenta Cosas']);
      filas.push(['Producto', 'Cantidad', 'Descripción', 'Autorizado por', 'Total']);
      const pmap = data.productosMap;
      let totalCc = 0;
      for (const item of cc) {
        const info = pmap?.get(item.producto_id);
        const nombre = info?.nombre ?? item.producto_id;
        const valor = -item.cantidad; // negativo
        totalCc += item.cantidad;
        filas.push([nombre, item.cantidad, item.descripcion ?? '', item.autorizado_por, valor]);
      }
      filas.push(['Total C.C.', '', '', '', -totalCc]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);

    // Ajustar ancho de columnas
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  }

  private _agregarVentas(wb: XLSX.WorkBook, data: JornadaReportData): void {
    // Determinar si hay columnas condicionales
    const tieneDivisas = data.ventas.some((v) => v.forma_pago === 'divisas');
    const tienePendientes = data.ventas.some((v) => v.forma_pago === 'pendiente');

    const headerBase = ['Producto', 'Cantidad', 'Precio unitario', 'Precio base', 'Total', 'Forma de pago'];
    const headerExtra: string[] = [];
    if (tieneDivisas) headerExtra.push('Divisa', 'Monto en divisa', 'Tasa de cambio', 'Equivalente en Pesos');
    if (tienePendientes) headerExtra.push('Comprador');

    const filas: unknown[][] = [[...headerBase, ...headerExtra]];

    const pmap = data.productosMap;

    let granTotal = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        const info = pmap?.get(detalle.producto_id);
        const nombreProducto = info?.nombre ?? detalle.producto_id;
        const precioBase = info?.precio_costo ?? null;
        const fila: unknown[] = [
          nombreProducto,
          detalle.cantidad,
          detalle.precio_unitario,
          precioBase,
          detalle.subtotal,
          (venta as any).forma_pago ?? 'efectivo',
        ];
        // Columnas condicionales
        if (tieneDivisas) {
          if (venta.forma_pago === 'divisas') {
            fila.push((venta as any).divisa_tipo ?? '—');
            fila.push((venta as any).monto_divisa ?? '—');
            fila.push((venta as any).tasa_cambio ?? '—');
            fila.push(venta.total);
          } else {
            fila.push('', '', '', '');
          }
        }
        if (tienePendientes) {
          if (venta.forma_pago === 'pendiente') {
            fila.push((venta as any).comprador_nombre ?? '—');
          } else {
            fila.push('');
          }
        }
        filas.push(fila);
        granTotal += detalle.subtotal;
      }
    }

    const footerLen = headerBase.length + headerExtra.length;
    const footer = Array(footerLen).fill('');
    footer[0] = 'Total ingresos';
    footer[4] = granTotal;
    filas.push([], footer);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      ...(tieneDivisas ? [{ wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 14 }] : []),
      ...(tienePendientes ? [{ wch: 16 }] : []),
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  }

  /**
   * Genera un Excel multi-hoja mensual:
   * - "Resumen del Mes": totales consolidados de todas las jornadas
   * - Una hoja por jornada (fecha): resumen + ventas + movimientos
   */
  generarExcelMensual(data: JornadaReportData[]): string {
    const wb = XLSX.utils.book_new();

    this._agregarResumenDelMes(wb, data);
    this._agregarStockConsolidado(wb, data);

    for (const d of data) {
      this._agregarJornadaSheet(wb, d);
    }

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  private _agregarResumenDelMes(wb: XLSX.WorkBook, data: JornadaReportData[]): void {
    const totalVentas = data.reduce((s, d) => s + d.jornada.total_ventas, 0);
    const totalGastos = data.reduce((s, d) => s + d.jornada.total_gastos, 0);
    const totalCosto = data.reduce((s, d) => s + (d.totalCosto ?? 0), 0);
    const totalEfectivo = data.reduce(
      (s, d) => s + d.ventas.filter((v) => v.forma_pago === 'efectivo').reduce((ss, v) => ss + v.total, 0),
      0,
    );
    const totalTransferencia = data.reduce(
      (s, d) => s + d.ventas.filter((v) => v.forma_pago === 'transferencia').reduce((ss, v) => ss + v.total, 0),
      0,
    );
    const sumSaldoEsperado = data.reduce((s, d) => s + d.jornada.saldo_esperado, 0);
    const sumSaldoReal = data.reduce(
      (s, d) => s + (d.jornada.saldo_real ?? 0),
      0,
    );

    // Obtener mes/año de la primera jornada
    const primera = data[0]?.jornada;
    const fecha = primera ? new Date(primera.fecha + 'T12:00:00') : new Date();
    const mesLabel = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const filas: unknown[][] = [
      ['Mipime-Cuentas — Resumen del Mes'],
      [],
      ['Mes', mesLabel],
      ['Cantidad de jornadas', data.length],
      [],
      ['Total ventas', totalVentas],
      ['Total efectivo', totalEfectivo],
      ['Total transferencia', totalTransferencia],
      ['Total gastos', totalGastos],
      ['Ganancia bruta', totalVentas - totalCosto],
      [],
      ['Diferencia consolidada', sumSaldoEsperado - sumSaldoReal],
    ];

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 24 }, { wch: 20 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen del Mes');
  }

  private _agregarJornadaSheet(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const j = data.jornada;
    const filas: unknown[][] = [
      ['Mipime-Cuentas — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', 'Cerrada'],
      [],
      ['Monto inicial', j.monto_inicial],
      ['Total ventas', j.total_ventas],
      ['Total gastos', j.total_gastos],
      ['Ganancia bruta', j.total_ventas - (data.totalCosto ?? 0)],
    ];

    if (j.saldo_real !== null) {
      filas.push(['Saldo esperado', j.saldo_esperado]);
      filas.push(['Saldo real', j.saldo_real]);
      filas.push(['Diferencia', j.saldo_esperado - j.saldo_real]);
    }

    if (data.userCierreNombre) {
      filas.push(['Firmado por', data.userCierreNombre]);
    }

    // Blank row before Ventas table
    filas.push([]);
    filas.push(['Producto', 'Cantidad', 'Precio unitario', 'Precio base', 'Total', 'Forma de pago']);

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

    // Blank row before Movimientos table
    filas.push([]);
    filas.push(['Tipo', 'Descripción', 'Monto']);

    for (const mov of data.movimientos) {
      filas.push([
        mov.tipo === 'gasto' ? 'Gasto' : 'Ingreso extra',
        mov.descripcion,
        mov.monto,
      ]);
    }

    // Cuenta Cosas section
    const cc = data.cuentaCosas ?? [];
    if (cc.length > 0) {
      filas.push([]);
      filas.push(['Cuenta Cosas']);
      filas.push(['Producto', 'Cantidad', 'Descripción', 'Autorizado por', 'Total']);
      const pmap = data.productosMap;
      let totalCc = 0;
      for (const item of cc) {
        const info = pmap?.get(item.producto_id);
        const nombre = info?.nombre ?? item.producto_id;
        totalCc += item.cantidad;
        filas.push([nombre, item.cantidad, item.descripcion ?? '', item.autorizado_por, -item.cantidad]);
      }
      filas.push(['Total C.C.', '', '', '', -totalCc]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, `${j.fecha} (${j.id})`);
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
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  }

  private _agregarMovimientosStock(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const stock = data.stockMovimientos;
    if (!stock || stock.length === 0) return;

    const pmap = data.productosMap;

    const filas: unknown[][] = [
      ['Producto', 'Tipo', 'Cantidad', 'Motivo', 'Fecha'],
    ];

    for (const mov of stock) {
      const info = pmap?.get(mov.producto_id);
      const nombreProducto = info?.nombre ?? mov.producto_id;
      const tipoLabel = mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'salida' ? 'Salida' : 'Ajuste';
      filas.push([
        nombreProducto,
        tipoLabel,
        mov.cantidad,
        mov.motivo ?? '',
        mov.created_at,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 30 },
      { wch: 20 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  }

  private _agregarStockConsolidado(wb: XLSX.WorkBook, allData: JornadaReportData[]): void {
    // Recolectar todos los stockMovimientos de todas las jornadas
    const todos: StockMovimiento[] = [];
    const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>();

    for (const d of allData) {
      if (d.stockMovimientos) {
        todos.push(...d.stockMovimientos);
      }
      if (d.productosMap) {
        for (const [id, info] of d.productosMap) {
          if (!productosMap.has(id)) {
            productosMap.set(id, info);
          }
        }
      }
    }

    if (todos.length === 0) return;

    const filas: unknown[][] = [
      ['Producto', 'Tipo', 'Cantidad', 'Motivo', 'Fecha'],
    ];

    for (const mov of todos) {
      const info = productosMap.get(mov.producto_id);
      const nombreProducto = info?.nombre ?? mov.producto_id;
      const tipoLabel = mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'salida' ? 'Salida' : 'Ajuste';
      filas.push([
        nombreProducto,
        tipoLabel,
        mov.cantidad,
        mov.motivo ?? '',
        mov.created_at,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 30 },
      { wch: 20 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos de Stock');
  }
}
