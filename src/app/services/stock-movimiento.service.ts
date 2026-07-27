import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import { AuthService } from './auth.service';
import type { StockMovimiento, LoteStock, ConsumoRecord } from '../models';

@Injectable({
  providedIn: 'root',
})
export class StockMovimientoService {
  private readonly _db = inject(DATABASE);
  private readonly _auth = inject(AuthService);

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

  /**
   * Consume stock from the oldest lots (FIFO) filtered by location.
   * Returns ConsumoRecord[] detailing which lots were consumed and at what cost.
   * Throws if insufficient stock across all lots for the given location.
   */
  async _consumirFIFO(
    productoId: number,
    cantidadRequerida: number,
    ubicacion: 'almacen' | 'shop',
  ): Promise<ConsumoRecord[]> {
    let lotes = await this._db.sql<LoteStock>(
      `SELECT * FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0 AND ubicacion = ?
       ORDER BY fecha_ingreso ASC, id ASC`,
      [productoId, ubicacion],
    );

    // Safety net: if no lotes exist but stock_{ubicacion} > 0, create a default lote
    if (lotes.length === 0) {
      const stockCol = ubicacion === 'almacen' ? 'stock_almacen' : 'stock_shop';
      const [row] = await this._db.sql<{
        stock: number;
        precio_costo: number | null;
      }>(
        `SELECT ${stockCol} AS stock, precio_costo FROM productos WHERE id = ?`,
        [productoId],
      );

      if (row.stock > 0) {
        const ahora = new Date().toISOString();
        const insertResult = await this._db.sql<{ id: number }>(
          `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING id`,
          [productoId, row.stock, row.precio_costo ?? 0, ahora, ubicacion, ahora],
        );
        lotes = [
          {
            id: insertResult[0].id,
            producto_id: productoId,
            cantidad: row.stock,
            precio_costo: row.precio_costo ?? 0,
            fecha_ingreso: ahora,
            ubicacion,
            created_at: ahora,
          },
        ];
      }
    }

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

    // Update product precio_costo to the next available lot (FIFO front)
    const [siguienteLote] = await this._db.sql<{ precio_costo: number }>(
      `SELECT precio_costo FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0
       ORDER BY fecha_ingreso ASC, id ASC LIMIT 1`,
      [productoId],
    );
    if (siguienteLote) {
      await this._db.sql(
        'UPDATE productos SET precio_costo = ?, updated_at = ? WHERE id = ?',
        [siguienteLote.precio_costo, new Date().toISOString(), productoId],
      );
    }

    return consumos;
  }

  /**
   * Helper: returns the correct stock column name for a given ubicacion.
   */
  private _stockCol(ubicacion: 'almacen' | 'shop'): string {
    return ubicacion === 'almacen' ? 'stock_almacen' : 'stock_shop';
  }

  async registrarEntrada(
    productoId: number,
    cantidad: number,
    precioCosto: number,
    motivo?: string,
    jornadaId?: number,
    ubicacion: 'almacen' | 'shop' = 'almacen',
  ): Promise<void> {
    this._checkAdmin();
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

    // 2. Update product stock for this location
    await this._db.sql(
      `UPDATE productos
       SET ${this._stockCol(ubicacion)} = ${this._stockCol(ubicacion)} + ?,
            updated_at = ?
       WHERE id = ?`,
      [cantidad, ahora, productoId],
    );

    // 3. Create lot with ubicacion
    await this._db.sql(
      `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productoId, cantidad, precioCosto, ahora, ubicacion, ahora],
    );
  }

  async registrarSalida(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
    ubicacion: 'almacen' | 'shop' = 'shop',
  ): Promise<ConsumoRecord[]> {
    this._checkAdmin();
    const ahora = new Date().toISOString();

    // 1. Consume from oldest lots (FIFO) at the given location
    const consumos = await this._consumirFIFO(productoId, cantidad, ubicacion);

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

    // 3. Update product stock (derived from lots at this location)
    const [{ total }] = await this._db.sql<{ total: number }>(
      'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
      [productoId, ubicacion],
    );

    await this._db.sql(
      `UPDATE productos
       SET ${this._stockCol(ubicacion)} = ?,
            updated_at = ?
       WHERE id = ?`,
      [total, ahora, productoId],
    );

    return consumos;
  }

  /**
   * Registra una entrada (entrada de mercadería a almacén).
   * Alias para registrarEntrada con ubicacion='almacen' — mantiene compatibilidad.
   */
  async registrarEntradaAlmacen(
    productoId: number,
    cantidad: number,
    precioCosto: number,
    motivo?: string,
    jornadaId?: number,
  ): Promise<void> {
    return this.registrarEntrada(productoId, cantidad, precioCosto, motivo, jornadaId, 'almacen');
  }

  async registrarAjuste(
    productoId: number,
    nuevaCantidad: number,
    motivo: string,
    jornadaId?: number,
  ): Promise<void> {
    this._checkAdmin();
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
        `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
         VALUES (?, ?, ?, ?, 'almacen', ?)`,
        [productoId, nuevaCantidad, costoPromedio, ahora, ahora],
      );
    }

    // 4. Update product stock (sum across both locations to set stock_almacen)
    //    Full ajuste replaces all lots — set stock_almacen and keep stock_shop as-is
    await this._db.sql(
      `UPDATE productos
       SET stock_almacen = ?,
            updated_at = ?
       WHERE id = ?`,
      [nuevaCantidad, ahora, productoId],
    );
  }

  /**
   * Transfiere stock desde almacén a tienda.
   * 1. Consume FIFO desde almacén
   * 2. Crea nuevos lotes en tienda con el mismo costo
   * 3. Registra movimiento tipo 'traslado'
   * 4. Recalcula stock_almacen y stock_shop
   */
  async registrarTraslado(
    productoId: number,
    cantidad: number,
    jornadaId?: number,
  ): Promise<ConsumoRecord[]> {
    const ahora = new Date().toISOString();

    // 1. Consume from almacen FIFO
    const consumos = await this._consumirFIFO(productoId, cantidad, 'almacen');

    // 2. Create new shop lots with same costs
    for (const consumo of consumos) {
      await this._db.sql(
        `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
         VALUES (?, ?, ?, ?, 'shop', ?)`,
        [productoId, consumo.cantidad, consumo.precio_costo_real, ahora, ahora],
      );
    }

    // 3. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
    const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
    const params: unknown[] = [productoId, cantidad, 'traslado', null, ahora];
    if (jornadaId !== undefined) params.push(jornadaId);

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (${placeholders})`,
      params,
    );

    // 4. Recalculate both stock columns
    const [{ totalAlmacen }] = await this._db.sql<{ totalAlmacen: number }>(
      "SELECT COALESCE(SUM(cantidad), 0) AS totalAlmacen FROM lotes_stock WHERE producto_id = ? AND ubicacion = 'almacen'",
      [productoId],
    );
    const [{ totalShop }] = await this._db.sql<{ totalShop: number }>(
      "SELECT COALESCE(SUM(cantidad), 0) AS totalShop FROM lotes_stock WHERE producto_id = ? AND ubicacion = 'shop'",
      [productoId],
    );

    await this._db.sql(
      `UPDATE productos
       SET stock_almacen = ?, stock_shop = ?, updated_at = ?
       WHERE id = ?`,
      [totalAlmacen, totalShop, ahora, productoId],
    );

    return consumos;
  }

  /**
   * Ajusta la cantidad de un lote específico y recalcula el stock de la ubicación.
   */
  async registrarAjusteLote(
    productoId: number,
    loteId: number,
    nuevaCantidad: number,
    motivo: string,
    ubicacion: 'almacen' | 'shop',
  ): Promise<void> {
    this._checkAdmin();
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo es obligatorio');
    }

    const ahora = new Date().toISOString();

    // 1. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at';
    const params: unknown[] = [productoId, nuevaCantidad, 'ajuste', motivo, ahora];

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (?, ?, ?, ?, ?)`,
      params,
    );

    // 2. Update the specific lot
    await this._db.sql(
      'UPDATE lotes_stock SET cantidad = ?, updated_at = ? WHERE id = ?',
      [nuevaCantidad, ahora, loteId],
    );

    // 3. Recalculate stock for this ubicacion
    const [{ total }] = await this._db.sql<{ total: number }>(
      'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
      [productoId, ubicacion],
    );

    await this._db.sql(
      `UPDATE productos
       SET ${this._stockCol(ubicacion)} = ?,
            updated_at = ?
       WHERE id = ?`,
      [total, ahora, productoId],
    );
  }

  /**
   * Registra una merma (rotura/pérdida) de producto:
   * 1. Consume stock desde los lotes más antiguos de TIENDA (FIFO)
   * 2. Calcula costo_total = Σ(cantidad × precio_costo_real)
   * 3. Inserta stock_movimiento con tipo='merma' y costo_total
   * 4. Actualiza stock_shop del producto (derivado de lotes de tienda)
   * 5. Actualiza total_merma y saldo_esperado de la jornada
   */
  async registrarMerma(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
    ubicacion: 'almacen' | 'shop' = 'shop',
  ): Promise<{ consumos: ConsumoRecord[]; costoTotal: number }> {
    this._checkAdmin();
    const ahora = new Date().toISOString();

    // 1. Consume from oldest lots (FIFO) at the given ubicacion
    const consumos = await this._consumirFIFO(productoId, cantidad, ubicacion);

    // 2. Calculate total cost
    const costoTotal = consumos.reduce(
      (sum, c) => sum + c.cantidad * c.precio_costo_real,
      0,
    );

    // 3. Register movement
    const columnas = 'producto_id, cantidad, tipo, motivo, created_at, costo_total' + (jornadaId !== undefined ? ', jornada_id' : '');
    const placeholders = '?, ?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
    const params: unknown[] = [productoId, cantidad, 'merma', motivo ?? null, ahora, costoTotal];
    if (jornadaId !== undefined) params.push(jornadaId);

    await this._db.sql(
      `INSERT INTO stock_movimientos (${columnas})
       VALUES (${placeholders})`,
      params,
    );

    // 4. Update product stock for this ubicacion
    const [{ total }] = await this._db.sql<{ total: number }>(
      'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
      [productoId, ubicacion],
    );

    await this._db.sql(
      `UPDATE productos
       SET ${this._stockCol(ubicacion)} = ?,
            updated_at = ?
       WHERE id = ?`,
      [total, ahora, productoId],
    );

    // 5. Update jornada financials (only for shop merma — jornada tracks shop P&L)
    if (jornadaId !== undefined && ubicacion === 'shop') {
      await this._db.sql(
        `UPDATE jornadas
         SET total_merma = total_merma + ?,
              saldo_esperado = saldo_esperado - ?,
              updated_at = ?
         WHERE id = ?`,
        [costoTotal, costoTotal, ahora, jornadaId],
      );
    }

    return { consumos, costoTotal };
  }

  async obtenerMovimientos(
    productoId: number,
  ): Promise<StockMovimiento[]> {
    return this._db.sql<StockMovimiento>(
      `SELECT * FROM stock_movimientos WHERE producto_id = ? ORDER BY created_at DESC`,
      [productoId],
    );
  }

  async obtenerLotesPorProducto(
    productoId: number,
  ): Promise<LoteStock[]> {
    return this._db.sql<LoteStock>(
      `SELECT * FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0
       ORDER BY fecha_ingreso ASC, id ASC`,
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
