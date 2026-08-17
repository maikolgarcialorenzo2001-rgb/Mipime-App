import { Component, input, output, model, HostListener, viewChild, ElementRef, afterNextRender, signal } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Producto } from '../../models';

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

    // Bloquear si no es un dígito (0-9) ni una tecla numérica
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
