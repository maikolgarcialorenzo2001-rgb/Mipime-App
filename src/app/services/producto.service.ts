import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import { AuthService } from './auth.service';
import { StockMovimientoService } from './stock-movimiento.service';
import type { Producto } from '../models';
import type { GlobalInvestment, PerProductInvestment } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private readonly _db = inject(DATABASE);
  private readonly _auth = inject(AuthService);
  private readonly _stockMovimiento = inject(StockMovimientoService);

  /**
   * Throws if the current user is not an admin.
   * Call at the top of admin-only operations.
   */
  private _checkAdmin(): void {
    const user = this._auth.usuario();
    if (!user || user.rol !== 'admin') {
      throw new Error('Solo administradores');
    }
  }

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
    return from(
      (async () => {
        // F6 R2: guard admin ANTES de validar y de escribir.
        this._checkAdmin();
        // F4: guard de precios ANTES del INSERT. `!(v >= 0)` es NaN-safe y deja
        // pasar el 0 (regalos/costo 0 legítimo) y null (columna nullable legacy).
        if (!(data.precio_costo >= 0)) {
          throw new Error('El costo no puede ser negativo');
        }
        if (!(data.precio_venta >= 0)) {
          throw new Error('El precio de venta no puede ser negativo');
        }
        const ahora = new Date().toISOString();
        // F6 R1: INSERT + registrarEntrada atómicos en la MISMA transacción.
        // Si registrarEntrada falla, el adapter hace ROLLBACK y NO queda
        // producto fantasma. registrarEntrada anida su propia transaction()
        // re-entrante → JOIN (D1), misma conexión, sin segundo BEGIN.
        return this._db.transaction(async (tx) => {
          const [producto] = await tx.sql<Producto>(
            `INSERT INTO productos (nombre, descripcion, precio_costo, precio_venta, stock_almacen, stock_shop, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 0, ?, ?) RETURNING *`,
            [data.nombre, null, data.precio_costo, data.precio_venta, ahora, ahora],
          );
          if (data.stock_almacen > 0) {
            await this._stockMovimiento.registrarEntrada(
              producto.id,
              data.stock_almacen,
              data.precio_costo,
            );
          }
          return producto;
        });
      })(),
    );
  }

  /** Actualiza un producto existente y lo retorna. */
  actualizar(
    id: number,
    data: { nombre: string; precio_costo: number; precio_venta: number },
  ): Observable<Producto> {
    return from(
      (async () => {
        // F6 R4: guard admin ANTES de validar y de escribir.
        this._checkAdmin();
        // F4: guard de precios ANTES del UPDATE (mismo criterio que `crear`).
        if (!(data.precio_costo >= 0)) {
          throw new Error('El costo no puede ser negativo');
        }
        if (!(data.precio_venta >= 0)) {
          throw new Error('El precio de venta no puede ser negativo');
        }
        const ahora = new Date().toISOString();
        const [producto] = await this._db.sql<Producto>(
          `UPDATE productos SET nombre = ?, precio_costo = ?, precio_venta = ?, updated_at = ? WHERE id = ? RETURNING *`,
          [data.nombre, data.precio_costo, data.precio_venta, ahora, id],
        );
        return producto;
      })(),
    );
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
        // F6 R3: guard admin ANTES de borrar.
        this._checkAdmin();
        await this._db.sql('DELETE FROM venta_lotes WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM stock_movimientos WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM lotes_stock WHERE producto_id = ?', [id]);
        await this._db.sql('DELETE FROM productos WHERE id = ?', [id]);
      })(),
    ).pipe(map(() => undefined));
  }
}
