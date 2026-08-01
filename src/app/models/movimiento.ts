export interface Movimiento {
  id: number;
  jornada_id: number;
  tipo: 'gasto' | 'ingreso_extra' | 'compra_divisa';
  descripcion: string;
  monto: number;
  divisa_tipo?: 'USD' | 'EUR';
  monto_divisa?: number;
  tasa_cambio?: number;
  created_at: string;
}
