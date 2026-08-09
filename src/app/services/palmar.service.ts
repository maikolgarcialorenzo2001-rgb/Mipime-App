// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- el renderer (tsconfig.app.json) no incluye electron/, y los tipos IPC Palmar son globales de electron/types.d.ts (fuente única, patrón de electron-file.service.ts).
/// <reference path="../../../electron/types.d.ts" />
import { Injectable, inject } from '@angular/core';
import { ElectronFileService } from './electron-file.service';
import { ExcelService } from './excel.service';
import type {
  PalmarHistoryEntry,
  PalmarRecord,
  PalmarSemanaResumen,
} from '../models/palmar-jornada';

/**
 * Extrae la fecha yyyy-mm-dd de un fileName `{dd-mm-yyyy}[{-n}].json`
 * (la regla de nombres de archivo Palmar es PR3; el sufijo -2/-3 no altera
 * la fecha de la jornada). Devuelve null si el nombre no coincide.
 */
function fechaDesdeFileName(fileName: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})(?:-\d+)?\.json$/.exec(fileName);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Convierte una fecha yyyy-mm-dd al baseName dd-mm-yyyy que exige el contrato IPC (PR3). */
function baseNameDesdeFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}-${m}-${y}`;
}

/** Lunes y domingo (yyyy-mm-dd) de la semana que contiene `fecha` (yyyy-mm-dd). */
function semanaDe(fecha: string): { inicio: string; fin: string } {
  // Mediodía local evita el salto de zona horaria al parsear 'yyyy-mm-dd'
  // (mismo patrón que ElectronFileService.saveIndividual).
  const d = new Date(`${fecha}T12:00:00`);
  const diasDesdeLunes = (d.getDay() + 6) % 7; // domingo(0) → 6, lunes(1) → 0
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - diasDesdeLunes);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { inicio: toIso(lunes), fin: toIso(domingo) };
}

/**
 * Servicio de la tienda externa "Palmar" (PR6, Pana B).
 * Vive SOLO del filesystem via IPC (ElectronFileService, PR4) + ExcelService
 * (PR2): CERO escrituras a la base de datos y, salvo que un día se necesite
 * listar productos para construir un registro, tampoco lecturas.
 */
@Injectable({ providedIn: 'root' })
export class PalmarService {
  private readonly _electronFile = inject(ElectronFileService);
  private readonly _excelService = inject(ExcelService);

  /**
   * Historial de jornadas Palmar. `listPalmar` ya viene ordenado por
   * createdAt descendente (lo ordena main, PR3) — se pasa tal cual.
   */
  cargarHistorial(): Promise<PalmarHistoryEntry[]> {
    return this._electronFile.listPalmar();
  }

  /** Lee el detalle completo de una jornada; rechaza si el IPC no la devuelve. */
  async verDetalle(fileName: string): Promise<PalmarRecord> {
    const result = await this._electronFile.readPalmar(fileName);
    if (!result.ok || !result.record) {
      throw new Error(result.error ?? `No se pudo leer la jornada Palmar: ${fileName}`);
    }
    return result.record;
  }

  /**
   * Volver a imprimir: relee el registro, recalcula el resumen semanal fresco
   * de la semana de su fecha, regenera el Excel y lo guarda como archivo
   * NUEVO (baseName dd-mm-yyyy; main agrega el sufijo -2/-3 si ya existe —
   * nunca sobrescribe). El reprint NO incluye el json: solo el xlsx.
   */
  async volverAImprimir(fileName: string): Promise<PalmarSaveResult> {
    const record = await this.verDetalle(fileName);
    const resumenSemanal = await this.cargarResumenSemanal(record.fecha);
    const base64 = this._excelService.generarExcelPalmar(record, resumenSemanal);
    return this._electronFile.savePalmar(baseNameDesdeFecha(record.fecha), base64);
  }

  /**
   * Resumen semanal (lunes a domingo de la semana de `fecha`): agrega TODOS
   * los registros del historial cuya jornada cae en esa semana. La fecha de
   * cada jornada se deriva del fileName (regla de nombres PR3); los registros
   * de la semana se leen del filesystem via IPC para sumar los totales.
   */
  async cargarResumenSemanal(fecha: string): Promise<PalmarSemanaResumen> {
    const semana = semanaDe(fecha);
    const historial = await this.cargarHistorial();
    const enSemana = historial.filter((entry) => {
      const fechaEntry = fechaDesdeFileName(entry.fileName);
      return fechaEntry !== null && fechaEntry >= semana.inicio && fechaEntry <= semana.fin;
    });

    let totalRecibido = 0;
    let efectivo = 0;
    let divisaCup = 0;
    let transferencia = 0;
    let invertido = 0;
    let ganancia = 0;

    for (const entry of enSemana) {
      const record = await this.verDetalle(entry.fileName);
      totalRecibido += record.total_recibido;
      efectivo += record.total_arqueo; // efectivo = total del arqueo de la jornada
      divisaCup += record.divisa.divisa_cup;
      transferencia += record.transferencia;
      invertido += record.invertido;
      ganancia += record.ganancia;
    }

    return {
      semanaInicio: semana.inicio,
      semanaFin: semana.fin,
      totalRecibido,
      efectivo,
      divisaCup,
      transferencia,
      invertido,
      ganancia,
    };
  }
}
