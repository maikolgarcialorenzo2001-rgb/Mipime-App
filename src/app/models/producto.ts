export type UnidadMedida = 'unidad' | 'gramaje';

export interface UnidadMedidaInfo {
  suffix: string;
  step: number;
  allowsDecimal: boolean;
}

/**
 * Mapa único de comportamiento por unidad de medida: el sufijo a mostrar,
 * el paso de incremento/decremento y si la cantidad admite decimales.
 * Fuente única de verdad para stock-badge, cantidad-input, cart y toasts.
 */
export const UNIDAD_MEDIDA: Record<UnidadMedida, UnidadMedidaInfo> = {
  unidad: { suffix: 'u.', step: 1, allowsDecimal: false },
  gramaje: { suffix: 'lb', step: 0.1, allowsDecimal: true },
};

/**
 * Accessor seguro de la definición de una unidad de medida: retorna la
 * definición exacta para 'unidad' | 'gramaje' y la definición por defecto
 * ('unidad') para cualquier otro valor (null, undefined, '', desconocido o
 * corrupto). NUNCA lanza — los readers no deben crashear con datos sucios.
 */
export function unidadMedidaInfo(value: string | null | undefined): UnidadMedidaInfo {
  if (value === 'gramaje') return UNIDAD_MEDIDA.gramaje;
  return UNIDAD_MEDIDA.unidad;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  precio_costo: number | null;
  stock_almacen: number;
  stock_shop: number;
  unidad_medida: UnidadMedida;
  created_at: string;
  updated_at: string;
}
