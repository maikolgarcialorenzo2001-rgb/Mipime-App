import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import type { StockMovimiento, LoteStock, ConsumoRecord } from '../models';

@Injectable({
  providedIn: 'root',
})
export class StockMovimientoService {
  private readonly _db = inject(DATABASE);

  /**
   * Consume stock from the oldest lots (FIFO).
   * ReturnsConsumoRecord[] detailing which lots were consumed and at what cost.
   * Throws if insufficient stock across all lots.
   */
  async _consumirFIFO(
    productoId: number,
    cantidadRequerida: number,
  ): Promise<ConsumoRecord[]> {
    const lotes = await this._db.sql<LoteStock>(
      `SELECT * FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0
       ORDER BY fecha_ingreso ASC, id ASC`,
      [productoId],
    );

    let restante = cantidadRequerida;
    const consumos: ConsumoRecord[] = [];

    for (const lote of lotes) {
      if (restante <= 0) break;

      const consumir = Math.min(lote.cantidad, restante);
      restante -= consumir;

      consumos.push({
        lote_id: lote.id,
        cantidad: consumir,
        precio_costo_real: lote.precio_costo,
      });

      await this._db.sql(
        'UPDATE lotes_stock SET cantidad = cantidad - ? WHERE id = ?',
        [consumir, lote.id],
      );
    }

    if (restante > 0) {
      throw new Error('Stock insuficiente');
    }

    return consumos;
  }

  async registrarEntrada(
    productoId: number,
    cantidad: number,
    precioCosto: number,
    motivo?: string,
    jornadaId?: number,
  ): Promise<void> {
    const ahora = new Date().toISOString();

    // 1. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
    const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
    const params: unknown[] = [productoId, cantidad, 'entrada', motivo ?? null, ahora];
    if (jornadaId !== undefined) params.push(jornadaId);

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (${placeholders})`,
      params,
    );

    // 2. Update product stock
    await this._db.sql(
      `UPDATE productos
       SET stock_actual = stock_actual + ?,
            updated_at = ?
       WHERE id = ?`,
      [cantidad, ahora, productoId],
    );

    // 3. Create lot
    await this._db.sql(
      `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [productoId, cantidad, precioCosto, ahora, ahora],
    );
  }

  async registrarSalida(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
  ): Promise<ConsumoRecord[]> {
    const ahora = new Date().toISOString();

    // 1. Consume from oldest lots (FIFO)
    const consumos = await this._consumirFIFO(productoId, cantidad);

    // 2. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
    const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
    const params: unknown[] = [productoId, cantidad, 'salida', motivo ?? null, ahora];
    if (jornadaId !== undefined) params.push(jornadaId);

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (${placeholders})`,
      params,
    );

    // 3. Update product stock (derived from lots)
    const [{ total }] = await this._db.sql<{ total: number }>(
      'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ?',
      [productoId],
    );

    await this._db.sql(
      `UPDATE productos
       SET stock_actual = ?,
            updated_at = ?
       WHERE id = ?`,
      [total, ahora, productoId],
    );

    return consumos;
  }

  async registrarAjuste(
    productoId: number,
    nuevaCantidad: number,
    motivo: string,
    jornadaId?: number,
  ): Promise<void> {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo es obligatorio');
    }

    const ahora = new Date().toISOString();

    // 1. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
    const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
    const params: unknown[] = [productoId, nuevaCantidad, 'ajuste', motivo, ahora];
    if (jornadaId !== undefined) params.push(jornadaId);

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (${placeholders})`,
      params,
    );

    // 2. Calculate weighted average cost from existing lots
    const lotes = await this._db.sql<LoteStock>(
      'SELECT * FROM lotes_stock WHERE producto_id = ? AND cantidad > 0',
      [productoId],
    );

    let costoPromedio = 0;
    if (lotes.length > 0) {
      const totalCantidad = lotes.reduce((sum, l) => sum + l.cantidad, 0);
      const totalCosto = lotes.reduce((sum, l) => sum + l.cantidad * l.precio_costo, 0);
      costoPromedio = totalCantidad > 0 ? totalCosto / totalCantidad : 0;
    }

    // 3. Replace all lots with a single new lot
    await this._db.sql(
      'DELETE FROM lotes_stock WHERE producto_id = ?',
      [productoId],
    );

    if (nuevaCantidad > 0) {
      await this._db.sql(
        `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [productoId, nuevaCantidad, costoPromedio, ahora, ahora],
      );
    }

    // 4. Update product stock
    await this._db.sql(
      `UPDATE productos
       SET stock_actual = ?,
            updated_at = ?
       WHERE id = ?`,
      [nuevaCantidad, ahora, productoId],
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
