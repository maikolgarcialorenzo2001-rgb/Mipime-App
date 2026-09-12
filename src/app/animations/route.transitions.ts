import { animate, style, transition, trigger } from '@angular/animations';

/**
 * Transición de rutas (R7): fade + slide vertical de 8px al ENTRAR.
 *
 * A propósito SOLO `:enter`: sin `:leave` el outlet no se posiciona absolute,
 * así el POS conserva su full-bleed (sin scroll horizontal ni salto de layout).
 * El timing (180ms) vive en el límite bajo de la ventana 0.15–0.2s de R7; bajo
 * prefers-reduced-motion el boot elige provideNoopAnimations() en app.config,
 * así esta transición se omite por completo.
 *
 * Se registra vía `animations: [routeAnimations]` en el decorator del App
 * (campo clásico, aún soportado en v21): en este Angular el campo `imports`
 * de un componente standalone tipa sus ítems como `Type<any> | ReadonlyArray<any>`
 * y el metadata de un trigger no es asignable.
 */
export const routeAnimations = trigger('routeAnimations', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);