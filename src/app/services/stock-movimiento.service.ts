import { Injectable, inject } from '@angular/core';
import { DATABASE, type SqlExecutor } from './database';
import { AuthService } from './auth.service';
import type { StockMovimiento, LoteStock, LoteDetalle, ConsumoRecord } from '../models';

/**
 * Techo de stock por operación (FR-04 / D3). Las cantidades ABSOLUTAS
 * (editar/ajuste/ajusteLote) no pueden superarlo; se valida en el servicio,
 * no solo en la UI.
 */
export const MAX_STOCK_UNIDADES = 1_000_000;

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
   * Guard de cantidad ABSOLUTA (editar/ajuste/ajusteLote, D3): rechaza
   * valores < 0 o > MAX_STOCK_UNIDADES ANTES de tocar la DB.
   */
  private _validarCantidadAbsoluta(cantidad: number): void {
    if (cantidad < 0) {
      throw new Error('La cantidad no puede ser negativa');
    }
    if (cantidad > MAX_STOCK_UNIDADES) {
      throw new Error('La cantidad supera el máximo permitido');
    }
  }

  /**
   * Guard de cantidad DELTA (entrada/salida/traslado/merma, D3): rechaza
   * valores <= 0 ANTES de tocar la DB.
   */
  private _validarCantidadDelta(cantidad: number): void {
    if (cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a cero');
    }
  }

  /**
   * Guard de precio de venta (F4): rechaza valores < 0 o NaN ANTES de tocar
   * la DB. El 0 es válido. `!(v >= 0)` es NaN-safe (`NaN < 0` es false) y
   * deja pasar null (null >= 0 es true en JS; columna nullable legacy).
   */
  private _validarPrecioVenta(precioVenta: number): void {
    if (!(precioVenta >= 0)) {
      throw new Error('El precio de venta no puede ser negativo');
    }
  }

  /**
   * Guard de costo (F4): rechaza valores < 0 o NaN ANTES de tocar la DB.
   * El 0 es válido (regalos / costo 0 legítimo). Mismo criterio NaN-safe
   * que `_validarPrecioVenta`.
   */
  private _validarPrecioCosto(precioCosto: number): void {
    if (!(precioCosto >= 0)) {
      throw new Error('El costo no puede ser negativo');
    }
  }

  /**
   * Consume stock from the oldest lots (FIFO) filtered by location.
   * When loteId is provided, consumes ONLY from that specific lot
   * (validated up-front; throws before mutating anything if insufficient).
   * Returns ConsumoRecord[] detailing which lots were consumed and at what cost.
   * Throws if insufficient stock across all lots for the given location.
   *
   * T-09: recibe el executor de la transacción activa (tx). Cuando se llama
   * SIN tx (uso directo de test/white-box), ejecuta sobre `this._db`.
   */
  async _consumirFIFO(
    productoId: number,
    cantidadRequerida: number,
    ubicacion: 'almacen' | 'shop',
    loteId?: number,
    tx?: SqlExecutor,
  ): Promise<ConsumoRecord[]> {
    const db: SqlExecutor = tx ?? this._db;

    // Pre-check para consumo de lote específico: valida que el lote exista y
    // tenga cantidad suficiente ANTES de mutar cualquier lote. Garantiza que un
    // exceso de cantidad no produzca consumo parcial (sin rollback disponible).
    if (loteId !== undefined) {
      const [loteObjetivo] = await db.sql<LoteStock>(
        `SELECT * FROM lotes_stock
         WHERE id = ? AND producto_id = ? AND ubicacion = ?`,
        [loteId, productoId, ubicacion],
      );
      if (!loteObjetivo || loteObjetivo.cantidad < cantidadRequerida) {
        throw new Error('Stock insuficiente');
      }
    }

    let lotes = await db.sql<LoteStock>(
      `SELECT * FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0 AND ubicacion = ?
       ${loteId !== undefined ? 'AND id = ?' : ''}
       ORDER BY fecha_ingreso ASC, id ASC`,
      loteId !== undefined
        ? [productoId, ubicacion, loteId]
        : [productoId, ubicacion],
    );

    // Safety net: if no lotes exist but stock_{ubicacion} > 0, create a default lote.
    // Nunca se fabrica un lote cuando se consume uno específico (loteId definido).
    if (loteId === undefined && lotes.length === 0) {
      const stockCol = ubicacion === 'almacen' ? 'stock_almacen' : 'stock_shop';
      const [row] = await db.sql<{
        stock: number;
        precio_costo: number | null;
      }>(
        `SELECT ${stockCol} AS stock, precio_costo FROM productos WHERE id = ?`,
        [productoId],
      );

      if (row.stock > 0) {
        const ahora = new Date().toISOString();
        const insertResult = await db.sql<{ id: number }>(
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

    // Pre-validación (FR-06 / D5): stock total suficiente ANTES de consumir.
    // El throw ocurre antes de cualquier UPDATE; el INSERT del safety-net
    // queda bajo la transacción del llamador → ROLLBACK si se lanza (D5).
    const totalDisponible = lotes.reduce((sum, lote) => sum + lote.cantidad, 0);
    if (totalDisponible < cantidadRequerida) {
      throw new Error('Stock insuficiente');
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

      await db.sql(
        'UPDATE lotes_stock SET cantidad = cantidad - ? WHERE id = ?',
        [consumir, lote.id],
      );
    }

    if (restante > 0) {
      throw new Error('Stock insuficiente');
    }

    // Sync product precio_costo to the FIFO front lot (oldest with stock)
    await this._syncPrecioCosto(productoId, new Date().toISOString(), tx);

    return consumos;
  }

  /**
   * Re-syncs productos.precio_costo to the FIFO front lot (oldest lot with
   * stock, product-wide — no ubicacion filter). Idempotent: when the front is
   * unchanged, the same value is rewritten. When no lot has stock, the cache
   * is left as-is.
   *
   * T-09: recibe el executor de la transacción activa (tx); sin tx usa `this._db`.
   */
  private async _syncPrecioCosto(
    productoId: number,
    ahora: string,
    tx?: SqlExecutor,
  ): Promise<void> {
    const db: SqlExecutor = tx ?? this._db;
    const [siguienteLote] = await db.sql<{ precio_costo: number }>(
      `SELECT precio_costo FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0
       ORDER BY fecha_ingreso ASC, id ASC LIMIT 1`,
      [productoId],
    );
    if (siguienteLote) {
      await db.sql(
        'UPDATE productos SET precio_costo = ?, updated_at = ? WHERE id = ?',
        [siguienteLote.precio_costo, ahora, productoId],
      );
    }
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
    this._validarCantidadDelta(cantidad);
    this._validarPrecioCosto(precioCosto);
    const ahora = new Date().toISOString();

    // T-09: las 4 escrituras corren atómicas (BEGIN/COMMIT del adapter).
    await this._db.transaction(async (tx) => {
      // 1. Register movement
      const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
      const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
      const params: unknown[] = [productoId, cantidad, 'entrada', motivo ?? null, ahora];
      if (jornadaId !== undefined) params.push(jornadaId);

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (${placeholders})`,
        params,
      );

      // 2. Update product stock for this location
      await tx.sql(
        `UPDATE productos
         SET ${this._stockCol(ubicacion)} = ${this._stockCol(ubicacion)} + ?,
              updated_at = ?
         WHERE id = ?`,
        [cantidad, ahora, productoId],
      );

      // 3. Create lot with ubicacion
      await tx.sql(
        `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productoId, cantidad, precioCosto, ahora, ubicacion, ahora],
      );

      // 4. Sync product precio_costo to the FIFO front lot (oldest with stock).
      //    When the product had 0 stock, the new lot becomes the front -> cost updates.
      //    When older lots still have stock, the front is unchanged -> cost preserved.
      await this._syncPrecioCosto(productoId, ahora, tx);
    });
  }

  async registrarSalida(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
    ubicacion: 'almacen' | 'shop' = 'shop',
    loteId?: number,
  ): Promise<ConsumoRecord[]> {
    this._validarCantidadDelta(cantidad);
    const ahora = new Date().toISOString();

    // T-09: consumo FIFO + movimiento + recálculo atómicos. Cuando el llamador
    // (VentaService) ya abrió una txn, el adapter hace JOIN: misma conexión.
    return this._db.transaction(async (tx) => {
      // 1. Consume from the target lot (loteId) or from oldest lots (FIFO)
      const consumos = await this._consumirFIFO(productoId, cantidad, ubicacion, loteId, tx);

      // 2. Register movement
      const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
      const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
      const params: unknown[] = [productoId, cantidad, 'salida', motivo ?? null, ahora];
      if (jornadaId !== undefined) params.push(jornadaId);

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (${placeholders})`,
        params,
      );

      // 3. Update product stock (derived from lots at this location)
      const [{ total }] = await tx.sql<{ total: number }>(
        'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
        [productoId, ubicacion],
      );

      await tx.sql(
        `UPDATE productos
         SET ${this._stockCol(ubicacion)} = ?,
              updated_at = ?
         WHERE id = ?`,
        [total, ahora, productoId],
      );

      return consumos;
    });
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
    this._validarCantidadAbsoluta(nuevaCantidad);

    const ahora = new Date().toISOString();

    // T-09: reemplazo de lotes atómico (DELETE + INSERT + stock).
    return this._db.transaction(async (tx) => {
      // 1. Register movement
      const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
      const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
      const params: unknown[] = [productoId, nuevaCantidad, 'ajuste', motivo, ahora];
      if (jornadaId !== undefined) params.push(jornadaId);

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (${placeholders})`,
        params,
      );

      // 2. Calculate weighted average cost from existing lots
      const lotes = await tx.sql<LoteStock>(
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
      await tx.sql(
        'DELETE FROM lotes_stock WHERE producto_id = ?',
        [productoId],
      );

      if (nuevaCantidad > 0) {
        await tx.sql(
          `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
           VALUES (?, ?, ?, ?, 'almacen', ?)`,
          [productoId, nuevaCantidad, costoPromedio, ahora, ahora],
        );
      }

      // 4. Update product stock (sum across both locations to set stock_almacen)
      //    Full ajuste replaces ALL lots — the whole product stock now lives in
      //    a single 'almacen' lot, so stock_shop must go to 0 to stay consistent
      //    with the lots (F5: antes quedaba con el valor viejo → divergencia).
      await tx.sql(
        `UPDATE productos
         SET stock_almacen = ?, stock_shop = 0,
              updated_at = ?
         WHERE id = ?`,
        [nuevaCantidad, ahora, productoId],
      );
    });
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
    this._validarCantidadDelta(cantidad);
    const ahora = new Date().toISOString();

    // T-09: consumo + creación de lotes shop + recálculo dual atómicos.
    return this._db.transaction(async (tx) => {
      // 1. Consume from almacen FIFO
      const consumos = await this._consumirFIFO(productoId, cantidad, 'almacen', undefined, tx);

      // 2. Create new shop lots with same costs
      for (const consumo of consumos) {
        await tx.sql(
          `INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, ubicacion, created_at)
           VALUES (?, ?, ?, ?, 'shop', ?)`,
          [productoId, consumo.cantidad, consumo.precio_costo_real, ahora, ahora],
        );
      }

      // 2b. Re-sync precio_costo AFTER inserting the shop lots: _consumirFIFO
      //     already synced, but when the traslado consumed ALL almacen stock the
      //     sync found no lot left. The new shop lots are now the FIFO front.
      await this._syncPrecioCosto(productoId, ahora, tx);

      // 3. Register movement
      const columnas = 'producto_id, cantidad, tipo, motivo, created_at' + (jornadaId !== undefined ? ', jornada_id' : '');
      const placeholders = '?, ?, ?, ?, ?' + (jornadaId !== undefined ? ', ?' : '');
      const params: unknown[] = [productoId, cantidad, 'traslado', null, ahora];
      if (jornadaId !== undefined) params.push(jornadaId);

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (${placeholders})`,
        params,
      );

      // 4. Recalculate both stock columns
      const [{ totalAlmacen }] = await tx.sql<{ totalAlmacen: number }>(
        "SELECT COALESCE(SUM(cantidad), 0) AS totalAlmacen FROM lotes_stock WHERE producto_id = ? AND ubicacion = 'almacen'",
        [productoId],
      );
      const [{ totalShop }] = await tx.sql<{ totalShop: number }>(
        "SELECT COALESCE(SUM(cantidad), 0) AS totalShop FROM lotes_stock WHERE producto_id = ? AND ubicacion = 'shop'",
        [productoId],
      );

      await tx.sql(
        `UPDATE productos
         SET stock_almacen = ?, stock_shop = ?, updated_at = ?
         WHERE id = ?`,
        [totalAlmacen, totalShop, ahora, productoId],
      );

      return consumos;
    });
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
    this._validarCantidadAbsoluta(nuevaCantidad);

    const ahora = new Date().toISOString();

    // T-09: movimiento + UPDATE lote + recálculo atómicos.
    await this._db.transaction(async (tx) => {
      // 1. Register movement
      const columnas = 'producto_id, cantidad, tipo, motivo, created_at';
      const params: unknown[] = [productoId, nuevaCantidad, 'ajuste', motivo, ahora];

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (?, ?, ?, ?, ?)`,
        params,
      );

      // 2. Update the specific lot
      await tx.sql(
        'UPDATE lotes_stock SET cantidad = ? WHERE id = ?',
        [nuevaCantidad, loteId],
      );

      // 2b. Re-sync precio_costo: if the ajuste zeroed the front lot, the cost
      //     advances to the next FIFO lot.
      await this._syncPrecioCosto(productoId, ahora, tx);

      // 3. Recalculate stock for this ubicacion
      const [{ total }] = await tx.sql<{ total: number }>(
        'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
        [productoId, ubicacion],
      );

      await tx.sql(
        `UPDATE productos
         SET ${this._stockCol(ubicacion)} = ?,
              updated_at = ?
         WHERE id = ?`,
        [total, ahora, productoId],
      );
    });
  }

  /**
   * Edita precio_venta del producto y precio_costo/cantidad de un lote específico.
   * Admin-only.
   */
  async registrarEditar(
    productoId: number,
    loteId: number,
    nombre: string,
    precioVenta: number,
    precioCosto: number,
    nuevaCantidad: number,
    motivo: string,
    ubicacion: 'almacen' | 'shop',
  ): Promise<void> {
    this._checkAdmin();
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo es obligatorio');
    }
    if (!nombre || nombre.trim().length === 0) {
      throw new Error('El nombre del producto es obligatorio');
    }
    this._validarCantidadAbsoluta(nuevaCantidad);
    this._validarPrecioVenta(precioVenta);
    this._validarPrecioCosto(precioCosto);

    const ahora = new Date().toISOString();

    // T-09: movimiento + UPDATEs + recálculo atómicos.
    await this._db.transaction(async (tx) => {
      // 1. Register movement
      await tx.sql(
        `INSERT INTO stock_movimientos (producto_id, cantidad, tipo, motivo, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [productoId, nuevaCantidad, 'ajuste', motivo, ahora],
      );

      // 2. Update product (nombre + precio_venta)
      await tx.sql(
        'UPDATE productos SET nombre = ?, precio_venta = ?, updated_at = ? WHERE id = ?',
        [nombre.trim(), precioVenta, ahora, productoId],
      );

      // 3. Update the specific lot (cantidad and precio_costo)
      await tx.sql(
        'UPDATE lotes_stock SET cantidad = ?, precio_costo = ? WHERE id = ?',
        [nuevaCantidad, precioCosto, loteId],
      );

      // 3b. Re-sync productos.precio_costo: the edited lot may be the FIFO front
      //     (cost changed) or was zeroed (front advances to the next lot).
      await this._syncPrecioCosto(productoId, ahora, tx);

      // 4. Recalculate stock for this ubicacion
      const [{ total }] = await tx.sql<{ total: number }>(
        'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
        [productoId, ubicacion],
      );

      await tx.sql(
        `UPDATE productos
         SET ${this._stockCol(ubicacion)} = ?,
              updated_at = ?
         WHERE id = ?`,
        [total, ahora, productoId],
      );
    });
  }

  /**
   * Registra una merma (rotura/pérdida) de producto:
   * 1. Valida que el motivo no esté vacío
   * 2. Consume stock desde los lotes más antiguos (FIFO) de la ubicación especificada
   * 3. Calcula costo_total = Σ(cantidad × precio_costo_real)
   * 4. Inserta stock_movimiento con tipo='merma' y costo_total
   * 5. Actualiza stock de la ubicación del producto (derivado de lotes)
   * 6. Actualiza total_merma y saldo_esperado de la jornada
   *
   * @param motivo Motivo de la merma — obligatorio, no puede ser vacío ni whitespace-only
   */
  async registrarMerma(
    productoId: number,
    cantidad: number,
    motivo: string,
    jornadaId?: number,
    ubicacion: 'almacen' | 'shop' = 'shop',
  ): Promise<{ consumos: ConsumoRecord[]; costoTotal: number }> {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo es obligatorio');
    }
    this._validarCantidadDelta(cantidad);

    const ahora = new Date().toISOString();

    // T-09: consumo + movimiento + stock + jornada atómicos. Si el UPDATE de
    // jornada falla, el consumo queda deshecho (ROLLBACK del adapter).
    return this._db.transaction(async (tx) => {
      // 1. Consume from oldest lots (FIFO) at the given ubicacion
      const consumos = await this._consumirFIFO(productoId, cantidad, ubicacion, undefined, tx);

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

      await tx.sql(
        `INSERT INTO stock_movimientos (${columnas})
         VALUES (${placeholders})`,
        params,
      );

      // 4. Update product stock for this ubicacion
      const [{ total }] = await tx.sql<{ total: number }>(
        'SELECT COALESCE(SUM(cantidad), 0) AS total FROM lotes_stock WHERE producto_id = ? AND ubicacion = ?',
        [productoId, ubicacion],
      );

      await tx.sql(
        `UPDATE productos
         SET ${this._stockCol(ubicacion)} = ?,
              updated_at = ?
         WHERE id = ?`,
        [total, ahora, productoId],
      );

      // 5. Update jornada financials — both shop and almacen merma affect P&L
      if (jornadaId !== undefined) {
        await tx.sql(
          `UPDATE jornadas
           SET total_merma = total_merma + ?,
                saldo_esperado = saldo_esperado - ?,
                updated_at = ?
           WHERE id = ?`,
          [costoTotal, costoTotal, ahora, jornadaId],
        );
      }

      return { consumos, costoTotal };
    });
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

  async obtenerLotesAgrupados(
    productoId: number,
  ): Promise<LoteDetalle[]> {
    return this._db.sql<LoteDetalle>(
      `SELECT
         MIN(id) as id,
         producto_id,
         SUM(cantidad) as cantidad,
         precio_costo,
         MIN(fecha_ingreso) as fecha_ingreso,
         COALESCE(SUM(CASE WHEN ubicacion = 'almacen' THEN cantidad ELSE 0 END), 0) as stock_almacen,
         COALESCE(SUM(CASE WHEN ubicacion = 'shop' THEN cantidad ELSE 0 END), 0) as stock_shop,
         MIN(created_at) as created_at
       FROM lotes_stock
       WHERE producto_id = ? AND cantidad > 0
       GROUP BY producto_id, precio_costo
       ORDER BY MIN(fecha_ingreso) ASC`,
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
