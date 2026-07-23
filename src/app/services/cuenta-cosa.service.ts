import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import { StockMovimientoService } from './stock-movimiento.service';

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
    const ahora = new Date().toISOString();

    await this._db.sql(
      `INSERT INTO cuenta_cosas (jornada_id, producto_id, cantidad, descripcion, autorizado_por, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jornadaId, productoId, cantidad, descripcion ?? null, autorizadoPor, ahora],
    );

    await this._stockMovimiento.registrarSalida(productoId, cantidad);
  }
}
