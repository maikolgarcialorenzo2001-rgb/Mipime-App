export interface LoteStock {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_costo: number;
  fecha_ingreso: string;
  ubicacion: 'almacen' | 'shop';
  created_at: string;
}

export interface ConsumoRecord {
  lote_id: number;
  cantidad: number;
  precio_costo_real: number;
}