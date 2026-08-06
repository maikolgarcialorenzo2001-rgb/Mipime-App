import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import type { Venta } from '../models';

/**
 * DTO de un pendiente sin cobrar para la lista del POS y el Excel acumulado.
 * `compradorNombre` puede ser null: la UI muestra el fallback `Pendiente #id`.
 */
export interface PendienteItem {
  id: number;
  compradorNombre?: string | null;
  fechaHora: string;
  total: number;
  jornadaId: number;
}

/**
 * Opciones de pago para registrar el cobro de un pendiente.
 * Solo Efectivo, Transferencia y Divisas (Cuenta Casas y Pendiente se
 * deshabilitan en la UI).
 */
export interface CobroOpciones {
  jornadaId: number;
  usuarioId: number;
  formaPago: 'efectivo' | 'transferencia' | 'divisas';
  divisaTipo?: 'EUR' | 'USD';
  billeteRecibido?: number;
  tasaCambio?: number;
  completacionEfectivo?: number;
}

/**
 * Servicio dedicado al cobro de pendientes (decision AD-1). Depende solo de
 * `DATABASE`. Modelo de dos operaciones: el pendiente original mantiene su
 * dinero intacto (solo marcadores `pagado_en` + `cobro_de_venta_id`); el cobro
 * es una venta cash NUEVA sin detalles/stock/lotes/costo. La matemática de
 * netCash espeja `VentaService._ejecutar`.
 */
@Injectable({
  providedIn: 'root',
})
export class CobroPendienteService {
  private readonly _db = inject(DATABASE);

  /**
   * Lista TODOS los pendientes sin cobrar de TODAS las jornadas
   * (incluye el mismo día). Query global, sin filtro de jornada — reusada
   * por FR-9 (Excel acumulado).
   */
  async listarPendientes(): Promise<PendienteItem[]> {
    const rows = await this._db.sql<{
      id: number;
      comprador_nombre: string | null;
      fecha_hora: string;
      total: number;
      jornada_id: number;
    }>(
      `SELECT id, comprador_nombre, fecha_hora, total, jornada_id
       FROM ventas
       WHERE forma_pago = 'pendiente' AND pagado_en IS NULL
       ORDER BY fecha_hora DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      compradorNombre: r.comprador_nombre ?? null,
      fechaHora: r.fecha_hora,
      total: r.total,
      jornadaId: r.jornada_id,
    }));
  }

  /**
   * Cobra un pendiente en una transacción. Secuencia (AD-4):
   * BEGIN → guard pagado_en IS NULL (anti doble-cobro) → netCash → guard de
   * saldo divisa → INSERT venta cobro (solo money, RETURNING) → UPDATE del
   * original (marcadores) → UPDATE jornada. COMMIT; catch → ROLLBACK.
   */
  async registrarCobroPendiente(
    pendienteId: number,
    opciones: CobroOpciones,
  ): Promise<Venta> {
    const ahora = new Date().toISOString();

    await this._db.sql('BEGIN TRANSACTION');

    try {
      // Guard anti-doble-cobro DENTRO de la transacción (AC5).
      const pendientes = await this._db.sql<Venta>(
        'SELECT * FROM ventas WHERE id = ? AND pagado_en IS NULL',
        [pendienteId],
      );
      const pendiente = pendientes[0];
      if (!pendiente) {
        throw new Error('Pendiente ya cobrado');
      }
      const total = pendiente.total;

      // netCash espeja VentaService._ejecutar (ts:190-206).
      let netCash = 0;
      if (opciones.formaPago === 'efectivo') {
        netCash = total;
      } else if (opciones.formaPago === 'divisas') {
        const vuelto = Math.max(
          0,
          (opciones.billeteRecibido ?? 0) * (opciones.tasaCambio ?? 0) - total,
        );
        // Guard de caja para el vuelto divisa (espeja ts:91-104).
        if (vuelto > 0) {
          const jornadas = await this._db.sql<{ saldo_esperado: number }>(
            'SELECT saldo_esperado FROM jornadas WHERE id = ?',
            [opciones.jornadaId],
          );
          const saldoActual = jornadas[0]?.saldo_esperado ?? 0;
          if (saldoActual < vuelto) {
            throw new Error(
              `Saldo insuficiente en caja para vuelto: $${saldoActual} < $${vuelto}`,
            );
          }
        }
        netCash = (opciones.completacionEfectivo ?? 0) - vuelto;
      }
      // transferencia: netCash 0 (el total igual cuenta en total_ventas).

      // INSERT del cobro como venta solo-money: SIN detalle_ventas, SIN stock,
      // SIN venta_lotes, SIN costo.
      const columnasBase = [
        'jornada_id',
        'fecha_hora',
        'total',
        'created_at',
        'usuario_id',
        'forma_pago',
        'cobro_de_venta_id',
      ];
      const valoresBase: unknown[] = [
        opciones.jornadaId,
        ahora,
        total,
        ahora,
        opciones.usuarioId,
        opciones.formaPago,
        pendienteId,
      ];

      const columnasExtra: string[] = [];
      const valoresExtra: unknown[] = [];
      if (opciones.formaPago === 'divisas') {
        if (opciones.divisaTipo != null) {
          columnasExtra.push('divisa_tipo');
          valoresExtra.push(opciones.divisaTipo);
        }
        if (opciones.billeteRecibido != null) {
          columnasExtra.push('monto_divisa');
          valoresExtra.push(opciones.billeteRecibido);
        }
        if (opciones.tasaCambio != null) {
          columnasExtra.push('tasa_cambio');
          valoresExtra.push(opciones.tasaCambio);
        }
        if (opciones.completacionEfectivo != null) {
          columnasExtra.push('completacion_efectivo');
          valoresExtra.push(opciones.completacionEfectivo);
        }
      }

      const todasColumnas = [...columnasBase, ...columnasExtra].join(', ');
      const todosPlaceholders = columnasBase
        .map(() => '?')
        .concat(columnasExtra.map(() => '?'))
        .join(', ');
      const todosValores = [...valoresBase, ...valoresExtra];

      const cobros = await this._db.sql<Venta>(
        `INSERT INTO ventas (${todasColumnas})
         VALUES (${todosPlaceholders})
         RETURNING *`,
        todosValores,
      );
      const cobro = cobros[0];

      // Marcadores en el original: NUNCA se muta su dinero.
      await this._db.sql(
        'UPDATE ventas SET pagado_en = ?, cobro_de_venta_id = ? WHERE id = ?',
        [ahora, cobro.id, pendienteId],
      );

      // Jornada: total_ventas += total, saldo_esperado += netCash.
      await this._db.sql(
        `UPDATE jornadas
         SET total_ventas = total_ventas + ?,
             saldo_esperado = saldo_esperado + ?,
             updated_at = ?
         WHERE id = ?`,
        [total, netCash, ahora, opciones.jornadaId],
      );

      await this._db.sql('COMMIT');
      return cobro;
    } catch (error) {
      await this._db.sql('ROLLBACK');
      throw error;
    }
  }
}