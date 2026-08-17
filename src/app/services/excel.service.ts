import { Injectable } from '@angular/core';
import type * as XLSX from 'xlsx';
import type { Jornada } from '../models/jornada';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { CuentaCosa } from '../models/cuenta-cosa';
import type { StockMovimiento } from '../models/stock-movimiento';
import type { VentaLote } from '../models/venta-lote';
import type { ArqueoCajaEntry } from '../models/arqueo-caja';
import type { PalmarRecord, PalmarSemanaResumen } from '../models/palmar-jornada';

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

/**
 * Pendiente sin cobrar (pagado_en IS NULL) de CUALQUIER jornada, listado en la
 * hoja "Pendientes Acumulados" del Excel diario (FR-9/AC11).
 */
export interface PendienteAcumulado {
  id: number;             // ventas.id original
  comprador: string;      // comprador_nombre ?? `Pendiente #${id}`
  fechaOriginal: string;  // fecha_hora ISO (el Excel muestra la fecha)
  monto: number;          // total
  antiguedadDias: number; // date-only floor((hoy - fecha)/86400000), max 0 → mismo día 0
}

export interface JornadaReportData {
  jornada: Jornada;
  ventas: VentaConDetalles[];
  movimientos: Movimiento[];
  productosMap?: Map<number, ProductoInfo>;
  totalCosto: number;
  userCierreNombre: string | null;
  /** FR-6: nombre del aperturista original (si la jornada lo registró). */
  userAperturaNombre?: string | null;
  cuentaCosas?: CuentaCosa[];
  stockMovimientos?: StockMovimiento[];
  ventaLotes?: VentaLote[];
  arqueo?: ArqueoCajaEntry[];
  inversionPorProducto?: Map<number, number>;
  total_usd?: number;
  total_eur?: number;
  /** Pendientes sin cobrar de TODAS las jornadas (solo cierre diario, FR-9). */
  pendientesAcumulados?: PendienteAcumulado[];
}

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  /**
   * Promesa cacheada del chunk lazy de SheetJS (xlsx). Se inicia al instanciar el
   * servicio pero el módulo se carga a demanda, fuera del bundle inicial.
   * null hasta el primer uso real o el preload al idle (S5/S6).
   */
  private _xlsxPromise: Promise<typeof import('xlsx')> | null = null;

  /**
   * Hook aislado del dynamic import de SheetJS (S5): aislarlo permite espiarlo
   * en tests para verificar el reintento con backoff sin disparar el import real.
   */
  private _importarXlsx(): Promise<typeof import('xlsx')> {
    return import('xlsx');
  }

  /**
   * Carga el módulo xlsx cacheando la promesa que ya agotó los reintentos (S5):
   * 3 intentos (0,1,2) con delay 200ms * (intento + 1). Si la carga falla offline
   * no queda una promesa rechazada para siempre: el uso real vuelve a reintentar.
   */
  private _cargarXlsx(): Promise<typeof import('xlsx')> {
    if (this._xlsxPromise) {
      return this._xlsxPromise;
    }
    this._xlsxPromise = this._importarXlsxConReintento();
    return this._xlsxPromise;
  }

  private async _importarXlsxConReintento(): Promise<typeof import('xlsx')> {
    let ultimoError: unknown;
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this._importarXlsx();
      } catch (err) {
        ultimoError = err;
        if (intento < 2) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (intento + 1)));
        }
      }
    }
    throw ultimoError;
  }

  /**
   * Precarga el chunk xlsx en background tras el primer paint (S6): requestIdleCallback
   * con timeout 2000ms si existe (browser), si no setTimeout(2000). Si resuelve y no
   * hay otra carga en curso, cachea el módulo; si falla, silencioso — el uso real
   * hará el reintento con backoff.
   */
  private _precargarXlsxAlIdle(): void {
    const precargar = (): void => {
      this._importarXlsx()
        .then((modulo) => {
          if (!this._xlsxPromise) {
            this._xlsxPromise = Promise.resolve(modulo);
          }
        })
        .catch(() => undefined);
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(precargar, { timeout: 2000 });
    } else {
      setTimeout(precargar, 2000);
    }
  }

  constructor() {
    this._precargarXlsxAlIdle();
  }

  /**
   * Genera un archivo Excel (.xlsx) con el resumen de una jornada:
   * - Hoja "Resumen": datos generales de la jornada
   * - Hoja "Ventas": listado de ventas con detalle de productos
   * - Hoja "Movimientos": gastos e ingresos extra
   *
   * @returns Promise<string> en base64 del archivo xlsx
   */
  async generarExcelJornada(data: JornadaReportData): Promise<string> {
    const XLSX = await this._cargarXlsx();
    const wb = XLSX.utils.book_new();

    await this._agregarResumen(wb, data);
    await this._agregarVentas(wb, data);
    await this._agregarPendientesAcumulados(wb, data);
    await this._agregarMovimientos(wb, data);
    await this._agregarArqueo(wb, data);
    await this._agregarIpve(wb, data);

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  /**
   * Genera un Excel (.xlsx) con lo REGISTRADO de la tienda externa "Palmar"
   * (solo lectura — este método NO escribe en la base de datos):
   * - Hoja "Resumen": totales semanales (efectivo / divisa / transferencia / invertido / ganancia)
   * - Hoja "Arqueo": desglose por denominación del arqueo del día
   * - Hoja "Ventas": productos vendidos (Fase 1: solo cantidad > 0)
   *
   * @returns Promise<string> en base64 del archivo xlsx
   */
  async generarExcelPalmar(record: PalmarRecord, resumenSemana: PalmarSemanaResumen): Promise<string> {
    const XLSX = await this._cargarXlsx();
    const wb = XLSX.utils.book_new();

    this._agregarPalmarResumen(XLSX, wb, resumenSemana);
    this._agregarPalmarArqueo(XLSX, wb, record);
    this._agregarPalmarVentas(XLSX, wb, record);

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  private _agregarPalmarResumen(XLSX: typeof import('xlsx'), wb: import('xlsx').WorkBook, resumen: PalmarSemanaResumen): void {
    const filas: unknown[][] = [
      ['Palmar — Resumen Semanal'],
      [],
      ['Semana', `${resumen.semanaInicio} → ${resumen.semanaFin}`],
      [],
      ['Total recibido', resumen.totalRecibido],
      ['Efectivo', resumen.efectivo],
      ['Divisas (CUP)', resumen.divisaCup],
      ['Transferencia', resumen.transferencia],
      ['Invertido', resumen.invertido],
      ['Ganancia', resumen.ganancia],
    ];

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  }

  private _agregarPalmarArqueo(XLSX: typeof import('xlsx'), wb: import('xlsx').WorkBook, record: PalmarRecord): void {
    const arqueo = record.arqueo;
    if (!arqueo || arqueo.length === 0) return;

    const totalArqueo = arqueo.reduce((sum, a) => sum + a.subtotal, 0);

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

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Arqueo');
  }

  private _agregarPalmarVentas(XLSX: typeof import('xlsx'), wb: import('xlsx').WorkBook, record: PalmarRecord): void {
    // Fase 1: el Excel muestra SOLO productos con cantidad > 0
    const vendidos = record.productos.filter((p) => p.cantidad > 0);

    const filas: unknown[][] = [
      ['Producto', 'Cantidad', 'Precio venta', 'Subtotal', 'Costo', 'Invertido'],
    ];

    for (const p of vendidos) {
      filas.push([p.nombre, p.cantidad, p.precio_venta, p.subtotal, p.precio_costo, p.costo_subtotal]);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  }

  private async _agregarResumen(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
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
    const totalCompraDivisa = data.movimientos
      .filter((m) => m.tipo === 'compra_divisa')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalCostoCC = (data.cuentaCosas ?? []).reduce((sum, item) => {
      const costo = data.productosMap?.get(item.producto_id)?.precio_costo ?? 0;
      return sum + item.cantidad * costo;
    }, 0);

    const gananciaBruta = totalVentasConExtra - data.totalCosto - totalGastos - (j.total_merma ?? 0) - totalCostoCC;
    const gananciaPct = totalVentasConExtra > 0 ? ((gananciaBruta / totalVentasConExtra) * 100).toFixed(1) : '0.0';

    // Calcular desglose por forma de pago (efectivo que entra a caja)
    const totalEfectivo = ventas.reduce((sum, v) => {
      if (v.forma_pago === 'efectivo') return sum + v.total;
      if (v.forma_pago === 'divisas') {
        const vuelto = Math.max(0, (v.monto_divisa ?? 0) * (v.tasa_cambio ?? 0) - v.total);
        return sum + (v.completacion_efectivo ?? 0) - vuelto;
      }
      return sum;
    }, 0);
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
      const tipo = v.divisa_tipo ?? '—';
      const monto = v.monto_divisa ?? 0;
      const tasa = v.tasa_cambio ?? 0;
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

    const totalEnCaja = j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos - totalCompraDivisa;

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
      ['Total cuenta casas', -totalCostoCC],
      ['Ganancia bruta', gananciaBruta],
      ['Ganancia %', `${gananciaPct}%`],
      [],
      // --- Tabla Efectivo del Día ---
      ['Efectivo del día'],
      ['Monto inicial', j.monto_inicial],
      ['Total en caja', totalEnCaja],
      ['Total después de retirar monto inicial', totalEnCaja - j.monto_inicial],
      ['Transferencias', totalTransferencia],
      ['Divisas', totalDivisas],
      ['Pendientes del día', totalPendientes],
      ['Total del día', totalEnCaja + totalTransferencia + totalDivisas],
      [],
    ];

    if (data.userAperturaNombre && data.userCierreNombre && data.userAperturaNombre !== data.userCierreNombre) {
      filas.push(['Abierta por', data.userAperturaNombre]);
      filas.push(['Cerrada por', data.userCierreNombre]);
    } else if (data.userCierreNombre) {
      filas.push(['Firmado por', data.userCierreNombre]);
    }

    // Desglose de divisas por tipo
    if (divisaPorTipo.size > 0 || data.movimientos.some(m => m.tipo === 'compra_divisa')) {
      filas.push([]);
      filas.push(['Divisas', totalUnidadesDivisas]);
      for (const [tipo, datos] of divisaPorTipo) {
        filas.push([tipo, datos.monto, datos.tasa, datos.monto * datos.tasa]);
      }
      filas.push(['Total divisas en pesos', totalDivisas]);

      // Breakdown: ventas vs compra_divisa — collect types from BOTH sources
      const tiposDivisa = new Set(divisaPorTipo.keys());
      for (const m of data.movimientos) {
        if (m.tipo === 'compra_divisa' && m.divisa_tipo) {
          tiposDivisa.add(m.divisa_tipo);
        }
      }
      filas.push([]);
      filas.push(['Origen de divisas']);
      for (const tipo of tiposDivisa) {
        const deVentas = ventas
          .filter(v => v.divisa_tipo === tipo)
          .reduce((s, v) => s + (v.monto_divisa ?? 0), 0);
        const deCompra = data.movimientos
          .filter(m => m.tipo === 'compra_divisa' && m.divisa_tipo === tipo)
          .reduce((s, m) => s + (m.monto_divisa ?? 0), 0);
        filas.push([`${tipo} de ventas`, deVentas]);
        filas.push([`${tipo} de compra`, deCompra]);
        filas.push([`Total ${tipo}`, deVentas + deCompra]);
      }
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

  private async _agregarVentas(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
    // Determinar si hay columnas condicionales
    const tieneDivisas = data.ventas.some((v) => v.forma_pago === 'divisas');
    const tienePendientes = data.ventas.some((v) => v.forma_pago === 'pendiente');

    const headerBase = ['Producto', 'Cantidad', 'Precio unitario', 'Precio venta', 'Total', 'Forma de pago'];
    const headerExtra: string[] = [];
    if (tieneDivisas) headerExtra.push('Divisa', 'Monto en divisa', 'Tasa de cambio', 'Equivalente en Pesos', 'Completación efectivo');
    if (tienePendientes) headerExtra.push('Comprador');

    const footerLen = headerBase.length + headerExtra.length;
    const filas: unknown[][] = [[...headerBase, ...headerExtra]];

    const pmap = data.productosMap;
    const vlotes = data.ventaLotes ?? [];

    let totalCaja = 0;
    let totalPendientes = 0;
    let totalTransferencia = 0;
    for (const venta of data.ventas) {
      // Special case (pagar-pendiente): fila de cobro SIN detalles — se reporta
      // como "Cobrar Pendiente #<id original>" y suma a los totales del día
      // (FR-7/AC8: sin esto el cobro no se muestra NI suma a totalCaja).
      if (venta.detalles.length === 0) {
        const filaCobro: unknown[] = [
          `Cobrar Pendiente #${venta.cobro_de_venta_id ?? venta.id}`,
          1,
          venta.total,
          venta.total,
          venta.total,
          venta.forma_pago ?? 'efectivo',
        ];
        if (tieneDivisas) {
          if (venta.forma_pago === 'divisas') {
            filaCobro.push(venta.divisa_tipo ?? '—');
            filaCobro.push(venta.monto_divisa ?? '—');
            filaCobro.push(venta.tasa_cambio ?? '—');
            filaCobro.push(venta.total);
            filaCobro.push(venta.completacion_efectivo ?? '—');
          } else {
            filaCobro.push('', '', '', '', '');
          }
        }
        if (tienePendientes) filaCobro.push(''); // el cobro nunca es pendiente
        filas.push(filaCobro);

        if (venta.forma_pago === 'pendiente') {
          totalPendientes += venta.total;
        } else if (venta.forma_pago === 'divisas') {
          // divisas tracked by venta total below
        } else if (venta.forma_pago === 'transferencia') {
          totalTransferencia += venta.total;
        } else {
          totalCaja += venta.total;
        }
        continue;
      }

      const detalleRows: unknown[][] = [];

      for (const detalle of venta.detalles) {
        const info = pmap?.get(detalle.producto_id);
        const nombreProducto = info?.nombre ?? detalle.producto_id;
        const precioVenta = info?.precio_venta ?? '—';
        const fila: unknown[] = [
          nombreProducto,
          detalle.cantidad,
          detalle.precio_unitario,
          precioVenta,
          detalle.subtotal,
          venta.forma_pago ?? 'efectivo',
        ];
        // Columnas condicionales
        if (tieneDivisas) {
          if (venta.forma_pago === 'divisas') {
            fila.push(venta.divisa_tipo ?? '—');
            fila.push(venta.monto_divisa ?? '—');
            fila.push(venta.tasa_cambio ?? '—');
            fila.push(venta.total);
            fila.push(venta.completacion_efectivo ?? '—');
          } else {
            fila.push('', '', '', '', '');
          }
        }
        if (tienePendientes) {
          if (venta.forma_pago === 'pendiente') {
            fila.push(venta.comprador_nombre ?? '—');
          } else {
            fila.push('');
          }
        }
        detalleRows.push(fila);

        // Desglose de lotes para este detalle
        const lotesDelDetalle = vlotes.filter(
          (vl) => vl.venta_id === venta.id && vl.producto_id === detalle.producto_id,
        );
        if (lotesDelDetalle.length > 1) {
          let sumLotSubtotals = 0;
          for (const vl of lotesDelDetalle) {
            const loteFila: unknown[] = Array(footerLen).fill('');
            loteFila[0] = `  └ Lote #${vl.lote_id}`;
            loteFila[1] = vl.cantidad;
            loteFila[2] = detalle.precio_unitario;
            loteFila[4] = vl.cantidad * detalle.precio_unitario;
            detalleRows.push(loteFila);
            sumLotSubtotals += vl.cantidad * detalle.precio_unitario;
          }
          // Subtotal row after multi-lot group
          const subLotRow: unknown[] = Array(footerLen).fill('');
          subLotRow[0] = `  Subtotal ${nombreProducto}`;
          subLotRow[4] = sumLotSubtotals;
          detalleRows.push(subLotRow);
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

      // Push all detail rows (and lote/sublot rows) for this venta
      for (const row of detalleRows) {
        filas.push(row);
      }

      // Multi-item sale subtotal
      if (venta.detalles.length >= 2) {
        const ventaSubRow: unknown[] = Array(footerLen).fill('');
        ventaSubRow[0] = `Total venta #${venta.id}`;
        ventaSubRow[4] = venta.total;
        filas.push(ventaSubRow);
      }
    }

    const totalDivisas = data.ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);
    const cajaFooter = Array(footerLen).fill('');
    cajaFooter[0] = 'Total de ingresos en ventas';
    cajaFooter[4] = totalCaja;
    const divisasFooter = Array(footerLen).fill('');
    divisasFooter[0] = 'Total divisas';
    divisasFooter[4] = totalDivisas;
    const pendientesFooter = Array(footerLen).fill('');
    pendientesFooter[0] = 'Total pendientes';
    pendientesFooter[4] = totalPendientes;
    const transferenciaFooter = Array(footerLen).fill('');
    transferenciaFooter[0] = 'Total transferencia';
    transferenciaFooter[4] = totalTransferencia;
    const esperadoFooter = Array(footerLen).fill('');
    esperadoFooter[0] = 'Total esperado';
    esperadoFooter[4] = totalCaja + totalDivisas + totalPendientes + totalTransferencia;
    filas.push([], cajaFooter, divisasFooter, pendientesFooter, transferenciaFooter, esperadoFooter);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      ...(tieneDivisas ? [{ wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }] : []),
      ...(tienePendientes ? [{ wch: 16 }] : []),
    ];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  }

  /**
   * Hoja "Pendientes Acumulados" del Excel diario (FR-9/AC11): lista TODOS los
   * pendientes sin cobrar (pagado_en IS NULL) de TODAS las jornadas. Se omite
   * si no hay ninguno (convención de `_agregarArqueo` — "estado vacío u
   * omitida"). El Resumen "Pendientes del día" sigue intacto (solo del día).
   */
  private async _agregarPendientesAcumulados(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
    const pendientes = data.pendientesAcumulados;
    if (!pendientes || pendientes.length === 0) return;

    const filas: unknown[][] = [
      ['Comprador', 'Fecha original', 'Monto', 'Antigüedad (días)'],
    ];
    let total = 0;
    for (const p of pendientes) {
      filas.push([p.comprador, p.fechaOriginal, p.monto, p.antiguedadDias]);
      total += p.monto;
    }
    filas.push(['Total', '', total, '']);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 18 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Pendientes Acumulados');
  }

  /**
   * Genera un Excel multi-hoja mensual:
   * - "Resumen del Mes": totales consolidados de todas las jornadas
   * - Una hoja por jornada (fecha): resumen + ventas + movimientos
   */
  async generarExcelMensual(data: JornadaReportData[]): Promise<string> {
    const XLSX = await this._cargarXlsx();
    const wb = XLSX.utils.book_new();

    await this._agregarResumenDelMes(wb, data);
    await this._agregarStockConsolidado(wb, data);

    for (const d of data) {
      await this._agregarJornadaSheet(wb, d);
    }

    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  private async _agregarResumenDelMes(wb: XLSX.WorkBook, data: JornadaReportData[]): Promise<void> {
    const XLSX = await this._cargarXlsx();
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
    const totalEfectivo = data.reduce((s, d) =>
      s + d.ventas.reduce((ss, v) => {
        if (v.forma_pago === 'efectivo') return ss + v.total;
        if (v.forma_pago === 'divisas') {
          const vuelto = Math.max(0, (v.monto_divisa ?? 0) * (v.tasa_cambio ?? 0) - v.total);
          return ss + (v.completacion_efectivo ?? 0) - vuelto;
        }
        return ss;
      }, 0),
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

  private async _agregarJornadaSheet(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
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
    const totalCompraDivisa = data.movimientos
      .filter((m) => m.tipo === 'compra_divisa')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalCostoCC = (data.cuentaCosas ?? []).reduce((sum, item) => {
      const costo = data.productosMap?.get(item.producto_id)?.precio_costo ?? 0;
      return sum + item.cantidad * costo;
    }, 0);

    const gananciaBruta = totalVentasConExtra - (data.totalCosto ?? 0) - totalGastos - (j.total_merma ?? 0) - totalCostoCC;
    const gananciaPct = totalVentasConExtra > 0 ? `${((gananciaBruta / totalVentasConExtra) * 100).toFixed(1)}%` : '0.0%';

    // Pre-compute payment totals for Efectivo del Día table (solo efectivo que entra a caja)
    const totalEfectivo = data.ventas.reduce((sum, v) => {
      if (v.forma_pago === 'efectivo') return sum + v.total;
      if (v.forma_pago === 'divisas') {
        const vuelto = Math.max(0, (v.monto_divisa ?? 0) * (v.tasa_cambio ?? 0) - v.total);
        return sum + (v.completacion_efectivo ?? 0) - vuelto;
      }
      return sum;
    }, 0);
    let totalPendientes = 0;
    let totalTransferencia = 0;
    for (const venta of data.ventas) {
      for (const detalle of venta.detalles) {
        if (venta.forma_pago === 'pendiente') {
          totalPendientes += detalle.subtotal;
        } else if (venta.forma_pago === 'transferencia') {
          totalTransferencia += detalle.subtotal;
        }
      }
    }
    const totalDivisas = data.ventas
      .filter((v) => v.forma_pago === 'divisas')
      .reduce((sum, v) => sum + v.total, 0);

    const totalEnCajaJ = j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos - totalCompraDivisa;

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
      ['Total cuenta casas', -totalCostoCC],
      ['Ganancia bruta', gananciaBruta],
      ['Ganancia %', gananciaPct],
      [],
      // --- TABLA EFECTIVO DEL DÍA ---
      ['Efectivo del día'],
      ['Monto inicial', j.monto_inicial],
      ['Total en caja', totalEnCajaJ],
      ['Total después de retirar monto inicial', totalEnCajaJ - j.monto_inicial],
      ['Transferencias', totalTransferencia],
      ['Divisas', totalDivisas],
      ['Pendientes del día', totalPendientes],
      ['Total del día', totalEnCajaJ + totalTransferencia + totalDivisas],
    ];

    if (data.userAperturaNombre && data.userCierreNombre && data.userAperturaNombre !== data.userCierreNombre) {
      filas.push(['Abierta por', data.userAperturaNombre]);
      filas.push(['Cerrada por', data.userCierreNombre]);
    } else if (data.userCierreNombre) {
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
          venta.forma_pago ?? 'efectivo',
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

  private async _agregarMovimientos(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
    const tieneCompraDivisa = data.movimientos.some(m => m.tipo === 'compra_divisa');
    const filas: unknown[][] = tieneCompraDivisa
      ? [['Tipo', 'Descripción', 'Divisa', 'Monto en divisa', 'Tasa de cambio', 'Total en pesos']]
      : [['Tipo', 'Descripción', 'Monto']];

    for (const mov of data.movimientos) {
      if (mov.tipo === 'compra_divisa') {
        filas.push([
          'Compra divisa',
          mov.descripcion,
          mov.divisa_tipo ?? '—',
          mov.monto_divisa ?? '—',
          mov.tasa_cambio ?? '—',
          mov.monto,
        ]);
      } else {
        filas.push([
          mov.tipo === 'gasto' ? 'Gasto' : 'Ingreso extra',
          mov.descripcion,
          mov.monto,
        ]);
      }
    }

    // Stock operations detail (if stockMovimientos exist)
    const stock = data.stockMovimientos;
    const pmap = data.productosMap;
    if (stock && stock.length > 0) {
      filas.push([]);
      filas.push(['Producto', 'Tipo', 'Cantidad', 'Costo', 'Motivo', 'Fecha']);

      for (const mov of stock) {
        const info = pmap?.get(mov.producto_id);
        const nombreProducto = info?.nombre ?? mov.producto_id;
        const tipoLabel = mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'salida' ? 'Salida' : mov.tipo === 'merma' ? 'Merma' : mov.tipo === 'traslado' ? 'Traslado' : 'Ajuste';
        filas.push([
          nombreProducto,
          tipoLabel,
          mov.cantidad,
          mov.costo_total ?? 0,
          mov.motivo ?? '',
          mov.created_at,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = tieneCompraDivisa
      ? [{ wch: 22 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 16 }]
      : [{ wch: 22 }, { wch: 30 }, { wch: 16 }];
    ws['!protect'] = {};

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  }

  private async _agregarArqueo(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
    const arqueo = data.arqueo;
    if (!arqueo || arqueo.length === 0) return;

    const j = data.jornada;
    const ventas = data.ventas;
    const totalArqueo = arqueo.reduce((sum, a) => sum + a.subtotal, 0);
    const totalEfectivo = ventas.reduce((sum, v) => {
      if (v.forma_pago === 'efectivo') return sum + v.total;
      if (v.forma_pago === 'divisas') {
        const vuelto = Math.max(0, (v.monto_divisa ?? 0) * (v.tasa_cambio ?? 0) - v.total);
        return sum + (v.completacion_efectivo ?? 0) - vuelto;
      }
      return sum;
    }, 0);
    const totalIngresosExtra = data.movimientos
      .filter((m) => m.tipo === 'ingreso_extra')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalGastos = data.movimientos
      .filter((m) => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalCompraDivisa = data.movimientos
      .filter((m) => m.tipo === 'compra_divisa')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEnCaja = j.monto_inicial + totalEfectivo + totalIngresosExtra - totalGastos - totalCompraDivisa;
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

  private async _agregarStockConsolidado(wb: XLSX.WorkBook, allData: JornadaReportData[]): Promise<void> {
    const XLSX = await this._cargarXlsx();
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

  private async _agregarIpve(wb: XLSX.WorkBook, data: JornadaReportData): Promise<void> {
    const XLSX = await this._cargarXlsx();
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
