export interface StockMovimiento {
  id: number;
  producto_id: number;
  cantidad: number;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'merma';
  motivo: string | null;
  costo_total: number;
  jornada_id?: number;
  created_at: string;
}
