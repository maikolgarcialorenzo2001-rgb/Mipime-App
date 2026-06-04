export interface Jornada {
  id: number;
  fecha: string;
  hora_apertura: string;
  hora_cierre: string | null;
  monto_inicial: number;
  total_ventas: number;
  total_gastos: number;
  saldo_esperado: number;
  saldo_real: number | null;
  estado: 'abierta' | 'cerrada';
  user_cierre_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface JornadaReporte {
  id: number;
  jornada_id: number;
  content_type: string;
  content_base64: string;
  filename: string;
  created_at: string;
}
