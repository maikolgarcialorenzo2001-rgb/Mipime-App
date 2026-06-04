export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  precio_costo: number | null;
  stock_actual: number;
  created_at: string;
  updated_at: string;
}
