import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import type { Producto } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private readonly _db = inject(DATABASE);

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

  /** Crea un nuevo producto y lo retorna. */
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
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [data.nombre, null, data.precio_costo, data.precio_venta, data.stock_actual, ahora, ahora],
      ),
    ).pipe(map((rows) => rows[0]));
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

  /** Elimina un producto por ID. */
  eliminar(id: number): Observable<void> {
    return from(
      this._db.sql('DELETE FROM productos WHERE id = ?', [id]),
    ).pipe(map(() => undefined));
  }
}
