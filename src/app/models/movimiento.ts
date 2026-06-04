export interface Movimiento {
  id: number;
  jornada_id: number;
  tipo: 'gasto' | 'ingreso_extra';
  descripcion: string;
  monto: number;
  created_at: string;
}
