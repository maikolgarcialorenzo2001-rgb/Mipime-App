# SDD — Design: `pendiente-detalles-opcionales`

> Artefacto de diseño (2026-08-08). Guardado también en Engram (`sdd/pendiente-detalles-opcionales/design` #520).

## Propósito Técnico

Cambio display-only: exponer `autorizado_por` y `descripcion` (columnas ya existentes, schema v6) desde `listarPendientes()` hasta la UI del modal. Se amplía el SELECT existente y se agrega un toggle expand/collapse por fila. Sin migración ni cambios de backend; el flujo de cobro queda intacto.

## Decisiones de Arquitectura

| # | Decisión | Opciones | Tradeoff | Elección |
|---|---|---|---|---|
| D1 | Estado expand/collapse | `signal<Set<number>>` vs `signal<Map<number,X>>` | `Map` agrega un valor por id que no se necesita: más superficie de estado sin beneficio | `Set<number>` — `has()`/`delete()` O(1), template `detallesAbiertos().has(p.id)`; mutación inmutable (`new Set(...)`) para notificar el cambio |
| D2 | Reset de expansiones | `effect` sobre `cobroPendiente()` vs reset manual por acción | El POS reemplaza la referencia del array al recargar; sin reset el estado queda stale | `effect(() => { this.cobroPendiente(); this.detallesAbiertos.set(new Set()); })` — cubre recarga; el cierre del modal destruye el componente (path "close" cubierto por destroy) |
| D3 | Click del botón vs fila | `$event.stopPropagation()` en botón vs reestructurar handler del `<li>` | En modo cobrar el `<li>` selecciona; sin `stopPropagation` abrir detalles cambiaría la selección | Botón con `$event.stopPropagation()`; selección y detalle quedan independientes |
| D4 | Filas sin detalles | Ocultar botón+bloque vs placeholder "—" | La spec exige ocultar | Helper `tieneDetalle(p)` → `@if` omite el botón; el bloque lleva `@if` defensivo adicional. Con ambos null: botón y bloque no existen |
| D5 | Ubicación del botón | Wrapper derecho (total + botón) vs botón al pie | Mantener el total alineado a la derecha y el nombre truncando | Wrapper `flex shrink-0 items-center gap-2` derecha: total + botón "Ver detalles" estilo secundario existente (border/gris, hover), chevron `▸/▾` y `aria-expanded` |

## Flujo de Datos

```
ventas.autorizado_por / ventas.descripcion
  → listarPendientes() SELECT +2 columnas (WHERE intacto)
  → PendienteItem.autorizadoPor / descripcion (null-safe)
  → modal: input cobroPendiente → botón toggle → Set<number> → bloque read-only @if
```

## Cambios de Archivo

| Archivo | Acción | Descripción |
|---|---|---|
| `src/app/services/cobro-pendiente.service.ts` | Modificar | `PendienteItem` +`autorizadoPor?`/`descripcion?`; SELECT agrega `autorizado_por, descripcion`; row type +2 campos; mapping `?? null` (patrón `compradorNombre`); `WHERE forma_pago = 'pendiente' AND pagado_en IS NULL` literal intacto |
| `src/app/services/cobro-pendiente.service.spec.ts` | Modificar | Fixtures de fila +2 columnas; asserts de mapping y de columnas en la query |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.ts` | Modificar | `detallesAbiertos = signal<Set<number>>(new Set())`; `toggleDetalle(id)`; `tieneDetalle(p)`; effect de reset (D2) |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.html` | Modificar | Wrapper derecho en el `<li>` + botón (D3/D5) + bloque read-only expandible |
| `src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.spec.ts` | Modificar | Tests de toggle, labels, modos y reset |

## Contratos / Código Clave

```ts
// PendienteItem (service.ts:9-15)
autorizadoPor?: string | null;  // ← ventas.autorizado_por
descripcion?: string | null;    // ← ventas.descripcion

// SELECT (service ts:50-70) — solo agrega columnas:
// SELECT id, comprador_nombre, fecha_hora, total, jornada_id,
//        autorizado_por, descripcion
// FROM ventas WHERE forma_pago = 'pendiente' AND pagado_en IS NULL
// ORDER BY fecha_hora DESC   ← el WHERE NO se toca (REQ-6)

// Componente:
readonly detallesAbiertos = signal<Set<number>>(new Set());
toggleDetalle(id: number): void {
  const s = this.detallesAbiertos();
  this.detallesAbiertos.set(s.has(id) ? (s.delete(id), new Set(s)) : new Set(s).add(id));
}
tieneDetalle(p: PendienteItem): boolean {
  return !!(p.autorizadoPor ?? p.descripcion);  // ver WARNING 1 del verify: ?? → || (fix aplicado en apply)
}
```

```html
<!-- fila (html:31-54): wrapper derecho + botón -->
<div class="flex shrink-0 items-center gap-2">
  <span class="font-semibold ...">{{ p.total | currency }}</span>
  @if (tieneDetalle(p)) {
    <button type="button" class="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      [attr.aria-expanded]="detallesAbiertos().has(p.id)"
      (click)="toggleDetalle(p.id); $event.stopPropagation()">
      <span>{{ detallesAbiertos().has(p.id) ? 'Ocultar' : 'Ver' }}</span> detalles
    </button>
  }
</div>

<!-- bloque read-only (dentro del li, bajo la fila flex) -->
@if (detallesAbiertos().has(p.id) && tieneDetalle(p)) {
  <div class="mt-2 space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs">
    @if (p.autorizadoPor) {
      <p><span class="text-gray-500 dark:text-gray-400">Autorizado por:</span>
         <span class="font-medium text-gray-900 dark:text-gray-100">{{ p.autorizadoPor }}</span></p>
    }
    @if (p.descripcion) {
      <p><span class="text-gray-500 dark:text-gray-400">Descripción:</span>
         <span class="font-medium text-gray-900 dark:text-gray-100">{{ p.descripcion }}</span></p>
    }
  </div>
}
```

Plantilla `li` a colapso con flex-col para acomodar el bloque (decisión tomada en apply — ver desviaciones).

## Estrategia de Pruebas (RED, Vitest `ng test`, specs en español, mock `DATABASE`)

| Capa | Qué | Enfoque |
|---|---|---|
| Service | SELECT incluye `autorizado_por`/`descripcion` | `String(query)` `toContain` cada columna (patrón líneas 66-72); mapping del item |
| Service | Valores null → `autorizadoPor: null`/`descripcion: null` | fixture fila con nulls; assert `toBeNull` (patrón test compradorNombre null) |
| Service | WHERE intacto | asserts existentes (líneas 68-69, 84-85) se mantienen verdes |
| Componente | Toggle expand/collapse | item con `autorizadoPor` + `descripcion` → click "Ver detalles" → detectChanges → texto renderizado; segundo click → oculto |
| Componente | Labels por rol | solo `autorizadoPor` → "Descripción" ausente; solo `descripcion` → "Autorizado por" ausente |
| Componente | Ambos sin detalles | `tieneDetalle(p)` false; sin botón ni bloque en el DOM |
| Componente | Ambos modos | `soloLectura: true` opera toggle; en modo cobrar el click del botón NO cambia `seleccionada()` (D3) |
| Componente | Reset | expandido → `setInput('cobroPendiente', nuevaRef)` → `detallesAbiertos()` vacío |

## Migración / Rollback

Sin migración (columnas ya existen, schema v6). Rollback: revert del commit — display-only, sin tocar el flujo de cobro.

## Preguntas Abiertas (RESUELTAS)

1. **Referencia del array en cada recarga (D2)** — verificado en apply: `_cargarPendientes()` hace `this.pendientes.set(pendientes)` con array NUEVO (pos.page.ts:186); la referencia se reemplaza, el effect de reset es correcto, y el modal se destruye al cerrar (`@if` en pos.page.html:174). Sin cambios en pos.page.ts.
2. **Layout del `li` con bloque expandible** — resuelto en apply (desviación 2): `li` en flex-col con fila interna clickeable + bloque debajo.
