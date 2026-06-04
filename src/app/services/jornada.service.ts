import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import { ExcelService } from './excel.service';
import type { Jornada, JornadaReporte } from '../models';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';

@Injectable({
  providedIn: 'root',
})
export class JornadaService {
  private readonly _db = inject(DATABASE);
  private readonly _excelService = inject(ExcelService);

  /** Abre una nueva jornada con el monto inicial del día. */
  abrir(montoInicial: number): Observable<Jornada> {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    return from(
      this._db.sql<Jornada>(
        `INSERT INTO jornadas (fecha, hora_apertura, monto_inicial, total_ventas, total_gastos, saldo_esperado, estado, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, ?, 'abierta', ?, ?)
         RETURNING *`,
        [fecha, hora, montoInicial, montoInicial, iso, iso],
      ),
    ).pipe(map((rows) => rows[0]));
  }

  /**
   * Cierra la jornada:
   * 1. Verifica que el usuario sea admin
   * 2. Genera Excel con ventas y movimientos
   * 3. Almacena el Excel en jornada_reportes
   * 4. Actualiza la jornada (hora_cierre, saldo_real, user_cierre_id, estado)
   */
  cerrar(id: number, saldoReal: number, userId: number): Observable<Jornada> {
    return from(this._cerrarAsync(id, saldoReal, userId));
  }

  private async _cerrarAsync(
    id: number,
    saldoReal: number,
    userId: number,
  ): Promise<Jornada> {
    // 1. Verificar que el usuario sea admin
    const usuarios = await this._db.sql<{ rol: string }>(
      'SELECT rol FROM usuarios WHERE id = ?',
      [userId],
    );
    if (usuarios.length === 0) throw new Error('Usuario no encontrado');
    if (usuarios[0].rol !== 'admin') throw new Error('Solo administradores pueden cerrar la jornada');

    const ahora = new Date();
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    // 2. Obtener ventas con detalles de esta jornada
    const ventas = await this._db.sql<Venta>(
      'SELECT * FROM ventas WHERE jornada_id = ? ORDER BY id',
      [id],
    );

    const ventaIds = ventas.map((v) => v.id);
    let detalles: DetalleVenta[] = [];
    if (ventaIds.length > 0) {
      const placeholders = ventaIds.map(() => '?').join(', ');
      detalles = await this._db.sql<DetalleVenta>(
        `SELECT * FROM detalle_ventas WHERE venta_id IN (${placeholders}) ORDER BY id`,
        ventaIds,
      );
    }

    // 3. Obtener movimientos de la jornada
    const movimientos = await this._db.sql<Movimiento>(
      'SELECT * FROM movimientos WHERE jornada_id = ? ORDER BY id',
      [id],
    );

    // 4. Obtener la jornada para generar Excel
    const jornadas = await this._db.sql<Jornada>(
      'SELECT * FROM jornadas WHERE id = ?',
      [id],
    );
    if (jornadas.length === 0) throw new Error('Jornada no encontrada');
    const jornada = jornadas[0];

    // 5. Agrupar detalles por venta
    const ventasConDetalles = ventas.map((v) => ({
      ...v,
      detalles: detalles.filter((d) => d.venta_id === v.id),
    }));

    // 6. Generar Excel
    const base64 = this._excelService.generarExcelJornada({
      jornada,
      ventas: ventasConDetalles,
      movimientos,
    });

    const filename = `jornada_${jornada.fecha}_${jornada.id}.xlsx`;

    // 7. Almacenar en jornada_reportes
    await this._db.sql(
      `INSERT INTO jornada_reportes (jornada_id, content_type, content_base64, filename, created_at)
       VALUES (?, 'excel', ?, ?, ?)`,
      [id, base64, filename, iso],
    );

    // 8. Cerrar la jornada
    const result = await this._db.sql<Jornada>(
      `UPDATE jornadas
       SET hora_cierre = ?, saldo_real = ?, user_cierre_id = ?, estado = 'cerrada', updated_at = ?
       WHERE id = ?
       RETURNING *`,
      [hora, saldoReal, userId, iso, id],
    );

    if (result.length === 0) throw new Error('Jornada no encontrada');
    return result[0];
  }

  /** Obtiene el reporte Excel de una jornada cerrada. */
  obtenerReporte(jornadaId: number): Observable<JornadaReporte | null> {
    return from(
      this._db.sql<JornadaReporte>(
        'SELECT * FROM jornada_reportes WHERE jornada_id = ? ORDER BY id DESC LIMIT 1',
        [jornadaId],
      ),
    ).pipe(map((rows) => rows[0] ?? null));
  }

  /** Obtiene la jornada abierta del día, si existe. */
  obtenerAbierta(): Observable<Jornada | null> {
    const hoy = new Date().toISOString().split('T')[0];

    return from(
      this._db.sql<Jornada>(
        'SELECT * FROM jornadas WHERE fecha = ? AND estado = ? ORDER BY id DESC LIMIT 1',
        [hoy, 'abierta'],
      ),
    ).pipe(map((rows) => rows[0] ?? null));
  }

  /** Historial de jornadas ordenado por fecha descendente. */
  historial(limite = 30): Observable<Jornada[]> {
    return from(
      this._db.sql<Jornada>(
        'SELECT * FROM jornadas ORDER BY fecha DESC, id DESC LIMIT ?',
        [limite],
      ),
    );
  }
}
