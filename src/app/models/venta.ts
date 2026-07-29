export interface Venta {
  id: number;
  jornada_id: number;
  fecha_hora: string;
  total: number;
  usuario_id: number | null;
  forma_pago: string;
  divisa_tipo?: 'EUR' | 'USD';
  monto_divisa?: number;
  tasa_cambio?: number;
  completacion_efectivo?: number;
  comprador_nombre?: string;
  autorizado_por?: string;
  descripcion?: string;
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
