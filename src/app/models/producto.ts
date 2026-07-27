export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  precio_costo: number | null;
  stock_almacen: number;
  stock_shop: number;
  created_at: string;
  updated_at: string;
}
