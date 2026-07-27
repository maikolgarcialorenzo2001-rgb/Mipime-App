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
  billeteRecibido?: number;
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
   * 4. UPDATE total_ventas / saldo_esperado en la jornada (incluye pendientes)
   * 5. Registrar salida de stock vía StockMovimientoService por cada item
   */
  registrar(payload: VentaPayload): Observable<Venta> {
    if (!payload.usuarioId) {
      return new Observable((subscriber) => {
        subscriber.error(new Error('Usuario no autenticado'));
      });
    }

    const ahora = new Date().toISOString();

    // Para divisas: total = billeteRecibido * tasaCambio
    // Para otros: total = suma del carrito
    let total: number;
    if (payload.formaPago === 'divisas' && payload.billeteRecibido != null && payload.tasaCambio != null) {
      total = payload.billeteRecibido * payload.tasaCambio;
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
      const rows = await this._db.sql<{ stock_shop: number }>(
        'SELECT stock_shop FROM productos WHERE id = ?',
        [item.producto.id],
      );
      const stockActual = rows[0]?.stock_shop ?? 0;
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
        if (payload.billeteRecibido != null) {
          columnasExtra.push('monto_divisa');
          placeholdersExtra.push('?');
          valoresExtra.push(payload.billeteRecibido);
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

      // 2. Insertar detalle_ventas por cada item
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
      }

      // 3. Actualizar jornada (incluye pendientes en saldo_esperado)
      await this._db.sql(
        `UPDATE jornadas
         SET total_ventas = total_ventas + ?,
              saldo_esperado = saldo_esperado + ?,
              updated_at = ?
         WHERE id = ?`,
        [total, total, ahora, jornadaId],
      );

      // 4. Consumir stock vía FIFO y registrar venta_lotes
      for (const item of items) {
        const consumos = await this._stockMovimiento.registrarSalida(
          item.producto.id,
          item.cantidad,
        );

        // Insert venta_lotes records
        if (consumos.length > 0) {
          const vlPlaceholders = consumos.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          const vlParams: unknown[] = [];
          for (const c of consumos) {
            vlParams.push(venta.id, c.lote_id, item.producto.id, c.cantidad, c.precio_costo_real, ahora);
          }
          await this._db.sql(
            `INSERT INTO venta_lotes (venta_id, lote_id, producto_id, cantidad, precio_costo_real, created_at)
             VALUES ${vlPlaceholders}`,
            vlParams,
          );
        }
      }

      await this._db.sql('COMMIT');
      return [venta];
    } catch (error) {
      await this._db.sql('ROLLBACK');
      throw error;
    }
  }
}
