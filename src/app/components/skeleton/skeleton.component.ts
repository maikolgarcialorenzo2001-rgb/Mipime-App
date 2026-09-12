import { Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'table' | 'grid' | 'calendar';

/**
 * Skeleton de carga (R9): reemplaza el spinner en cargas iniciales de listas.
 * La condición de uso en cada página es "cargando Y lista vacía" — en los
 * refrescos con datos montados la tabla/grid queda en pantalla (sin flash).
 * Variants: table (filas × columnas), grid (tarjetas), calendar (mes 7 cols).
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @switch (variant()) {
      @case ('table') {
        <div role="status" [attr.aria-label]="label()" class="animate-pulse">
          <div class="space-y-3">
            @for (fila of filas(); track fila) {
              <div class="flex gap-3">
                @for (col of columnas(); track col) {
                  <div
                    class="h-4 rounded bg-gray-200 dark:bg-gray-700"
                    [class]="anchoColumna(col)"
                  ></div>
                }
              </div>
            }
          </div>
        </div>
      }
      @case ('grid') {
        <div
          role="status"
          [attr.aria-label]="label()"
          class="animate-pulse grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        >
          @for (tarjeta of filas(); track tarjeta) {
            <div class="rounded-xl bg-gray-200 dark:bg-gray-700 p-3 sm:p-4">
              <div class="mb-3 h-20 sm:h-24 rounded-lg bg-gray-300 dark:bg-gray-600"></div>
              <div class="mb-2 h-3 w-3/4 rounded bg-gray-300 dark:bg-gray-600"></div>
              <div class="h-3 w-1/2 rounded bg-gray-300 dark:bg-gray-600"></div>
            </div>
          }
        </div>
      }
      @case ('calendar') {
        <div role="status" [attr.aria-label]="label()" class="animate-pulse">
          <div class="mb-4 flex items-center justify-between">
            <div class="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <div class="grid grid-cols-7 gap-1">
            @for (dia of celdasCalendario(); track dia) {
              <div class="h-10 rounded bg-gray-200 dark:bg-gray-700"></div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('table');
  readonly rows = input(5);
  readonly cols = input(4);

  private readonly _label = 'Cargando…';

  protected readonly label = computed(() => this._label);
  protected readonly filas = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly columnas = computed(() => Array.from({ length: this.cols() }, (_, i) => i));
  protected readonly celdasCalendario = computed(() =>
    Array.from({ length: this.rows() * 7 }, (_, i) => i),
  );

  /** Anchos de columna para que la tabla esqueleto no parezca monótona. */
  protected anchoColumna(col: number): string {
    const anchos = ['w-1/4', 'w-10/12', 'w-2/3', 'w-1/3', 'w-8/12'];
    return anchos[col % anchos.length];
  }
}