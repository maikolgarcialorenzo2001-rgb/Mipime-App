import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { StockMovimiento } from '../models/stock-movimiento';
import type { VentaLote } from '../models/venta-lote';

export interface ProductoInfo {
  nombre: string;
  precio_costo: number | null;
  stock_almacen?: number;
  stock_shop?: number;
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
  ventaLotes?: VentaLote[];
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

    // Total ventas + ingresos extra
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalVentasConExtra = j.total_ventas + totalIngresosExtra;

    const gananciaBruta = totalVentasConExtra - data.totalCosto - j.total_movimientos - (j.total_merma ?? 0);
    const gananciaPct = totalVentasConExtra > 0 ? ((gananciaBruta / totalVentasConExtra) * 100).toFixed(1) : '0.0';

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

    // Desglose de divisas por tipo
    const ventasDivisas = ventas.filter((v) => v.forma_pago === 'divisas');
    const divisaPorTipo = new Map<string, { monto: number; tasa: number }>();
    for (const v of ventasDivisas) {
      const tipo = (v as any).divisa_tipo ?? '—';
      const monto = (v as any).monto_divisa ?? 0;
      const tasa = (v as any).tasa_cambio ?? 0;
      const existing = divisaPorTipo.get(tipo);
      if (existing) {
        existing.monto += monto;
        // Promedio ponderado de tasa de cambio
        existing.tasa = existing.monto > 0 ? (existing.tasa * (existing.monto - monto) + tasa * monto) / existing.monto : tasa;
      } else {
        divisaPorTipo.set(tipo, { monto, tasa });
      }
    }
    const totalUnidadesDivisas = Array.from(divisaPorTipo.values()).reduce((sum, d) => sum + d.monto, 0);

    const filas: unknown[][] = [
      ['Tienda - App — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', j.estado === 'abierta' ? 'Abierta' : 'Cerrada'],
      [],
      ['Monto inicial', j.monto_inicial],
      ['Total ventas', totalVentasConExtra],
      ['Total efectivo', totalEfectivo],
      ['Total transferencia', totalTransferencia],
      ['Pendientes del día', totalPendientes],
      ['Total movimientos', j.total_movimientos],
      ['Total merma', j.total_merma ?? 0],
      ['Ganancia bruta', gananciaBruta],
      ['Ganancia %', `${gananciaPct}%`],
      ['Saldo esperado', j.saldo_esperado],
    ];

    if (j.saldo_real !== null) {
      filas.push(['Saldo real', j.saldo_real]);
      filas.push(['Diferencia', j.saldo_esperado - j.saldo_real]);
    }

    if (data.userCierreNombre) {
      filas.push(['Firmado por', data.userCierreNombre]);
    }

    // Desglose de divisas por tipo
    if (divisaPorTipo.size > 0) {
      filas.push([]);
      filas.push(['Divisas', totalUnidadesDivisas]);
      for (const [tipo, datos] of divisaPorTipo) {
        filas.push([tipo, datos.monto, datos.tasa, datos.monto * datos.tasa]);
      }
      filas.push(['Total divisas en pesos cubanos', totalDivisas]);
    }

    // Tabla Cuenta Casas
    if (cc.length > 0) {
      filas.push([]);
      filas.push(['Cuenta Casas']);
      filas.push(['Producto', 'Cantidad', 'Descripción', 'Autorizado por', 'Total']);
      const pmap = data.productosMap;
      let totalCc = 0;
      for (const item of cc) {
        const info = pmap?.get(item.producto_id);
        const nombre = info?.nombre ?? item.producto_id;
        const costo = info?.precio_costo ?? 0;
        const valor = -(item.cantidad * costo); // negativo
        totalCc += item.cantidad * costo;
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

    const headerBase = ['Producto', 'Cantidad', 'Precio unitario', 'Total', 'Forma de pago'];
    const headerExtra: string[] = [];
    if (tieneDivisas) headerExtra.push('Divisa', 'Monto en divisa', 'Tasa de cambio', 'Equivalente en Pesos');
    if (tienePendientes) headerExtra.push('Comprador');

    const filas: unknown[][] = [[...headerBase, ...headerExtra]];

    const pmap = data.productosMap;
    const vlotes = data.ventaLotes ?? [];

    let totalCaja = 0;
    let totalPendientes = 0;
    let totalTransferencia = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        const info = pmap?.get(detalle.producto_id);
        const nombreProducto = info?.nombre ?? detalle.producto_id;
        const fila: unknown[] = [
          nombreProducto,
          detalle.cantidad,
          detalle.precio_unitario,
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

        // Desglose de lotes para este detalle
        const lotesDelDetalle = vlotes.filter(
          (vl) => vl.venta_id === venta.id && vl.producto_id === detalle.producto_id,
        );
        if (lotesDelDetalle.length > 1) {
          for (const vl of lotesDelDetalle) {
            const loteFila: unknown[] = Array(headerBase.length + headerExtra.length).fill('');
            loteFila[0] = `  └ Lote #${vl.lote_id}`;
            loteFila[1] = vl.cantidad;
            loteFila[2] = detalle.precio_unitario;
            loteFila[3] = vl.cantidad * detalle.precio_unitario;
            filas.push(loteFila);
          }
        }

        if (venta.forma_pago === 'pendiente') {
          totalPendientes += detalle.subtotal;
        } else if (venta.forma_pago === 'divisas') {
          // divisas tracked by venta total below
        } else if (venta.forma_pago === 'transferencia') {
          totalTransferencia += detalle.subtotal;
        } else {
          totalCaja += detalle.subtotal;
        }
      }
    }

    const totalDivisas = data.ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);
    const footerLen = headerBase.length + headerExtra.length;
    const cajaFooter = Array(footerLen).fill('');
    cajaFooter[0] = 'Total caja';
    cajaFooter[3] = totalCaja;
    const divisasFooter = Array(footerLen).fill('');
    divisasFooter[0] = 'Total divisas';
    divisasFooter[3] = totalDivisas;
    const pendientesFooter = Array(footerLen).fill('');
    pendientesFooter[0] = 'Total pendientes';
    pendientesFooter[3] = totalPendientes;
    const transferenciaFooter = Array(footerLen).fill('');
    transferenciaFooter[0] = 'Total transferencia';
    transferenciaFooter[3] = totalTransferencia;
    const esperadoFooter = Array(footerLen).fill('');
    esperadoFooter[0] = 'Total esperado';
    esperadoFooter[3] = totalCaja + totalDivisas + totalPendientes + totalTransferencia;
    filas.push([], cajaFooter, divisasFooter, pendientesFooter, transferenciaFooter, esperadoFooter);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
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
    const totalIngresosExtra = data.reduce(
      (s, d) => s + d.movimientos.filter((m) => m.tipo === 'ingreso_extra').reduce((ss, m) => ss + m.monto, 0),
      0,
    );
    const totalVentasConExtra = totalVentas + totalIngresosExtra;
    const totalMovimientos = data.reduce((s, d) => s + d.jornada.total_movimientos, 0);
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
      ['Tienda - App — Resumen del Mes'],
      [],
      ['Mes', mesLabel],
      ['Cantidad de jornadas', data.length],
      [],
      ['Total ventas', totalVentasConExtra],
      ['Total efectivo', totalEfectivo],
      ['Total transferencia', totalTransferencia],
      ['Total movimientos', totalMovimientos],
      ['Ganancia bruta', totalVentasConExtra - totalCosto],
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

    // Total ventas + ingresos extra
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalVentasConExtra = j.total_ventas + totalIngresosExtra;

    const filas: unknown[][] = [
      ['Tienda - App — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', 'Cerrada'],
      [],
      ['Monto inicial', j.monto_inicial],
      ['Total ventas', totalVentasConExtra],
      ['Total movimientos', j.total_movimientos],
      ['Ganancia bruta', totalVentasConExtra - (data.totalCosto ?? 0)],
      ['Ganancia %', totalVentasConExtra > 0 ? `${(((totalVentasConExtra - (data.totalCosto ?? 0)) / totalVentasConExtra) * 100).toFixed(1)}%` : '0.0%'],
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
    filas.push(['Producto', 'Cantidad', 'Precio unitario', 'Total', 'Forma de pago']);

    const pmap = data.productosMap;
    const vlotes = data.ventaLotes ?? [];
    let totalCaja = 0;
    let totalPendientes = 0;
    let totalTransferencia = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        const info = pmap?.get(detalle.producto_id);
        const nombreProducto = info?.nombre ?? detalle.producto_id;
        filas.push([
          nombreProducto,
          detalle.cantidad,
          detalle.precio_unitario,
          detalle.subtotal,
          (venta as any).forma_pago ?? 'efectivo',
        ]);

        // Desglose de lotes para este detalle
        const lotesDelDetalle = vlotes.filter(
          (vl) => vl.venta_id === venta.id && vl.producto_id === detalle.producto_id,
        );
        if (lotesDelDetalle.length > 1) {
          for (const vl of lotesDelDetalle) {
            filas.push([
              `  └ Lote #${vl.lote_id}`,
              vl.cantidad,
              detalle.precio_unitario,
              vl.cantidad * detalle.precio_unitario,
              '',
            ]);
          }
        }

        if (venta.forma_pago === 'pendiente') {
          totalPendientes += detalle.subtotal;
        } else if (venta.forma_pago === 'divisas') {
          // divisas tracked by venta total below
        } else if (venta.forma_pago === 'transferencia') {
          totalTransferencia += detalle.subtotal;
        } else {
          totalCaja += detalle.subtotal;
        }
      }
    }

    const totalDivisas = data.ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);
    filas.push([], ['Total caja', '', '', totalCaja, '']);
    filas.push(['Total divisas', '', '', totalDivisas, '']);
    filas.push(['Total pendientes', '', '', totalPendientes, '']);
    filas.push(['Total transferencia', '', '', totalTransferencia, '']);
    filas.push(['Total esperado', '', '', totalCaja + totalDivisas + totalPendientes + totalTransferencia, '']);

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

    // Cuenta Casas section
    const cc = data.cuentaCosas ?? [];
    if (cc.length > 0) {
      filas.push([]);
      filas.push(['Cuenta Casas']);
      filas.push(['Producto', 'Cantidad', 'Descripción', 'Autorizado por', 'Total']);
      const pmap = data.productosMap;
      let totalCc = 0;
      for (const item of cc) {
        const info = pmap?.get(item.producto_id);
        const nombre = info?.nombre ?? item.producto_id;
        const costo = info?.precio_costo ?? 0;
        totalCc += item.cantidad * costo;
        filas.push([nombre, item.cantidad, item.descripcion ?? '', item.autorizado_por, -(item.cantidad * costo)]);
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
      const tipoLabel = mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'salida' ? 'Salida' : mov.tipo === 'merma' ? 'Merma' : mov.tipo === 'traslado' ? 'Traslado' : 'Ajuste';
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
    const productosMap = new Map<number, ProductoInfo>();

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
      ['Producto', 'Tipo', 'Cantidad', 'Motivo', 'Fecha', 'Stock Almacén', 'Stock Tienda'],
    ];

    for (const mov of todos) {
      const info = productosMap.get(mov.producto_id);
      const nombreProducto = info?.nombre ?? mov.producto_id;
      const tipoLabel = mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'salida' ? 'Salida' : mov.tipo === 'merma' ? 'Merma' : mov.tipo === 'traslado' ? 'Traslado' : 'Ajuste';
      filas.push([
        nombreProducto,
        tipoLabel,
        mov.cantidad,
        mov.motivo ?? '',
        mov.created_at,
        info?.stock_almacen ?? '—',
        info?.stock_shop ?? '—',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 30 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos de Stock');
  }
}
