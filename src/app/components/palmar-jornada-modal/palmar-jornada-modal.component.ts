import { Component, computed, inject, output, signal, InjectionToken } from '@angular/core';
import { ArqueoBilletesFormComponent } from '../arqueo-billetes-form/arqueo-billetes-form.component';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';
import type { Producto } from '../../models';

/** Producto del catálogo con cantidad editable en la fase 1 (P-FR4). */
export interface PalmarProductoEntrada {
  id: number;
  nombre: string;
  cantidad: number;
  precio_venta: number;
  precio_costo: number | null;
}

/** Fases del modal (P-FR5): 1 productos, 2 arqueo, 3 confirmación. */
export type FasePalmar = 1 | 2 | 3;

/** Payload mínimo que consume PalmarService.registrarJornada (contrato PR6). */
export interface PalmarJornadaPayload {
  fecha: string;
  productos: PalmarProductoEntrada[];
  arqueo: ArqueoCajaEntry[];
  divisa: { usd: number; eur: number; tasa_usd: number; tasa_eur: number };
  transferencia: number;
}

/**
 * Contrato congelado PR6 (plan §Contratos): PalmarService. El modal consume
 * la firma, nunca el cuerpo — PR8 lo conecta vía `useExisting: PalmarService`.
 */
export interface PalmarJornadaService {
  listarProductos(): Promise<Producto[]>;
  registrarJornada(payload: PalmarJornadaPayload): Promise<unknown>;
}

export const PALMAR_JORNADA_SERVICE = new InjectionToken<PalmarJornadaService>(
  'PalmarJornadaService',
);

/**
 * Modal de registro de jornada de la tienda externa Palmar (P-FR4..P-FR8):
 * state machine de 3 fases, autónomo, consume el contrato congelado de
 * PalmarService y emite `saved` al guardar.
 */
@Component({
  selector: 'app-palmar-jornada-modal',
  standalone: true,
  imports: [ArqueoBilletesFormComponent],
  templateUrl: './palmar-jornada-modal.component.html',
  styleUrl: './palmar-jornada-modal.component.css',
})
export class PalmarJornadaModalComponent {
  private readonly _palmar = inject(PALMAR_JORNADA_SERVICE);

  readonly phase = signal<FasePalmar>(1);

  /** Catálogo fresco con cantidad 0 pre-rellenada (P-FR4). */
  readonly productos = signal<PalmarProductoEntrada[]>([]);
  readonly cargandoProductos = signal(true);

  /** Entries emitidos por <app-arqueo-billetes-form> (solo cantidad > 0). */
  readonly arqueoEntries = signal<ArqueoCajaEntry[]>([]);

  readonly arqueoTotal = computed(() =>
    this.arqueoEntries().reduce((sum, e) => sum + e.subtotal, 0),
  );

  readonly soloNumeros = signal(false);

  readonly cerrar = output();

  constructor() {
    void this._cargarProductos();
  }

  /** P-FR4: única lectura SQL — contrato PR6 listarProductos() fresco al abrir. */
  private async _cargarProductos(): Promise<void> {
    try {
      const lista = await this._palmar.listarProductos();
      this.productos.set(
        lista.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          cantidad: 0,
          precio_venta: p.precio_venta,
          precio_costo: p.precio_costo,
        })),
      );
    } catch {
      // Sin catálogo no hay nada que registrar: fase 1 queda vacía.
    } finally {
      this.cargandoProductos.set(false);
    }
  }

  /** Fase 1: actualiza la cantidad de un producto (enteros no negativos). */
  actualizarCantidad(productoId: number, cantidad: number): void {
    const valor = Number.isNaN(cantidad) || cantidad < 0 ? 0 : cantidad;
    this.productos.update((lista) =>
      lista.map((p) => (p.id === productoId ? { ...p, cantidad: valor } : p)),
    );
  }

  /** Filtro numérico: solo enteros no negativos (patrón filtrarTecla de app-nav). */
  filtrarTecla(event: KeyboardEvent): void {
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
      'Enter', 'Escape',
    ];
    if (teclasPermitidas.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      this.soloNumeros.set(true);
      setTimeout(() => this.soloNumeros.set(false), 1800);
    }
  }

  /** P-FR6: recibe los entries del arqueo compartido embebido. */
  onArqueoChange(entries: ArqueoCajaEntry[]): void {
    this.arqueoEntries.set(entries);
  }

  siguiente(): void {
    if (this.phase() < 2) {
      this.phase.update((p) => (p + 1) as FasePalmar);
    }
  }

  atras(): void {
    if (this.phase() > 1) {
      this.phase.update((p) => (p - 1) as FasePalmar);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrar.emit();
    }
  }
}
