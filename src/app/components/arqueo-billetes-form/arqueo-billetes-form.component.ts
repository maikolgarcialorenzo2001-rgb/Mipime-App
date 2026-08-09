import { Component, computed, output, signal } from '@angular/core';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';

/**
 * Formulario compartido de conteo de billetes / monedas.
 * Emite por arqueoChange los entries con cantidad > 0.
 */
@Component({
  selector: 'app-arqueo-billetes-form',
  standalone: true,
  templateUrl: './arqueo-billetes-form.component.html',
  styleUrl: './arqueo-billetes-form.component.css',
})
export class ArqueoBilletesFormComponent {
  /** Denominaciones soportadas, de mayor a menor. */
  readonly DENOMINACIONES = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1] as const;

  readonly arqueoForm = signal<Record<number, number>>({
    5000: 0, 2000: 0, 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 3: 0, 1: 0,
  });

  readonly showOptionalDenoms = signal(false);

  readonly soloNumeros = signal(false);

  readonly denominacionesVisibles = computed(() =>
    this.showOptionalDenoms()
      ? [...this.DENOMINACIONES]
      : this.DENOMINACIONES.filter(d => d !== 1 && d !== 3),
  );

  readonly arqueoTotal = computed(() => {
    const f = this.arqueoForm();
    return this.denominacionesVisibles().reduce((sum, d) => sum + d * (f[d] ?? 0), 0);
  });

  /** Emite los entries con cantidad > 0 cada vez que cambia el formulario. */
  readonly arqueoChange = output<ArqueoCajaEntry[]>();

  actualizarCantidad(denominacion: number, cantidad: number): void {
    this.arqueoForm.update(f => ({ ...f, [denominacion]: cantidad }));
    this._emitArqueo();
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

  private _emitArqueo(): void {
    const entries: ArqueoCajaEntry[] = [];
    for (const d of this.denominacionesVisibles()) {
      const cantidad = this.arqueoForm()[d] ?? 0;
      if (cantidad > 0) {
        entries.push({ denominacion: d, cantidad, subtotal: d * cantidad });
      }
    }
    this.arqueoChange.emit(entries);
  }
}
