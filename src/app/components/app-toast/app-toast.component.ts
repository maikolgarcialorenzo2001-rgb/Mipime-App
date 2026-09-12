import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

/**
 * Renderiza la pila de toasts del ToastService (R8), montado UNA vez en el
 * shell. El contenedor es aria-live="polite" para que los lectores de
 * pantalla anuncien cada toast sin robar foco; cada item es descartable.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div
      aria-live="polite"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex w-full max-w-md flex-col items-center gap-2 px-4 pointer-events-none"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          role="status"
          class="pointer-events-auto flex w-full items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-lg animate-fade-in"
          [class.bg-green-500]="toast.tipo === 'success'"
          [class.bg-red-500]="toast.tipo === 'error'"
          [class.bg-blue-500]="toast.tipo === 'info'"
        >
          <span class="material-symbols-outlined text-base">
            {{ toast.tipo === 'success' ? 'check_circle' : toast.tipo === 'error' ? 'error' : 'info' }}
          </span>
          <span class="flex-1">{{ toast.mensaje }}</span>
          <button
            type="button"
            class="cursor-pointer opacity-80 hover:opacity-100"
            (click)="toastService.dismiss(toast.id)"
            [attr.aria-label]="'Cerrar notificación: ' + toast.mensaje"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class AppToastComponent {
  protected readonly toastService = inject(ToastService);
}