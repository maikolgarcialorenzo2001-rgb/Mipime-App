import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import { StockMovimientoService } from './stock-movimiento.service';
import type { CuentaCosa } from '../models';

export interface CuentaCosaItem {
  productoId: number;
  cantidad: number;
}

@Injectable({
  providedIn: 'root',
})
export class CuentaCosasService {
  private readonly _db = inject(DATABASE);
  private readonly _stockMovimiento = inject(StockMovimientoService);

  async registrar(
    jornadaId: number,
    productoId: number,
    cantidad: number,
    descripcion: string | null,
    autorizadoPor: string,
  ): Promise<void> {
    return this.registrarLote(jornadaId, [{ productoId, cantidad }], descripcion, autorizadoPor);
  }

  async registrarLote(
    jornadaId: number,
    items: CuentaCosaItem[],
    descripcion: string | null,
    autorizadoPor: string,
  ): Promise<void> {
    // Empty items → resolve immediately without DB calls
    if (items.length === 0) {
      return;
    }

    // Pre-validate ALL items via stock_shop before BEGIN (mirror VentaService._validarStock)
    await this._validarStock(items);

    const ahora = new Date().toISOString();

    // BEGIN TRANSACTION
    await this._db.sql('BEGIN TRANSACTION');

    try {
      // Per item: INSERT INTO cuenta_cosas + registrarSalida (interleaved)
      for (const item of items) {
        await this._db.sql(
          `INSERT INTO cuenta_cosas (jornada_id, producto_id, cantidad, descripcion, autorizado_por, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [jornadaId, item.productoId, item.cantidad, descripcion ?? null, autorizadoPor, ahora],
        );

        await this._stockMovimiento.registrarSalida(item.productoId, item.cantidad, undefined, jornadaId);
      }

      // COMMIT
      await this._db.sql('COMMIT');
    } catch (error) {
      // ROLLBACK on any error
      await this._db.sql('ROLLBACK');
      throw error;
    }
  }

  private async _validarStock(items: CuentaCosaItem[]): Promise<void> {
    for (const item of items) {
      const rows = await this._db.sql<{ stock_shop: number }>(
        'SELECT stock_shop FROM productos WHERE id = ?',
        [item.productoId],
      );
      const stockActual = rows[0]?.stock_shop ?? 0;
      if (item.cantidad > stockActual) {
        throw new Error('Stock insuficiente');
      }
    }
  }

  async listarPorJornada(jornadaId: number): Promise<CuentaCosa[]> {
    return this._db.sql<CuentaCosa>(
      'SELECT * FROM cuenta_cosas WHERE jornada_id = ? ORDER BY created_at ASC, id ASC',
      [jornadaId],
    );
  }
}