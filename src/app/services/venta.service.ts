import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import { StockMovimientoService } from './stock-movimiento.service';
import type { Venta } from '../models';
import type { CartItem } from './cart.service';

export interface VentaPayload {
  jornadaId: number;
  items: CartItem[];
  usuarioId: number;
  formaPago: string;
  divisaTipo?: 'EUR' | 'USD';
  montoDivisa?: number;
  tasaCambio?: number;
  compradorNombre?: string;
  autorizadoPor?: string;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root',
})
export class VentaService {
  private readonly _db = inject(DATABASE);
  private readonly _stockMovimiento = inject(StockMovimientoService);

  /**
   * Registra una venta en la DB:
   * 1. INSERT en ventas (con campos opcionales según formaPago)
   * 2. INSERT en detalle_ventas por cada item
   * 3. UPDATE stock en productos
   * 4. UPDATE total_ventas / saldo_esperado en la jornada (excepto pendiente)
   * 5. Registrar salida de stock vía StockMovimientoService por cada item
   */
  registrar(payload: VentaPayload): Observable<Venta> {
    if (!payload.usuarioId) {
      return new Observable((subscriber) => {
        subscriber.error(new Error('Usuario no autenticado'));
      });
    }

    const ahora = new Date().toISOString();

    // Para divisas: total = montoDivisa * tasaCambio
    // Para otros: total = suma del carrito
    let total: number;
    if (payload.formaPago === 'divisas' && payload.montoDivisa != null && payload.tasaCambio != null) {
      total = payload.montoDivisa * payload.tasaCambio;
    } else {
      total = payload.items.reduce((sum, item) => sum + item.subtotal, 0);
    }

    return from(
      this._ejecutar(
        payload.jornadaId,
        payload.items,
        total,
        ahora,
        payload.usuarioId,
        payload.formaPago,
        payload.formaPago !== 'efectivo' && payload.formaPago !== 'transferencia',
        payload,
      ),
    ).pipe(map((rows) => rows[0]));
  }

  private async _validarStock(items: CartItem[]): Promise<void> {
    for (const item of items) {
      const rows = await this._db.sql<{ stock_actual: number }>(
        'SELECT stock_actual FROM productos WHERE id = ?',
        [item.producto.id],
      );
      const stockActual = rows[0]?.stock_actual ?? 0;
      if (item.cantidad > stockActual) {
        throw new Error('Stock insuficiente');
      }
    }
  }

  private async _ejecutar(
    jornadaId: number,
    items: CartItem[],
    total: number,
    ahora: string,
    usuarioId: number,
    formaPago: string,
    hasExtraFields: boolean,
    payload: VentaPayload,
  ): Promise<Venta[]> {
    await this._validarStock(items);
    await this._db.sql('BEGIN TRANSACTION');

    try {
      // 1. Insertar venta con campos condicionales
      const columnasBase = ['jornada_id', 'fecha_hora', 'total', 'created_at', 'usuario_id', 'forma_pago'];
      const placeholdersBase = ['?', '?', '?', '?', '?', '?'];
      const valoresBase: unknown[] = [jornadaId, ahora, total, ahora, usuarioId, formaPago];

      const columnasExtra: string[] = [];
      const placeholdersExtra: string[] = [];
      const valoresExtra: unknown[] = [];

      if (hasExtraFields) {
        if (payload.divisaTipo != null) {
          columnasExtra.push('divisa_tipo');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.divisaTipo);
        }
        if (payload.montoDivisa != null) {
          columnasExtra.push('monto_divisa');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.montoDivisa);
        }
        if (payload.tasaCambio != null) {
          columnasExtra.push('tasa_cambio');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.tasaCambio);
        }
        if (payload.compradorNombre) {
          columnasExtra.push('comprador_nombre');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.compradorNombre);
        }
        if (payload.autorizadoPor) {
          columnasExtra.push('autorizado_por');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.autorizadoPor);
        }
        if (payload.descripcion) {
          columnasExtra.push('descripcion');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.descripcion);
        }
      }

      const todasColumnas = [...columnasBase, ...columnasExtra].join(', ');
      const todosPlaceholders = [...placeholdersBase, ...placeholdersExtra].join(', ');
      const todosValores = [...valoresBase, ...valoresExtra];

      const ventas = await this._db.sql<Venta>(
        `INSERT INTO ventas (${todasColumnas})
         VALUES (${todosPlaceholders})
         RETURNING *`,
        todosValores,
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

      // 3. Actualizar jornada SOLO si NO es pendiente
      if (formaPago !== 'pendiente') {
        await this._db.sql(
          `UPDATE jornadas
           SET total_ventas = total_ventas + ?,
                saldo_esperado = saldo_esperado + ?,
                updated_at = ?
           WHERE id = ?`,
          [total, total, ahora, jornadaId],
        );
      }

      // 4. Registrar salida de stock para cada item (dentro de la transacción)
      for (const item of items) {
        await this._stockMovimiento.registrarSalida(
          item.producto.id,
          item.cantidad,
        );
      }

      await this._db.sql('COMMIT');
      return [venta];
    } catch (error) {
      await this._db.sql('ROLLBACK');
      throw error;
    }
  }
}
