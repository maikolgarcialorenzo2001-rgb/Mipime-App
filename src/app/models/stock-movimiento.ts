export interface StockMovimiento {
  id: number;
  producto_id: number;
  cantidad: number;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'merma' | 'traslado';
  motivo: string | null;
  costo_total: number;
  jornada_id?: number;
  ubicacion?: string;
  created_at: string;
}
