export interface Venta {
  id: number;
  jornada_id: number;
  fecha_hora: string;
  total: number;
  created_at: string;
}

export interface DetalleVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}
