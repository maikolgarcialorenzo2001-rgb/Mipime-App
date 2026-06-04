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
}
