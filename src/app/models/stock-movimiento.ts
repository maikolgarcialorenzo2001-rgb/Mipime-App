export interface StockMovimiento {
  id: number;
  producto_id: number;
  cantidad: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  motivo: string | null;
  jornada_id?: number;
  created_at: string;
}
