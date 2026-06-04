import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import type { Jornada } from '../models';

@Injectable({
  providedIn: 'root',
})
export class JornadaService {
  private readonly _db = inject(DATABASE);

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

  /** Cierra la jornada registrando el saldo real. */
  cerrar(id: number, saldoReal: number): Observable<Jornada> {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    return from(
      this._db.sql<Jornada>(
        `UPDATE jornadas
         SET hora_cierre = ?, saldo_real = ?, estado = 'cerrada', updated_at = ?
         WHERE id = ?
         RETURNING *`,
        [hora, saldoReal, iso, id],
      ),
    ).pipe(
      map((rows) => {
        if (rows.length === 0) throw new Error('Jornada no encontrada');
        return rows[0];
      }),
    );
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
