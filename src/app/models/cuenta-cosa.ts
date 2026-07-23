export interface CuentaCosa {
  id: number;
  jornada_id: number;
  producto_id: number;
  cantidad: number;
  descripcion: string | null;
  autorizado_por: string;
  created_at: string;
}
