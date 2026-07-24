export interface VentaLote {
  id: number;
  venta_id: number;
  lote_id: number;
  producto_id: number;
  cantidad: number;
  precio_costo_real: number;
  created_at: string;
}