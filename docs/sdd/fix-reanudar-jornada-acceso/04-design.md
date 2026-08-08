# SDD — Design: `fix-reanudar-jornada-acceso`

> Artefacto de diseño (2026-08-08). Guardado también en Engram (`sdd/fix-reanudar-jornada-acceso/design`).
> Basado en: proposal (#488), decisions (#487), spec (#489). Código verificado: jornada.service.ts, login.page.{ts,html}, excel.service.ts, models/jornada.ts.

## Technical Approach

Corrección mínima de 3 puntos: (1) una única query `obtenerAbierta()` sin filtro de fecha → detecta jornada abierta previa y alimenta `jornadaAbierta` (arranque y login); (2) login simplificado: modal para CUALQUIER usuario autenticado, se elimina `autoCerrarSiOtroUsuario` y el flow de auto-cierre con toast; (3) `user_cierre_id` = usuario autenticado + trazabilidad "Abierta por/Cerrada por" en Excel (campo aditivo).

## Architecture Decisions

| # | Decisión | Opciones | Decisión | Rationale |
|---|---|---|---|---|
| D1 | Query `obtenerAbierta()` | `fecha=hoy` vs sin fecha | Sin `fecha`, `ORDER BY fecha DESC, id DESC LIMIT 1` | Detecta abierta de N días; LIMIT ordenado resuelve múltiples huérfanas con la más reciente; sin cambios de esquema |
| D2 | Firma `cerrar()` | Cambiar a `userId?` vs dejar firma | **NO cambia**: `cerrar(id: number, userId: number, arqueo?: ArqueoCajaEntry[]): Observable<Jornada>` | El bug es del CALLER (login pasa `user_apertura_id`); `cerrar` ya espera el que cierra. app-nav.ts:157 ya usa `auth.usuario()?.id` |
| D3 | `autoCerrarSiOtroUsuario()` | Mantener vs eliminar | ELIMINAR método + caller | FR-2: no hay auto-cierre por otro usuario; el modal sale para cualquiera |
| D4 | Resolución `userAperturaNombre` | JOIN única vs query extra | Query en `_ejecutarCierre` (usa `jornada.user_apertura_id` ya en manos) y en `_recolectarDatosJornada` (LEFT JOIN usuarios→jornadas 1 query) | Mismás punto donde hoy se resuelve `userCierreNombre`; `_ejecutarCierre` no reutiliza `_recolectar` (duplicación existente, no se toca) |
| D5 | Excel firma | Reescribir por estado | Help condicional | `Abierta por`+`Cerrada por` si A≠B y ambos existen; `Firmado por` en A=B y legacy NULL → back-compat total |
| D6 | Estado modal en login | Campo privado vs signal | `readonly jornadaPendiente = signal<Jornada \| null>(null)` (reemplaza `_jornadaPendiente`) | Template necesita renderizar la fecha; patrón Signals del proyecto |

## Data Flow

```
Login.onSubmit()
 ├─ auth.login(creds)
 └─ jornadaService.obtenerAbierta() ── SQL: state='abierta' ORDER BY fecha DESC,id DESC LIMIT 1
      ├─ != null → jornadaPendiente.set(j) → showReopenModal=true   (CUALQUIER usuario autenticado)
      │      ├─ "Reabrir jornada" → navigate('/pos')                (Jornada sigue open; user_apertura_id intacto)
      │      └─ "Cerrar y guardar" → cerrar(j.id, auth.usuario()?.id)   [guard si undefined]
      │             └─ _ejecutarCierre → UPDATE user_cierre_id=uid; NO toca user_apertura_id
      │                    └─ resolve userCierreNombre+userAperturaNombre → Excel
      └─ null → navigate('/pos')
constructor → refreshJornadaAbierta() → obtenerAbierta() → jornada previa → pos sinJornada=false
```

## File Changes

| Archivo | Acción | Cambio |
|---|---|---|
| `src/app/services/jornada.service.ts` | MOD | Query `obtenerAbierta()` (sin fecha); DELETE `autoCerrarSiOtroUsuario()` (201-273); resolver `userAperturaNombre` en `_ejecutarCierre` (junto a 543-548) y `_recolectarDatosJornada` (junto a 764-772); propagar `userAperturaNombre` en `_generarYGuardarExcel` + `generarExportacionMensual`/`PorRango`/`obtenerDatosJornada` |
| `src/app/pages/login/login.page.ts` | Camb | `onSubmit` sin auto-cierre; `cerrarYGuardar` con `auth.usuario()?.id` + guard; señal `jornadaPendiente`; helper `formatearFecha(fecha): string` → `DD-MM` |
| `src/app/pages/login/login.page.html` | Camb | Título modal "Reanudar jornada del {{ formatearFecha(j.fecha) }}"; copy "Hay una jornada sin cerrar. ¿Qué deseas hacer?" |
| `src/app/services/excel.service.ts` | Camb | `JornadaReportData.userAperturaNombre?: string \| null`; bloque firma condicional en `_agregarResumen` (174-176) y `_agregarJornadaSheet` (592-594) |
| Specs (`jornada.service.spec.ts`, `login.page.spec.ts`, `excel.service.spec.ts`, `pos.page.spec.ts`) | Camb | Ver Testing Strategy |

## Interfaces / Contracts

**`obtenerAbierta()`** (firma no cambia; SQL sí):
```ts
obtenerAbierta(): Observable<Jornada | null> {
  return from(
    this._db.sql<Jornada>(
      'SELECT * FROM jornadas WHERE estado = ? ORDER BY fecha DESC, id DESC LIMIT 1',
      ['abierta'],
    ),
  ).pipe(map((rows) => rows[0] ?? null));
}
```

**`cerrarYGuardar()`** (login.page.ts):
```ts
const j = this.jornadaPendiente();
const uid = this.auth.usuario()?.id;
if (!j || uid === undefined) return;        // patrón app-nav.ts:136-138
this.cerrando.set(true);
this.jornadaService.cerrar(j.id, uid).subscribe({ ... });
```

**`onSubmit()`** — fragmento: `await firstValueFrom(this.auth.login(...));  const abierta = await firstValueFrom(this.jornadaService.obtenerAbierta());  if (abierta) { this.jornadaPendiente.set(abierta); this.showReopenModal.set(true); } else this.router.navigate(['/pos']);`

**`userAperturaNombre`** — en `_ejecutarCierre` (jornada ya en mano por `RETURNING`):
```ts
let userAperturaNombre: string | null = null;
if (jornada.user_apertura_id !== null) {
  const a = await this._db.sql<{ nombre: string }>('SELECT nombre FROM usuarios WHERE id = ?', [jornada.user_apertura_id]);
  userAperturaNombre = a[0]?.nombre ?? null;
}
```
En `_recolectarDatosJornada` (query única, LEFT JOIN):
```sql
SELECT u.nombre FROM jornadas j LEFT JOIN usuarios u ON u.id = j.user_apertura_id WHERE j.id = ?
```

**Excel — bloque firma (reemplaza el `if (data.userCierreNombre)` en ambos sheets)**:
```ts
if (data.userAperturaNombre && data.userCierreNombre && data.userAperturaNombre !== data.userCierreNombre) {
  filas.push(['Abierta por', data.userAperturaNombre]);
  filas.push(['Cerrada por', data.userCierreNombre]);
} else if (data.userCierreNombre) {
  filas.push(['Firmado por', data.userCierreNombre]);
}
```

**Modal (login.page.html)**:
```html
@if (jornadaPendiente(); as j) {
  <h3>Reanudar jornada del {{ formatearFecha(j.fecha) }}</h3>
}
<p>Hay una jornada sin cerrar. ¿Qué deseas hacer?</p>
```

## Testing Strategy (TDD RED→GREEN, `ng test`)

| Spec | Acción |
|---|---|
| `jornada.service.spec.ts — obtenerAbierta` | REWRITE: assert query `['abierta']` (1 solo parámetro, sin fecha), `ORDER BY fecha DESC, id DESC`; casos: día anterior no-filter → retorna; huérfanas múltiples (orden); sin abierta → null + error DB |
| `jornada.service.spec.ts — autoCerrarSiOtroUsuario` (1410-1953) | REMOVER completo |
| `jornada.service.spec.ts — _ejecutarCierre/_recolectarDatosJornada` | NUEVO (RED): `userAperturaNombre='Ana'` con apertura A; `null` si id inexistente o `user_apertura_id=NULL`; propagado a `JornadaReportData` en los `-exportaciones` |
| `login.page.spec.ts — auto-cierre/toast` (L216) | REESCRIBIR: jornada de otro user (mock A) → `showReopenModal=true`, NUNCA llama autoCerrar, sin toast, sin navigate |
| `login.page.spec.ts — cerrarYGuardar uid` (L217-273) | REESCRIBIR: `cerrar(j.id, auth.usuario()?.id)` con mock `usuario` seteado; legacy NULL apertura → id autenticado; auth null → NO llama `cerrar` |
| `login.page.spec.ts — modal copy` | NUEVO (RED): fecha real `2026-08-07` → título "Reanudar jornada del 07-08" + "Hay una jornada sin cerrar"; nunca "de hoy" |
| `excel.service.spec.ts — firma` | NUEVO (RED): A≠B → `['Abierta por','Ana']`+`['Cerrada por','Beto']`; A=B→ Firfirma única; apertura NULL → Firfirma (back-compat) — en Resumen y JornadaSheet |
| `pos.page.spec.ts` | Regresión: `jornadaAbierta` con fecha previa → `sinJornada=false` (sin tocar pos.page.ts) |

Impacto en specs existentes: los tests de `cerrar`/`_ejECutarCierre` que mockean jornadas con `user_apertura_id` seteado deben sumar 1 mock `SELECT nombre` (o el assert quedará null); `historial.page.spec`/`excelSpec` intactos (campo opcional).

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Múltiples `abierta` huérfanas en DBs vivas | Media | `LIMIT 1` ordenado devuelve la más reciente; limpieza histórico queda backlog (out of scope) |
| Reescribir specs rompe asserts de query (`['abierta']` vs 2 params) y mocks de `cerrar` con 1 query extra | Alta | Plan TDD explícito; el bloque `autoCerrar` se borra íntegro; mocks de `_ejecutarCierre` suman SELECT nombre |
| `auth.usuario()?.id` puede ser `undefined` en login | Baja | Guard `if (uid === undefined) return` (patrón app-nav.ts:136) — aborta sin crash |
| Excel retroactivo / legacy (reportes sin apertura) | Baja | Campo opcional + branch "Firmado por" → mismo output que hoy (sin churn en snapshots) |
| `refreshJornadaAbierta()` al arrancar con jornada previa | Baja | Es el fix deseado: `jornadaAbierta` poblada → `sinJornada=false`; regresión en pos.page.spec |
| Fecha en modal: formato `DD-MM` vs locale | Baja | `formatearFecha` ad-hoc sobre ISO (`YYYY-MM-DD`) ya ingresada por `abrir()`; sin libs nuevas |

## Migración / Rollback

No migración (columnas existen v2/v9; `JornadaReportData` aditivo). Rollback: revert queries `fecha=hoy`, restaurar `autoCerrarSiOtroUsuario` y `cerrarYGuardada` — sin vuelta de datos; reportes viejos no se tocan.

## Open Questions

Ninguna — FRs y decisions (#484) resueltas. Solo mantener fuera de scope la limpieza de huérfanas (backlog).