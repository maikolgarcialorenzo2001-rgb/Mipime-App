import { Injectable, inject, signal } from '@angular/core';
import { from, map, Observable, tap } from 'rxjs';
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

  /** Señal compartida de la jornada abierta actual (null si no hay). */
  readonly jornadaAbierta = signal<Jornada | null>(null);

  /** `true` mientras se carga la jornada por primera vez o se refresca. */
  readonly jornadaCargando = signal(true);

  constructor() {
    this.refreshJornadaAbierta();
  }

  /** Recarga la jornada abierta desde la DB y actualiza `jornadaAbierta`. */
  refreshJornadaAbierta(): void {
    this.jornadaCargando.set(true);
    this.obtenerAbierta().subscribe({
      next: (j) => {
        this.jornadaAbierta.set(j);
        this.jornadaCargando.set(false);
      },
      error: () => {
        this.jornadaAbierta.set(null);
        this.jornadaCargando.set(false);
      },
    });
  }

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
    ).pipe(
      map((rows) => rows[0]),
      tap((j) => this.jornadaAbierta.set(j)),
    );
  }

  /**
   * Cierra la jornada:
   * 1. Verifica que el usuario sea admin
   * 2. Ejecuta el cierre (UPDATE → SELECT → Excel → reporte)
   */
  cerrar(id: number, saldoReal: number, userId: number): Observable<Jornada> {
    return from(this._cerrarAsync(id, saldoReal, userId)).pipe(
      tap(() => this.jornadaAbierta.set(null)),
    );
  }

  /**
   * Cierra una jornada sin verificar rol de admin.
   * Usado por pending_close para auto-cierre desde App.ngOnInit.
   * Usa saldo_esperado como saldo_real.
   */
  cerrarSinAuth(jornadaId: number, userId: number): Observable<Jornada> {
    return from(this._cerrarSinAuthAsync(jornadaId, userId)).pipe(
      tap(() => this.jornadaAbierta.set(null)),
    );
  }

  private async _cerrarSinAuthAsync(id: number, userId: number): Promise<Jornada> {
    // Obtener saldo_esperado antes de cerrar
    const preJornada = await this._db.sql<Jornada>(
      'SELECT * FROM jornadas WHERE id = ?',
      [id],
    );
    if (preJornada.length === 0) throw new Error('Jornada no encontrada');

    return this._ejecutarCierre(id, preJornada[0].saldo_esperado, userId);
  }

  private async _cerrarAsync(
    id: number,
    saldoReal: number,
    userId: number,
  ): Promise<Jornada> {
    // Verificar que el usuario sea admin
    const usuarios = await this._db.sql<{ rol: string }>(
      'SELECT rol FROM usuarios WHERE id = ?',
      [userId],
    );
    if (usuarios.length === 0) throw new Error('Usuario no encontrado');
    if (usuarios[0].rol !== 'admin') throw new Error('Solo administradores pueden cerrar la jornada');

    return this._ejecutarCierre(id, saldoReal, userId);
  }

  /**
   * Ejecuta el cierre efectivo de la jornada:
   * 1. Obtiene ventas, detalles y movimientos
   * 2. UPDATE jornada (estado = 'cerrada') — ANTES de la generación de Excel
   * 3. Lee productos para el mapa de nombres
   * 4. Genera Excel con estado fresco y nombres de producto
   * 5. Almacena el reporte
   */
  private async _ejecutarCierre(
    id: number,
    saldoReal: number,
    userId: number,
  ): Promise<Jornada> {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    // 1. Obtener ventas con detalles de esta jornada
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

    // 2. Obtener movimientos de la jornada
    const movimientos = await this._db.sql<Movimiento>(
      'SELECT * FROM movimientos WHERE jornada_id = ? ORDER BY id',
      [id],
    );

    // 3. Cerrar la jornada PRIMERO (UPDATE antes de generar Excel)
    const result = await this._db.sql<Jornada>(
      `UPDATE jornadas
       SET hora_cierre = ?, saldo_real = ?, user_cierre_id = ?, estado = 'cerrada', updated_at = ?
       WHERE id = ?
       RETURNING *`,
      [hora, saldoReal, userId, iso, id],
    );
    if (result.length === 0) throw new Error('Jornada no encontrada');
    const jornada = result[0];

    // 4. Obtener productos para el mapa de nombres
    const productos = await this._db.sql<{ id: number; nombre: string }>(
      'SELECT id, nombre FROM productos',
    );
    const productosMap = new Map<number, string>();
    for (const p of productos) {
      productosMap.set(p.id, p.nombre);
    }

    // 5. Agrupar detalles por venta
    const ventasConDetalles = ventas.map((v) => ({
      ...v,
      detalles: detalles.filter((d) => d.venta_id === v.id),
    }));

    // 6. Generar Excel con estado fresco y nombres de producto
    const base64 = this._excelService.generarExcelJornada({
      jornada,
      ventas: ventasConDetalles,
      movimientos,
      productosMap,
    });

    const filename = `jornada_${jornada.fecha}_${jornada.id}.xlsx`;

    // 7. Almacenar en jornada_reportes
    await this._db.sql(
      `INSERT INTO jornada_reportes (jornada_id, content_type, content_base64, filename, created_at)
       VALUES (?, 'excel', ?, ?, ?)`,
      [id, base64, filename, iso],
    );

    return jornada;
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
