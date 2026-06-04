import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import type { StockMovimiento } from '../models';

@Injectable({
  providedIn: 'root',
})
export class StockMovimientoService {
  private readonly _db = inject(DATABASE);

  async registrarEntrada(
    productoId: number,
    cantidad: number,
    motivo?: string,
  ): Promise<void> {
    const ahora = new Date().toISOString();

    await this._db.sql(
      `INSERT INTO stock_movimientos (producto_id, cantidad, tipo, motivo, created_at)
       VALUES (?, ?, 'entrada', ?, ?)`,
      [productoId, cantidad, motivo ?? null, ahora],
    );

    await this._db.sql(
      `UPDATE productos
       SET stock_actual = stock_actual + ?,
           updated_at = ?
       WHERE id = ?`,
      [cantidad, ahora, productoId],
    );
  }

  async registrarSalida(
    productoId: number,
    cantidad: number,
    motivo?: string,
  ): Promise<void> {
    const ahora = new Date().toISOString();

    const rows = await this._db.sql<{ stock_actual: number }>(
      'SELECT stock_actual FROM productos WHERE id = ?',
      [productoId],
    );

    const stockActual = rows[0]?.stock_actual ?? 0;
    if (stockActual < cantidad) {
      throw new Error('Stock insuficiente');
    }

    await this._db.sql(
      `INSERT INTO stock_movimientos (producto_id, cantidad, tipo, motivo, created_at)
       VALUES (?, ?, 'salida', ?, ?)`,
      [productoId, cantidad, motivo ?? null, ahora],
    );

    await this._db.sql(
      `UPDATE productos
       SET stock_actual = stock_actual - ?,
           updated_at = ?
       WHERE id = ?`,
      [cantidad, ahora, productoId],
    );
  }

  async registrarAjuste(
    productoId: number,
    cantidad: number,
    motivo: string,
  ): Promise<void> {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo es obligatorio');
    }

    const ahora = new Date().toISOString();

    await this._db.sql(
      `INSERT INTO stock_movimientos (producto_id, cantidad, tipo, motivo, created_at)
       VALUES (?, ?, 'ajuste', ?, ?)`,
      [productoId, cantidad, motivo, ahora],
    );

    await this._db.sql(
      `UPDATE productos
       SET stock_actual = ?,
           updated_at = ?
       WHERE id = ?`,
      [cantidad, ahora, productoId],
    );
  }

  async obtenerMovimientos(
    productoId: number,
  ): Promise<StockMovimiento[]> {
    return this._db.sql<StockMovimiento>(
      `SELECT * FROM stock_movimientos WHERE producto_id = ? ORDER BY created_at DESC`,
      [productoId],
    );
  }

  async obtenerHistorial(): Promise<
    Array<StockMovimiento & { nombre: string }>
  > {
    return this._db.sql<StockMovimiento & { nombre: string }>(
      `SELECT sm.*, p.nombre
       FROM stock_movimientos sm
       JOIN productos p ON sm.producto_id = p.id
       ORDER BY sm.created_at DESC`,
    );
  }
}
