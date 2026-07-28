import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { StockMovimiento } from '../models/stock-movimiento';
import type { VentaLote } from '../models/venta-lote';
import type { ArqueoCajaEntry } from '../models/arqueo-caja';

export interface ProductoInfo {
  nombre: string;
  precio_costo: number | null;
  stock_almacen?: number;
  stock_shop?: number;
  precio_venta?: number;
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
  arqueo?: ArqueoCajaEntry[];
  inversionPorProducto?: Map<number, number>;
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
    this._agregarArqueo(wb, data);
    this._agregarIpve(wb, data);

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  private _agregarResumen(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const j = data.jornada;
    const ventas = data.ventas;

    // Total ventas + ingresos extra (excluye pendientes)
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalVentasSinPendientes = ventas
      .filter((v) => v.forma_pago !== 'pendiente')
      .reduce((sum, v) => sum + v.total, 0);
    const totalVentasConExtra = totalVentasSinPendientes + totalIngresosExtra;

    const totalGastos = data.movimientos
      .filter((m) => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0);
    const gananciaBruta = totalVentasConExtra - data.totalCosto - totalGastos - (j.total_merma ?? 0);
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

    const totalEnCaja = j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos;

    const filas: unknown[][] = [
      ['Tienda - App — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', j.estado === 'abierta' ? 'Abierta' : 'Cerrada'],
      [],
      // --- Tabla Ganancia Bruta ---
      ['Cálculo de ganancia bruta'],
      ['Total ventas + ingresos extra', totalVentasConExtra],
      ['Total costo productos', -data.totalCosto],
      ['Total gastos', -totalGastos],
      ['Total merma', -(j.total_merma ?? 0)],
      ['Ganancia bruta', gananciaBruta],
      ['Ganancia %', `${gananciaPct}%`],
      [],
      // --- Tabla Efectivo del Día ---
      ['Efectivo del día'],
      ['Monto inicial', j.monto_inicial],
      ['Total en caja', totalEnCaja],
      ['Total después de retirar monto inicial', totalEnCaja - j.monto_inicial],
      ['Transferencias', totalTransferencia],
      ['Pendientes del día', totalPendientes],
      ['Total del día', totalEnCaja + totalTransferencia],
      [],
    ];

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
    cajaFooter[0] = 'Total de ingresos en ventas';
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
    const totalVentasSinPendientes = data.reduce(
      (s, d) => s + d.ventas.filter((v) => v.forma_pago !== 'pendiente').reduce((ss, v) => ss + v.total, 0),
      0,
    );
    const totalIngresosExtra = data.reduce(
      (s, d) => s + d.movimientos.filter((m) => m.tipo === 'ingreso_extra').reduce((ss, m) => ss + m.monto, 0),
      0,
    );
    const totalVentasConExtra = totalVentasSinPendientes + totalIngresosExtra;
    const totalGastos = data.reduce(
      (s, d) => s + d.movimientos.filter((m) => m.tipo === 'gasto').reduce((ss, m) => ss + m.monto, 0),
      0,
    );
    const totalCosto = data.reduce((s, d) => s + (d.totalCosto ?? 0), 0);
    const totalEfectivo = data.reduce(
      (s, d) => s + d.ventas.filter((v) => v.forma_pago === 'efectivo').reduce((ss, v) => ss + v.total, 0),
      0,
    );
    const totalTransferencia = data.reduce(
      (s, d) => s + d.ventas.filter((v) => v.forma_pago === 'transferencia').reduce((ss, v) => ss + v.total, 0),
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
      ['Total ventas + ingresos extra', totalVentasConExtra],
      ['Total efectivo', totalEfectivo],
      ['Total transferencia', totalTransferencia],
      ['Total gastos', totalGastos],
      ['Ganancia bruta', totalVentasConExtra - totalCosto - totalGastos],
    ];

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 24 }, { wch: 20 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen del Mes');
  }

  private _agregarJornadaSheet(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const j = data.jornada;

    // Total ventas + ingresos extra (excluye pendientes)
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalVentasSinPendientes = data.ventas
      .filter((v) => v.forma_pago !== 'pendiente')
      .reduce((sum, v) => sum + v.total, 0);
    const totalVentasConExtra = totalVentasSinPendientes + totalIngresosExtra;
    const totalGastos = data.movimientos
      .filter((m) => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0);

    const gananciaBruta = totalVentasConExtra - (data.totalCosto ?? 0) - totalGastos - (j.total_merma ?? 0);
    const gananciaPct = totalVentasConExtra > 0 ? `${((gananciaBruta / totalVentasConExtra) * 100).toFixed(1)}%` : '0.0%';

    // Pre-compute payment totals for Efectivo del Día table
    let totalCaja = 0;
    let totalPendientes = 0;
    let totalTransferencia = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        if (venta.forma_pago === 'pendiente') {
          totalPendientes += detalle.subtotal;
        } else if (venta.forma_pago === 'transferencia') {
          totalTransferencia += detalle.subtotal;
        } else if (venta.forma_pago !== 'divisas') {
          totalCaja += detalle.subtotal;
        }
      }
    }
    const totalDivisas = data.ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);

    const totalEnCajaJ = j.monto_inicial + totalCaja + totalIngresosExtra - totalGastos;

    const filas: unknown[][] = [
      ['Tienda - App — Resumen de Jornada'],
      [],
      ['Fecha', j.fecha],
      ['Apertura', j.hora_apertura],
      ['Cierre', j.hora_cierre ?? '—'],
      ['Estado', 'Cerrada'],
      [],
      // --- TABLA GANANCIA BRUTA ---
      ['Cálculo de ganancia bruta'],
      ['Total ventas + ingresos extra', totalVentasConExtra],
      ['Total costo productos', -(data.totalCosto ?? 0)],
      ['Total gastos', -totalGastos],
      ['Total merma', -(j.total_merma ?? 0)],
      ['Ganancia bruta', gananciaBruta],
      ['Ganancia %', gananciaPct],
      [],
      // --- TABLA EFECTIVO DEL DÍA ---
      ['Efectivo del día'],
      ['Monto inicial', j.monto_inicial],
      ['Total en caja', totalEnCajaJ],
      ['Total después de retirar monto inicial', totalEnCajaJ - j.monto_inicial],
      ['Transferencias', totalTransferencia],
      ['Pendientes del día', totalPendientes],
      ['Total del día', totalEnCajaJ + totalTransferencia],
    ];

    if (data.userCierreNombre) {
      filas.push(['Firmado por', data.userCierreNombre]);
    }

    // Blank row before Ventas table
    filas.push([]);
    filas.push(['Producto', 'Cantidad', 'Precio unitario', 'Total', 'Forma de pago']);

    const pmap = data.productosMap;
    const vlotes = data.ventaLotes ?? [];
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
      }
    }

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

    // Arqueo de Caja section
    const arqueo = data.arqueo;
    if (arqueo && arqueo.length > 0) {
      const totalArqueo = arqueo.reduce((sum, a) => sum + a.subtotal, 0);
      const diferencia = totalEnCajaJ - totalArqueo;
      filas.push([]);
      filas.push(['Arqueo de Caja']);
      filas.push(['Denominación', 'Cantidad', 'Subtotal']);
      for (const entry of arqueo) {
        filas.push([`$${entry.denominacion.toLocaleString()}`, entry.cantidad, entry.subtotal]);
      }
      filas.push(['Total contado', '', totalArqueo]);
      filas.push([]);
      if (diferencia < 0) {
        filas.push(['SOBRANTE', Math.abs(diferencia)]);
      } else if (diferencia > 0) {
        filas.push(['FALTANTE', diferencia]);
      } else {
        filas.push(['CUADRADO', 0]);
      }
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

    // Stock operations summary (if stockMovimientos exist)
    const stock = data.stockMovimientos;
    if (stock && stock.length > 0) {
      filas.push([]);
      filas.push(['Resumen Operaciones Stock', 'Cantidad']);

      const conteo: Record<string, number> = {};
      for (const mov of stock) {
        const tipo = mov.tipo;
        conteo[tipo] = (conteo[tipo] ?? 0) + 1;
      }

      let total = 0;
      for (const [tipo, cantidad] of Object.entries(conteo)) {
        filas.push([tipo, cantidad]);
        total += cantidad;
      }
      filas.push(['Total', total]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 14 },
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

  private _agregarArqueo(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const arqueo = data.arqueo;
    if (!arqueo || arqueo.length === 0) return;

    const j = data.jornada;
    const ventas = data.ventas;
    const totalArqueo = arqueo.reduce((sum, a) => sum + a.subtotal, 0);
    const totalEfectivo = ventas
      .filter((v) => v.forma_pago === 'efectivo')
      .reduce((sum, v) => sum + v.total, 0);
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalGastos = data.movimientos
      .filter((m) => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEnCaja = j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos;
    const diferencia = totalEnCaja - totalArqueo;

    const filas: unknown[][] = [
      ['Arqueo de Caja'],
      [],
      ['Denominación', 'Cantidad', 'Subtotal'],
    ];

    for (const entry of arqueo) {
      filas.push([`$${entry.denominacion.toLocaleString()}`, entry.cantidad, entry.subtotal]);
    }

    filas.push([]);
    filas.push(['Total contado', '', totalArqueo]);
    filas.push([]);

    if (diferencia < 0) {
      filas.push(['SOBRANTE', Math.abs(diferencia)]);
    } else if (diferencia > 0) {
      filas.push(['FALTANTE', diferencia]);
    } else {
      filas.push(['CUADRADO', 0]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Arqueo');
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

  private _agregarIpve(wb: XLSX.WorkBook, data: JornadaReportData): void {
    const inv = data.inversionPorProducto;
    const pmap = data.productosMap;
    if (!inv || !pmap) return;

    // Left table: product stock + investment + expected revenue + potential profit
    const filas: unknown[][] = [
      ['Nombre', 'Stock Almacén', 'Stock Tienda', 'Precio Venta', 'Ingreso Esperado', 'Total Invertido', 'Ganancia Potencial'],
    ];

    let sumIngreso = 0;
    let sumInversion = 0;
    let sumGanancia = 0;

    for (const [productoId, info] of pmap) {
      const inversion = inv.get(productoId) ?? 0;
      const pv = info.precio_venta;
      const stockAlmacen = info.stock_almacen;
      const stockShop = info.stock_shop;

      if (pv != null && stockAlmacen != null && stockShop != null) {
        const totalStock = stockAlmacen + stockShop;
        const ingreso = totalStock * pv;
        const ganancia = ingreso - inversion;
        sumIngreso += ingreso;
        sumInversion += inversion;
        sumGanancia += ganancia;
        filas.push([info.nombre, stockAlmacen, stockShop, pv, ingreso, inversion, ganancia]);
      } else {
        sumInversion += inversion;
        filas.push([info.nombre, stockAlmacen ?? '—', stockShop ?? '—', '—', '—', inversion, '—']);
      }
    }

    // Totals row
    filas.push(['TOTALES', '', '', '', sumIngreso, sumInversion, sumGanancia]);

    const ws = XLSX.utils.aoa_to_sheet(filas);

    // Merma table to the RIGHT (offset after 7 data columns + 1 blank = starting at col I)
    const mermaVal = data.jornada.total_merma ?? 0;
    XLSX.utils.sheet_add_aoa(ws, [['Merma del día', mermaVal]], { origin: { r: 0, c: 8 } });

    ws['!cols'] = [
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'ipve');
  }
}
