import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap, of } from 'rxjs';
import { DATABASE } from './database';
import { StockMovimientoService } from './stock-movimiento.service';
import type { Producto } from '../models';
import type { GlobalInvestment, PerProductInvestment } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private readonly _db = inject(DATABASE);
  private readonly _stockMovimiento = inject(StockMovimientoService);

  /** Lista todos los productos ordenados por nombre. */
  listar(): Observable<Producto[]> {
    return from(
      this._db.sql<Producto>(
        'SELECT * FROM productos ORDER BY nombre ASC',
      ),
    );
  }

  /** Busca productos cuyo nombre coincida (LIKE %query%). */
  buscar(query: string): Observable<Producto[]> {
    return from(
      this._db.sql<Producto>(
        'SELECT * FROM productos WHERE nombre LIKE ? ORDER BY nombre ASC LIMIT 50',
        [`%${query}%`],
      ),
    );
  }

  /** Obtiene un producto por ID. */
  obtenerPorId(id: number): Observable<Producto | null> {
    return from(
      this._db.sql<Producto>(
        'SELECT * FROM productos WHERE id = ?',
        [id],
      ),
    ).pipe(map((rows) => rows[0] ?? null));
  }

  /** Crea un nuevo producto y lo retorna. Si tiene stock inicial, crea un lote FIFO en almacén. */
  crear(data: {
    nombre: string;
    precio_costo: number;
    precio_venta: number;
    stock_almacen: number;
  }): Observable<Producto> {
    const ahora = new Date().toISOString();
    return from(
      this._db.sql<Producto>(
        `INSERT INTO productos (nombre, descripcion, precio_costo, precio_venta, stock_almacen, stock_shop, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?) RETURNING *`,
        [data.nombre, null, data.precio_costo, data.precio_venta, ahora, ahora],
      ),
    ).pipe(
      map((rows) => rows[0]),
      switchMap((producto) => {
        if (data.stock_almacen > 0) {
          return from(
            this._stockMovimiento.registrarEntrada(
              producto.id,
              data.stock_almacen,
              data.precio_costo,
            ),
          ).pipe(map(() => producto));
        }
        return of(producto);
      }),
    );
  }

  /** Actualiza un producto existente y lo retorna. */
  actualizar(
    id: number,
    data: { nombre: string; precio_costo: number; precio_venta: number },
  ): Observable<Producto> {
    const ahora = new Date().toISOString();
    return from(
      this._db.sql<Producto>(
        `UPDATE productos SET nombre = ?, precio_costo = ?, precio_venta = ?, updated_at = ? WHERE id = ? RETURNING *`,
        [data.nombre, data.precio_costo, data.precio_venta, ahora, id],
      ),
    ).pipe(map((rows) => rows[0]));
  }

  /** Obtiene el total global invertido en inventario, con desglose por ubicación. */
  obtenerInversionGlobal(): Observable<GlobalInvestment> {
    return from(
      this._db.sql<GlobalInvestment>(
        `SELECT
          COALESCE(SUM(cantidad * precio_costo), 0) as total_global,
          COALESCE(SUM(CASE WHEN ubicacion = 'almacen' THEN cantidad * precio_costo ELSE 0 END), 0) as total_almacen,
          COALESCE(SUM(CASE WHEN ubicacion = 'shop' THEN cantidad * precio_costo ELSE 0 END), 0) as total_shop
        FROM lotes_stock
        WHERE cantidad > 0`,
      ),
    ).pipe(map((rows) => rows[0] ?? { total_global: 0, total_almacen: 0, total_shop: 0 }));
  }

  /** Obtiene la inversión agregada por producto desde lotes_stock activos. */
  obtenerInversionPorProducto(): Observable<PerProductInvestment[]> {
    return from(
      this._db.sql<PerProductInvestment>(
        `SELECT producto_id, COALESCE(SUM(cantidad * precio_costo), 0) as total_invertido
        FROM lotes_stock
        WHERE cantidad > 0
        GROUP BY producto_id`,
      ),
    );
  }

  /** Elimina un producto y sus lotes/movimientos asociados por ID. */
  eliminar(id: number): Observable<void> {
    return from(
      (async () => {
        await this._db.sql('DELETE FROM venta_lotes WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM stock_movimientos WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM lotes_stock WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM productos WHERE id = ?', [id]);
      })(),
    ).pipe(map(() => undefined));
  }
}
