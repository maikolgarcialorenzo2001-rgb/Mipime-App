import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import type { Venta } from '../models';
import type { CartItem } from './cart.service';

@Injectable({
  providedIn: 'root',
})
export class VentaService {
  private readonly _db = inject(DATABASE);

  /**
   * Registra una venta en la DB:
   * 1. INSERT en ventas
   * 2. INSERT en detalle_ventas por cada item
   * 3. UPDATE stock en productos
   * 4. UPDATE total_ventas / saldo_esperado en la jornada
   */
  registrar(jornadaId: number, items: CartItem[]): Observable<Venta> {
    const ahora = new Date().toISOString();
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return from(this._ejecutar(jornadaId, items, total, ahora)).pipe(
      map((rows) => rows[0]),
    );
  }

  private async _ejecutar(
    jornadaId: number,
    items: CartItem[],
    total: number,
    ahora: string,
  ): Promise<Venta[]> {
    // 1. Insertar venta
    const ventas = await this._db.sql<Venta>(
      `INSERT INTO ventas (jornada_id, fecha_hora, total, created_at)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
      [jornadaId, ahora, total, ahora],
    );
    const venta = ventas[0];

    // 2. Insertar detalle_ventas y actualizar stock (por lotes de 25)
    const batchSize = 25;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const placeholders = batch
        .map(() => '(?, ?, ?, ?, ?)')
        .join(', ');
      const flatParams: unknown[] = [];
      for (const item of batch) {
        flatParams.push(
          venta.id,
          item.producto.id,
          item.cantidad,
          item.producto.precio_venta,
          item.subtotal,
        );
      }

      await this._db.sql(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ${placeholders}`,
        flatParams,
      );

      // Actualizar stock de cada producto en el lote
      const stockCases = batch
        .map(() => 'WHEN ? THEN stock_actual - ?')
        .join(' ');
      const stockIds = batch.map(() => '?').join(', ');
      const stockParams: unknown[] = [];
      for (const item of batch) {
        stockParams.push(item.producto.id, item.cantidad);
      }
      for (const item of batch) {
        stockParams.push(item.producto.id);
      }

      await this._db.sql(
        `UPDATE productos
         SET stock_actual = CASE id ${stockCases} END,
             updated_at = ?
         WHERE id IN (${stockIds})`,
        [...stockParams, ahora],
      );
    }

    // 3. Actualizar jornada
    await this._db.sql(
      `UPDATE jornadas
       SET total_ventas = total_ventas + ?,
           saldo_esperado = saldo_esperado + ?,
           updated_at = ?
       WHERE id = ?`,
      [total, total, ahora, jornadaId],
    );

    return [venta];
  }
}
