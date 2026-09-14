import { Component, input, output, model, HostListener, viewChild, ElementRef, afterNextRender, signal, computed, effect } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';
import { unidadMedidaInfo } from '../../models/producto';

@Component({
  selector: 'app-quantity-input',
  imports: [PesosPipe],
  templateUrl: './quantity-input.component.html',
})
export class QuantityInputComponent {
  readonly producto = input.required<Producto>();
  readonly cantidad = model(1);
  readonly confirmar = output<number>();
  readonly cancelar = output<void>();
  readonly qtyInput = viewChild<ElementRef<HTMLInputElement>>('qtyInput');
  readonly soloNumeros = signal(false);
  readonly maxDecimales = signal(false);
  readonly rawText = signal('');

  /** true cuando el producto admite decimales (gramaje). */
  readonly permiteDecimal = computed(
    () => unidadMedidaInfo(this.producto().unidad_medida).allowsDecimal,
  );

  /** sufijo de la etiqueta de precio ("c/u" | "por lb"). */
  readonly sufijo = computed(() =>
    unidadMedidaInfo(this.producto().unidad_medida).suffix,
  );

  /** true cuando la cantidad supera el mínimo útil según la unidad de medida (step). */
  readonly umbralHabilitado = computed(
    () =>
      this.cantidad() >=
      unidadMedidaInfo(this.producto().unidad_medida).step,
  );

  constructor() {
    this.rawText.set(String(this.cantidad()));

    effect(() => {
      // Re-sync rawText whenever the product changes.
      // The modal instance can be reused across products without being destroyed.
      this.producto();
      this.rawText.set(String(this.cantidad()));
    });

    afterNextRender(() => {
      setTimeout(() => {
        this.qtyInput()?.nativeElement.focus();
        this.qtyInput()?.nativeElement.select();
      });
    });
  }

  /** Handle (input) event: update rawText and parse to cantidad. */
  onInput(raw: string): void {
    const clamped = QuantityInputComponent.clampDecimals(raw);
    this.rawText.set(clamped);

    if (clamped === '' || clamped === '.') {
      return; // intermediate state — preserve last valid cantidad
    }

    const n = Number(clamped);
    if (Number.isFinite(n) && n >= 0) {
      this.cantidad.set(n);
    } else {
      // Non-numeric paste: show feedback, preserve last valid cantidad
      this.flashSoloNumeros();
    }
  }

  /** Muestra "Solo se permiten números" por ~1.8s (input no numérico). */
  private flashSoloNumeros(): void {
    this.soloNumeros.set(true);
    setTimeout(() => this.soloNumeros.set(false), 1800);
  }

  /** Muestra "Solo se permiten hasta 2 decimales" por ~1.8s (3er decimal). */
  private flashMaxDecimales(): void {
    this.maxDecimales.set(true);
    setTimeout(() => this.maxDecimales.set(false), 1800);
  }

  /** Clamp to 2 decimal places for paste (matches _redondear in cart). */
  private static clampDecimals(raw: string): string {
    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1) return raw;
    const intPart = raw.substring(0, dotIndex);
    const decPart = raw.substring(dotIndex + 1);
    if (decPart.length <= 2) return raw;
    return `${intPart}.${decPart.substring(0, 2)}`;
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelar.emit();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const qty = this.cantidad();
      if (this.umbralHabilitado()) {
        this.confirmar.emit(qty);
      }
      return;
    }
  }

  onInputKeydown(event: KeyboardEvent): void {
    // Permitir teclas de control siempre
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End',
      'Enter', 'Escape',
    ];

    if (teclasPermitidas.includes(event.key)) return;

    const permiteDecimal = this.permiteDecimal();

    if (permiteDecimal) {
      // Gramaje: permite dígitos y UN solo punto decimal, con máx 2 decimales
      if (/^\d$/.test(event.key)) {
        // Max 2 decimal places: block if already at 2 decimals and key is a digit
        const current = this.rawText();
        const decimalIndex = current.indexOf('.');
        if (decimalIndex !== -1 && current.length - decimalIndex - 1 >= 2) {
          event.preventDefault();
          this.flashMaxDecimales();
        }
        return;
      }
      if (event.key === '.') {
        const current = this.rawText();
        if (current.includes('.')) {
          event.preventDefault();
        }
        return;
      }
      event.preventDefault();
      this.flashSoloNumeros();
      return;
    }

    // Unidad: solo dígitos, filtra el punto decimal
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      this.flashSoloNumeros();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).dataset['backdrop'] === '') {
      this.cancelar.emit();
    }
  }
}
