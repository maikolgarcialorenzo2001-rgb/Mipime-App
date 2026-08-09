import type { ArqueoCajaEntry } from './arqueo-caja';

/** Entrada de producto vendido en una jornada de Palmar (solo cantidad > 0). */
export interface PalmarProductoEntry {
  nombre: string;
  cantidad: number;
  precio_venta: number;
  precio_costo: number;
  subtotal: number;
  costo_subtotal: number;
}

/** Divisas (USD/EUR) con tasas manuales y su equivalente en CUP. */
export interface PalmarDivisa {
  usd: number;
  eur: number;
  tasa_usd: number;
  tasa_eur: number;
  usd_cup: number;
  eur_cup: number;
  divisa_cup: number;
}

/** Registro completo de una jornada de Palmar. */
export interface PalmarRecord {
  version: 1;
  id: string;
  /** Fecha de la jornada en formato yyyy-mm-dd. */
  fecha: string;
  /** Fecha ISO de creación del registro. */
  created_at: string;
  usuario: string | null;
  /** Solo productos con cantidad > 0. */
  productos: PalmarProductoEntry[];
  /** Solo denominaciones con cantidad > 0. */
  arqueo: ArqueoCajaEntry[];
  divisa: PalmarDivisa;
  transferencia: number;
  total_ventas: number;
  total_arqueo: number;
  total_recibido: number;
  invertido: number;
  ganancia: number;
  diferencia: number;
}

/** Resumen semanal (lunes a domingo) para la hoja Resumen del Excel. */
export interface PalmarSemanaResumen {
  semanaInicio: string;
  semanaFin: string;
  totalRecibido: number;
  efectivo: number;
  divisaCup: number;
  transferencia: number;
  invertido: number;
  ganancia: number;
}

/** Entrada del historial de jornadas listadas desde el filesystem. */
export interface PalmarHistoryEntry {
  fileName: string;
  createdAt: string;
  totalVentas: number;
  totalArqueo: number;
  totalRecibido: number;
  usuario: string | null;
}
