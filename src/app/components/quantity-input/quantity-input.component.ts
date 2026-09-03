import { Component, input, output, model, HostListener, viewChild, ElementRef, afterNextRender, signal, computed } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';
import { UNIDAD_MEDIDA } from '../../models/producto';

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

  /** true cuando el producto admite decimales (gramaje). */
  readonly permiteDecimal = computed(
    () => UNIDAD_MEDIDA[this.producto().unidad_medida].allowsDecimal,
  );

  /** sufijo de la etiqueta de precio ("c/u" | "por lb"). */
  readonly sufijo = computed(() => UNIDAD_MEDIDA[this.producto().unidad_medida].suffix);

  constructor() {
    afterNextRender(() => {
      setTimeout(() => {
        this.qtyInput()?.nativeElement.focus();
        this.qtyInput()?.nativeElement.select();
      });
    });
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
      if (qty > 0) {
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
        const current = String(this.cantidad());
        const decimalIndex = current.indexOf('.');
        if (decimalIndex !== -1 && current.length - decimalIndex - 1 >= 2) {
          event.preventDefault();
          this.soloNumeros.set(true);
          setTimeout(() => this.soloNumeros.set(false), 1800);
        }
        return;
      }
      if (event.key === '.') {
        const current = String(this.cantidad());
        if (current.includes('.')) {
          event.preventDefault();
        }
        return;
      }
      event.preventDefault();
      this.soloNumeros.set(true);
      setTimeout(() => this.soloNumeros.set(false), 1800);
      return;
    }

    // Unidad: solo dígitos, filtra el punto decimal
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      this.soloNumeros.set(true);
      setTimeout(() => this.soloNumeros.set(false), 1800);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).dataset['backdrop'] === '') {
      this.cancelar.emit();
    }
  }
}
