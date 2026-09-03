import { Component, computed, input } from '@angular/core';
import { UNIDAD_MEDIDA, type UnidadMedida } from '../../models/producto';

@Component({
  selector: 'app-stock-badge',
  templateUrl: './stock-badge.component.html',
  styleUrl: './stock-badge.component.css',
})
export class StockBadgeComponent {
  readonly stock = input.required<number>();
  readonly unidadMedida = input<UnidadMedida>('unidad');

  protected readonly suffix = computed(
    () => UNIDAD_MEDIDA[this.unidadMedida()].suffix,
  );

  protected readonly stockLevel = computed(() => {
    const s = this.stock();
    if (s > 10) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
    if (s >= 1) return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  });
}
