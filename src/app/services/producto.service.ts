import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap, of } from 'rxjs';
import { DATABASE } from './database';
import { StockMovimientoService } from './stock-movimiento.service';
import type { Producto } from '../models';

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

  /** Crea un nuevo producto y lo retorna. Si tiene stock inicial, crea un lote FIFO. */
  crear(data: {
    nombre: string;
    precio_costo: number;
    precio_venta: number;
    stock_actual: number;
  }): Observable<Producto> {
    const ahora = new Date().toISOString();
    return from(
      this._db.sql<Producto>(
        `INSERT INTO productos (nombre, descripcion, precio_costo, precio_venta, stock_actual, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?) RETURNING *`,
        [data.nombre, null, data.precio_costo, data.precio_venta, ahora, ahora],
      ),
    ).pipe(
      map((rows) => rows[0]),
      switchMap((producto) => {
        if (data.stock_actual > 0) {
          return from(
            this._stockMovimiento.registrarEntrada(
              producto.id,
              data.stock_actual,
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
