export interface LoteStock {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_costo: number;
  fecha_ingreso: string;
  ubicacion: 'almacen' | 'shop';
  created_at: string;
}

export interface LoteDetalle {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_costo: number;
  fecha_ingreso: string;
  stock_almacen: number;
  stock_shop: number;
  created_at: string;
}

export interface ConsumoRecord {
  lote_id: number;
  cantidad: number;
  precio_costo_real: number;
}