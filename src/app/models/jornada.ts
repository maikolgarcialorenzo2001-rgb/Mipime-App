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
  created_at: string;
  updated_at: string;
}
