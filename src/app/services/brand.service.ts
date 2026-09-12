import { Injectable, effect, inject, signal } from '@angular/core';
import { SetupService } from './setup.service';
import { APP_VERSION } from '../version';

/**
 * Marca del comercio (R6): nombre del negocio desde la tabla config.
 *
 * `cargar()` es idempotente: aunque el nav y el login lo llamen, la config
 * se lee una sola vez. El título de la pestaña se mantiene en sync vía effect
 * (runtime-only — el <title> estático de index.html lo regenera sync-version.mjs
 * y no se toca).
 */
@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly _setup = inject(SetupService);

  readonly nombreComercio = signal<string | null>(null);

  private _cargado = false;

  constructor() {
    effect(() => {
      document.title = `${this.nombreComercio() ?? 'Mipime POS'} ${APP_VERSION}`;
    });
  }

  async cargar(): Promise<void> {
    if (this._cargado) return;
    this._cargado = true;
    try {
      const nombre = await this._setup.getConfig('nombre_comercio');
      this.nombreComercio.set(nombre);
    } catch {
      // Config inaccesible → fallback 'Mipime POS'. Nunca romper el shell.
    }
  }
}