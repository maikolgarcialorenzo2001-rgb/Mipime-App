import { Injectable, inject, signal } from '@angular/core';
import { from, map, Observable, switchMap, tap } from 'rxjs';
import { DATABASE } from './database';
import { ExcelService, type JornadaReportData, type VentaConDetalles } from './excel.service';
import type { Jornada, JornadaReporte } from '../models';
import type { UsuarioPublico } from '../models';
import type { Venta, DetalleVenta } from '../models/venta';
import type { Movimiento } from '../models/movimiento';
import type { StockMovimiento } from '../models/stock-movimiento';

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

  /**
   * Registra un movimiento (gasto o ingreso_extra) en la jornada abierta.
   * Inserta en `movimientos` y actualiza `total_gastos` + `saldo_esperado`.
   */
  registrarMovimiento(
    jornadaId: number,
    tipo: 'gasto' | 'ingreso_extra',
    descripcion: string,
    monto: number,
  ): Observable<Movimiento> {
    return from(this._registrarMovimientoAsync(jornadaId, tipo, descripcion, monto));
  }

  private async _registrarMovimientoAsync(
    jornadaId: number,
    tipo: 'gasto' | 'ingreso_extra',
    descripcion: string,
    monto: number,
  ): Promise<Movimiento> {
    if (!['gasto', 'ingreso_extra'].includes(tipo)) throw new Error('Tipo inválido');
    if (!descripcion || descripcion.trim().length === 0) throw new Error('Descripción requerida');
    if (!monto || monto <= 0) throw new Error('Monto debe ser mayor a 0');

    const ahora = new Date().toISOString();

    const movs = await this._db.sql<Movimiento>(
      `INSERT INTO movimientos (jornada_id, tipo, descripcion, monto, created_at)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [jornadaId, tipo, descripcion, monto, ahora],
    );

    const ajuste = tipo === 'gasto' ? -monto : monto;
    await this._db.sql(
      `UPDATE jornadas
       SET total_gastos = total_gastos + ?,
           saldo_esperado = saldo_esperado + ?,
           updated_at = ?
       WHERE id = ?`,
      [monto, ajuste, ahora, jornadaId],
    );

    return movs[0];
  }

  /**
   * Calcula el total de merma de una jornada sumando costo_total de
   * los stock_movimientos con tipo='merma'.
   */
  async calcularTotalMerma(jornadaId: number): Promise<number> {
    const result = await this._db.sql<{ total: number }>(
      `SELECT COALESCE(SUM(costo_total), 0) as total FROM stock_movimientos WHERE jornada_id = ? AND tipo = 'merma'`,
      [jornadaId],
    );
    return result[0]?.total ?? 0;
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

  /**
   * Auto-cierra la jornada abierta de hoy si fue abierta por OTRO usuario.
   * - Sin jornada abierta → null
   * - Mismo usuario → retorna la jornada (puede reabrir)
   * - user_apertura_id NULL (legacy) → retorna la jornada
   * - Otro usuario → cierra la jornada y retorna null
   */
  async autoCerrarSiOtroUsuario(usuario: UsuarioPublico): Promise<Jornada | null> {
    const hoy = new Date().toISOString().split('T')[0];

    const rows = await this._db.sql<Jornada>(
      'SELECT * FROM jornadas WHERE fecha = ? AND estado = ? ORDER BY id DESC LIMIT 1',
      [hoy, 'abierta'],
    );

    if (rows.length === 0) return null;

    const jornada = rows[0];

    // Legacy: no user_apertura_id → retornar (no se puede determinar dueño)
    if (jornada.user_apertura_id === null) return jornada;

    // Mismo usuario → retornar
    if (jornada.user_apertura_id === usuario.id) return jornada;

    // Distinto usuario → auto-cerrar
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    await this._db.sql(
      `UPDATE jornadas
       SET estado = 'cerrada', hora_cierre = ?, saldo_real = saldo_esperado,
           user_cierre_id = ?, updated_at = ?
       WHERE id = ?`,
      [hora, usuario.id, iso, jornada.id],
    );

    this.jornadaAbierta.set(null);
    return null;
  }

  /** Abre una nueva jornada con el monto inicial del día. */
  abrir(montoInicial: number, userId?: number): Observable<Jornada> {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toLocaleTimeString();
    const iso = ahora.toISOString();

    return from(
      this._db.sql<Jornada>(
        `INSERT INTO jornadas (fecha, hora_apertura, monto_inicial, total_ventas, total_gastos, saldo_esperado, user_apertura_id, estado, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, ?, ?, 'abierta', ?, ?)
         RETURNING *`,
        [fecha, hora, montoInicial, montoInicial, userId ?? null, iso, iso],
      ),
    ).pipe(
      map((rows) => rows[0]),
      tap((j) => this.jornadaAbierta.set(j)),
    );
  }

  /** Cierra la jornada:
   * 1. Verifica que el usuario sea admin
   * 2. Ejecuta el cierre (UPDATE → SELECT → Excel → reporte)
   */
  cerrar(id: number, saldoReal: number, userId: number): Observable<Jornada> {
    return from(this._cerrarAsync(id, saldoReal, userId)).pipe(
      tap(() => this.jornadaAbierta.set(null)),
    );
  }

  private async _cerrarAsync(
    id: number,
    saldoReal: number,
    userId: number,
  ): Promise<Jornada> {
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

    // 4. Obtener productos para el mapa de nombres + precio_costo
    const productos = await this._db.sql<{ id: number; nombre: string; precio_costo: number | null }>(
      'SELECT id, nombre, precio_costo FROM productos',
    );
    const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>();
    for (const p of productos) {
      productosMap.set(p.id, { nombre: p.nombre, precio_costo: p.precio_costo });
    }

    // 5. Calcular costo total de productos vendidos (FIFO: desde venta_lotes)
    let totalCosto = 0;
    if (ventaIds.length > 0) {
      const costoPlaceholders = ventaIds.map(() => '?').join(', ');
      const costoResult = await this._db.sql<{ total_costo: number }>(
        `SELECT COALESCE(SUM(vl.cantidad * vl.precio_costo_real), 0) as total_costo
         FROM venta_lotes vl
         WHERE vl.venta_id IN (${costoPlaceholders})`,
        ventaIds,
      );
      totalCosto = costoResult[0]?.total_costo ?? 0;

      // Fallback: if no venta_lotes records (pre-FIFO sales), use product current cost
      if (totalCosto === 0) {
        const fallbackResult = await this._db.sql<{ total_costo: number }>(
          `SELECT COALESCE(SUM(dv.cantidad * COALESCE(p.precio_costo, 0)), 0) as total_costo
           FROM detalle_ventas dv
           JOIN productos p ON p.id = dv.producto_id
           WHERE dv.venta_id IN (${costoPlaceholders})`,
          ventaIds,
        );
        totalCosto = fallbackResult[0]?.total_costo ?? 0;
      }
    }

    // 6. Obtener nombre del usuario que cerró
    const users = await this._db.sql<{ nombre: string }>(
      'SELECT nombre FROM usuarios WHERE id = ?',
      [userId],
    );
    const userCierreNombre = users[0]?.nombre ?? null;

    // 7. Obtener cuenta_cosas de la jornada
    const cuentaCosas = await this._db.sql<import('../models/cuenta-cosa').CuentaCosa>(
      'SELECT * FROM cuenta_cosas WHERE jornada_id = ? ORDER BY id',
      [id],
    );

    // 8. Agrupar detalles por venta
    const ventasConDetalles = ventas.map((v) => ({
      ...v,
      detalles: detalles.filter((d) => d.venta_id === v.id),
    }));

    // 9. Obtener movimientos de stock de la jornada
    const stockMovimientos = await this._db.sql<StockMovimiento>(
      'SELECT * FROM stock_movimientos WHERE jornada_id = ? ORDER BY created_at',
      [id],
    );

    // 10. Obtener venta_lotes para desglose FIFO en Excel
    let ventaLotes: import('../models/venta-lote').VentaLote[] = [];
    if (ventaIds.length > 0) {
      const vlPlaceholders = ventaIds.map(() => '?').join(', ');
      ventaLotes = await this._db.sql<import('../models/venta-lote').VentaLote>(
        `SELECT * FROM venta_lotes WHERE venta_id IN (${vlPlaceholders})`,
        ventaIds,
      );
    }

    // 11. Generar Excel con estado fresco y nombres de producto
    const base64 = this._excelService.generarExcelJornada({
      jornada,
      ventas: ventasConDetalles,
      movimientos,
      stockMovimientos,
      ventaLotes,
      productosMap,
      totalCosto,
      userCierreNombre,
      cuentaCosas,
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

  /**
   * Genera la exportación mensual de todas las jornadas cerradas del mes.
   * @returns Observable que emite el base64 del Excel multi-hoja
   */
  generarExportacionMensual(year: number, month: number): Observable<string> {
    return this.jornadasDelMes(year, month).pipe(
      switchMap((jornadas) => {
        if (jornadas.length === 0) {
          throw new Error('No hay jornadas cerradas en este mes.');
        }
        const dataPromises = jornadas.map((j) =>
          this._recolectarDatosJornada(j.id, j.user_cierre_id).then(
            (datos): JornadaReportData => ({
              jornada: j,
              ventas: datos.ventas,
              movimientos: datos.movimientos,
              stockMovimientos: datos.stockMovimientos,
              ventaLotes: datos.ventaLotes,
              productosMap: datos.productosMap,
              totalCosto: datos.totalCosto,
              userCierreNombre: datos.userCierreNombre,
              cuentaCosas: datos.cuentaCosas,
            }),
          ),
        );
        return from(Promise.all(dataPromises));
      }),
      map((allData) => this._excelService.generarExcelMensual(allData)),
    );
  }

  /**
   * Obtiene todos los datos detallados de una jornada (ventas con detalles, movimientos, costos).
   * Útil para vista previa o exportación.
   */
  obtenerDatosJornada(jornadaId: number, userId: number | null): Observable<JornadaReportData> {
    return from(this._recolectarDatosJornada(jornadaId, userId)).pipe(
      map((datos) => ({
        // jornada no se usa desde preview (el caller ya tiene la referencia),
        // pero JornadaReportData lo requiere
        jornada: { id: jornadaId } as Jornada,
        ventas: datos.ventas,
        movimientos: datos.movimientos,
        stockMovimientos: datos.stockMovimientos,
        ventaLotes: datos.ventaLotes,
        productosMap: datos.productosMap,
        totalCosto: datos.totalCosto,
        userCierreNombre: datos.userCierreNombre,
        cuentaCosas: datos.cuentaCosas,
      })),
    );
  }

  /**
   * Recolecta todos los datos necesarios para generar el Excel de una jornada:
   * ventas con detalles, movimientos, productosMap, totalCosto y nombre del usuario.
   */
  private async _recolectarDatosJornada(jornadaId: number, userId: number | null): Promise<{
    ventas: VentaConDetalles[];
    movimientos: Movimiento[];
    stockMovimientos: StockMovimiento[];
    ventaLotes: import('../models/venta-lote').VentaLote[];
    productosMap: Map<number, { nombre: string; precio_costo: number | null }>;
    totalCosto: number;
    userCierreNombre: string | null;
    cuentaCosas: import('../models/cuenta-cosa').CuentaCosa[];
  }> {
    // 1. Obtener ventas con detalles de esta jornada
    const ventas = await this._db.sql<Venta>(
      'SELECT * FROM ventas WHERE jornada_id = ? ORDER BY id',
      [jornadaId],
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
      [jornadaId],
    );

    // 2b. Obtener movimientos de stock de la jornada
    const stockMovimientos = await this._db.sql<StockMovimiento>(
      'SELECT * FROM stock_movimientos WHERE jornada_id = ? ORDER BY created_at',
      [jornadaId],
    );

    // 2c. Obtener venta_lotes para desglose FIFO en Excel
    let ventaLotes: import('../models/venta-lote').VentaLote[] = [];
    if (ventaIds.length > 0) {
      const vlPlaceholders = ventaIds.map(() => '?').join(', ');
      ventaLotes = await this._db.sql<import('../models/venta-lote').VentaLote>(
        `SELECT * FROM venta_lotes WHERE venta_id IN (${vlPlaceholders})`,
        ventaIds,
      );
    }

    // 3. Obtener productos para el mapa de nombres + precio_costo
    const productos = await this._db.sql<{ id: number; nombre: string; precio_costo: number | null }>(
      'SELECT id, nombre, precio_costo FROM productos',
    );
    const productosMap = new Map<number, { nombre: string; precio_costo: number | null }>();
    for (const p of productos) {
      productosMap.set(p.id, { nombre: p.nombre, precio_costo: p.precio_costo });
    }

    // 4. Calcular costo total de productos vendidos (FIFO: desde venta_lotes)
    let totalCosto = 0;
    if (ventaIds.length > 0) {
      const costoPlaceholders = ventaIds.map(() => '?').join(', ');
      const costoResult = await this._db.sql<{ total_costo: number }>(
        `SELECT COALESCE(SUM(vl.cantidad * vl.precio_costo_real), 0) as total_costo
         FROM venta_lotes vl
         WHERE vl.venta_id IN (${costoPlaceholders})`,
        ventaIds,
      );
      totalCosto = costoResult[0]?.total_costo ?? 0;

      // Fallback for pre-FIFO sales
      if (totalCosto === 0) {
        const fallbackResult = await this._db.sql<{ total_costo: number }>(
          `SELECT COALESCE(SUM(dv.cantidad * COALESCE(p.precio_costo, 0)), 0) as total_costo
           FROM detalle_ventas dv
           JOIN productos p ON p.id = dv.producto_id
           WHERE dv.venta_id IN (${costoPlaceholders})`,
          ventaIds,
        );
        totalCosto = fallbackResult[0]?.total_costo ?? 0;
      }
    }

    // 5. Obtener nombre del usuario que cerró
    let userCierreNombre: string | null = null;
    if (userId !== null) {
      const users = await this._db.sql<{ nombre: string }>(
        'SELECT nombre FROM usuarios WHERE id = ?',
        [userId],
      );
      userCierreNombre = users[0]?.nombre ?? null;
    }

    // 6. Obtener cuenta_cosas de la jornada
    const cuentaCosas = await this._db.sql<import('../models/cuenta-cosa').CuentaCosa>(
      'SELECT * FROM cuenta_cosas WHERE jornada_id = ? ORDER BY id',
      [jornadaId],
    );

    // 7. Agrupar detalles por venta
    const ventasConDetalles = ventas.map((v) => ({
      ...v,
      detalles: detalles.filter((d) => d.venta_id === v.id),
    }));

    return {
      ventas: ventasConDetalles,
      movimientos,
      stockMovimientos,
      ventaLotes,
      productosMap,
      totalCosto,
      userCierreNombre,
      cuentaCosas,
    };
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

  /**
   * Retorna las jornadas cerradas de un mes específico.
   * @param year año (ej. 2026)
   * @param month mes 0-indexed (0 = enero)
   */
  jornadasDelMes(year: number, month: number): Observable<Jornada[]> {
    const desde = new Date(year, month, 1).toISOString().split('T')[0];
    const hasta = new Date(year, month + 1, 0).toISOString().split('T')[0];

    return from(
      this._db.sql<Jornada>(
        'SELECT * FROM jornadas WHERE fecha BETWEEN ? AND ? AND estado = ? ORDER BY fecha',
        [desde, hasta, 'cerrada'],
      ),
    );
  }

  /**
   * Retorna las jornadas cerradas en un rango de fechas.
   * @param desde fecha ISO (YYYY-MM-DD)
   * @param hasta fecha ISO (YYYY-MM-DD)
   */
  jornadasDelRango(desde: string, hasta: string): Observable<Jornada[]> {
    return from(
      this._db.sql<Jornada>(
        'SELECT * FROM jornadas WHERE fecha BETWEEN ? AND ? AND estado = ? ORDER BY fecha',
        [desde, hasta, 'cerrada'],
      ),
    );
  }

  /**
   * Genera la exportación por rango de fechas.
   * Recolecta datos de cada jornada y genera Excel multi-hoja.
   * @returns Observable que emite el base64 del Excel
   */
  generarExportacionPorRango(desde: string, hasta: string): Observable<string> {
    return this.jornadasDelRango(desde, hasta).pipe(
      switchMap((jornadas) => {
        if (jornadas.length === 0) {
          throw new Error('No hay jornadas en el rango seleccionado.');
        }
        const dataPromises = jornadas.map((j) =>
          this._recolectarDatosJornada(j.id, j.user_cierre_id).then(
            (datos): JornadaReportData => ({
              jornada: j,
              ventas: datos.ventas,
              movimientos: datos.movimientos,
              stockMovimientos: datos.stockMovimientos,
              ventaLotes: datos.ventaLotes,
              productosMap: datos.productosMap,
              totalCosto: datos.totalCosto,
              userCierreNombre: datos.userCierreNombre,
              cuentaCosas: datos.cuentaCosas,
            }),
          ),
        );
        return from(Promise.all(dataPromises));
      }),
      map((allData) => this._excelService.generarExcelMensual(allData)),
    );
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
