import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** Normaliza una URL a su primer segmento (id de página): '/pos?q=x' → 'pos', '/' → 'inicio'. */
export function pageIdDeUrl(url: string): string {
  const segmento = url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  return segmento || 'inicio';
}

/**
 * Signal con el id de la página activa. Se actualiza en cada navegación
 * y arranca con la página actual al iniciar la app (constructor siembra
 * el valor desde router.url ANTES de cualquier NavigationEnd).
 */
@Injectable({ providedIn: 'root' })
export class ActivePageService {
  private readonly _router = inject(Router);

  readonly pagina = signal<string>(pageIdDeUrl(this._router.url));

  constructor() {
    this._router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.pagina.set(pageIdDeUrl(e.urlAfterRedirects ?? e.url)));
  }
}