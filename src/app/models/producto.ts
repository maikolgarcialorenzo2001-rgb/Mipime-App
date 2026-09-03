export type UnidadMedida = 'unidad' | 'gramaje';

/**
 * Mapa único de comportamiento por unidad de medida: el sufijo a mostrar,
 * el paso de incremento/decremento y si la cantidad admite decimales.
 * Fuente única de verdad para stock-badge, cantidad-input, cart y toasts.
 */
export const UNIDAD_MEDIDA: Record<
  UnidadMedida,
  { suffix: string; step: number; allowsDecimal: boolean }
> = {
  unidad: { suffix: 'u.', step: 1, allowsDecimal: false },
  gramaje: { suffix: 'lb', step: 0.1, allowsDecimal: true },
};

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
