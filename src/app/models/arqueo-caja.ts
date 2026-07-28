export interface ArqueoDbRow {
  id: number;
  jornada_id: number;
  denominacion: number;
  cantidad: number;
  created_at: string;
}

export interface ArqueoCajaEntry {
  denominacion: number;
  cantidad: number;
  subtotal: number;
}
