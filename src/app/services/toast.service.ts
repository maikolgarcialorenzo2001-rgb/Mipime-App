import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'success' | 'error' | 'info';
  mensaje: string;
}

/**
 * Registro central de toasts (R8). Las páginas encolan mensajes aquí y
 * <app-toast /> (montado una vez en el shell) los renderiza apilados.
 * Cada toast se auto-oculta con su propia duración y puede descartarse
 * antes desde la UI (el método dismiss cancela el timer pendiente).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);

  /** Pila de toasts visibles (el último creado queda al final). */
  readonly toasts = this._toasts.asReadonly();

  private _nextId = 1;
  private readonly _timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(mensaje: string, ms = 3000): Toast {
    return this._agregar('success', mensaje, ms);
  }

  error(mensaje: string, ms = 4000): Toast {
    return this._agregar('error', mensaje, ms);
  }

  info(mensaje: string, ms = 3000): Toast {
    return this._agregar('info', mensaje, ms);
  }

  /** Quita un toast de inmediato (cancela su auto-dismiss pendiente). */
  dismiss(id: number): void {
    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private _agregar(tipo: Toast['tipo'], mensaje: string, ms: number): Toast {
    const toast: Toast = { id: this._nextId++, tipo, mensaje };
    this._toasts.update((list) => [...list, toast]);
    const timer = setTimeout(() => this.dismiss(toast.id), ms);
    this._timers.set(toast.id, timer);
    return toast;
  }
}