# SDD — Spec (delta): `fix-reanudar-jornada-acceso`

> Artefacto de spec (2026-08-08). Guardado también en Engram (`sdd/fix-reanudar-jornada-acceso/spec`).
> Basado en: explore (#486), proposal (#488), decisions (#487 — modal con fecha real).

## FR-1 — Detección de jornada abierta sin filtro de fecha (service)

`JornadaService.obtenerAbierta()` DEBE consultar la ÚLTIMA jornada con `estado='abierta'` SIN filtrar `fecha = hoy`: `SELECT * FROM jornadas WHERE estado=? ORDER BY fecha DESC, id DESC LIMIT 1`. De este modo una jornada abierta de un día anterior (o de hace N días) se detecta igual que la de hoy. Entre múltiples jornadas 'abierta' huérfanas DEBE devolver la más reciente. No hay cambios de esquema (columnas existentes).

- **Escenario jornada abierta de hoy**: DADO una jornada `estado='abierta'` con `fecha = hoy`; CUANDO se llama `obtenerAbierta()`; ENTONCES devuelve esa jornada y la query NO incluye el parámetro fecha.
- **Escenario jornada abierta de día anterior**: DADO una jornada `estado='abierta'` con `fecha = ayer` y ninguna de hoy; CUANDO se llama `obtenerAbierta()`; ENTONCES devuelve la de ayer (no `null`).
- **Escenario múltiples huérfanas**: DADO dos jornadas 'abierta' de fechas distintas (07-08 y 31-07); CUANDO se llama `obtenerAbierta()`; ENTONCES devuelve la de `fecha DESC` mayor (la más reciente).
- **Escenario sin jornada abierta**: DADO ninguna jornada `estado='abierta'`; CUANDO se llama `obtenerAbierta()`; ENTONCES devuelve `null` y el login navega directo a `/pos`.

## FR-2 — Modal de reanudar para CUALQUIER usuario autenticado (login)

El login DEBE mostrar el modal de reanudar a TODO usuario autenticado (trabajador o admin) siempre que exista una jornada abierta (la de hoy o la última de días previos). Se ELIMINA `autoCerrarSiOtroUsuario()` del flujo de login: NO existe auto-cierre por "otro usuario". El modal ofrece "Reabrir jornada" (continúa, sin cambio de ownership) o "Cerrar y guardar". El acceso al modal NO depende del rol ni de `user_apertura_id`.

- **Escenario usuario B loguea con jornada de A**: DADO jornada abierta con `user_apertura_id = A`; CUANDO un usuario B (cualquier rol) se loguea; ENTONCES se muestra el modal de reanudar, NO hay auto-cierre, NO hay toast "Jornada anterior cerrada", y no se navega automáticamente.
- **Escenario mismo usuario**: DADO jornada abierta de A; CUANDO A se loguea; ENTONCES se muestra el modal (comportamiento preservado, sin cambios de vista).

## FR-3 — Modal muestra la fecha real de la jornada

El modal DEBE mostrar la fecha real de la jornada pendiente (ej. "Reanudar jornada del 07-08") para que el usuario sepa si es de hoy o de un día previo. El copy NO DEBE decir "de hoy": DEBE decir "Hay una jornada sin cerrar". El título DEBE reflejar la fecha o "Jornada sin cerrar".

- **Escenario modal con jornada de ayer**: DADO jornada abierta con `fecha = "2026-08-07"`; CUANDO el login muestra el modal; ENTONCES el modal muestra "Reanudar jornada del 07-08" y "Hay una jornada sin cerrar" (nunca "de hoy").
- **Escenario modal con jornada de hoy**: DADO jornada abierta con `fecha = hoy`; CUANDO se muestra el modal; ENTONCES se ve la fecha de hoy formateada (DD-MM) y el copy genérico "Hay una jornada sin cerrar".

## FR-4 — Cierre registra el usuario autenticado (fix `user_cierre_id`)

`cerrarYGuardar()` (login.page.ts:80) DEBE usar el usuario autenticado actual como `userId` al llamar a `cerrar(j.id, uid)`: `uid = this.auth.usuario()?.id`, NO `j.user_apertura_id`. Así `user_cierre_id` queda con QUIÉN cierra realmente la jornada, incluso en jornadas legacy (`auth.usuario()?.id` definido) y en el caso A≠B. Con guard: si `auth.usuario()` es `null`, se aborta el cierre sin error crash (patrón `app-nav.ts:138`).

- **Escenario B cierra jornada de A**: DADO jornada abierta de A (user_apertura_id=A) reabierta por B; CUANDO B pulsa "Cerrar y guardar"; ENTONCES la jornada se cierra con `user_cierre_id = B.id` y `user_apertura_id` NO cambia (queda A).
- **Escenario legacy sin apertura**: DADO jornada abierta con `user_apertura_id = NULL` (legacy); CUANDO un usuario autenticado pulsa "Cerrar y guardar"; ENTONCES `user_cierre_id = usuario.id` (no 0).

## FR-5 — Ownership preservado y no reasignado

El reabrir una jornada NO DEBE modificar `user_apertura_id` (el aperturista original queda; solo cierra anota `user_cierre_id`). Sin migraciones ni columnas nuevas.

- **Escenario reapertura**: DADO jornada de A reabierta; CUANDO se navega a `/pos` y se trabaja; ENTONCES `user_apertura_id` sigue siendo A (sin UPDATE de reasignación).

## FR-6 — Excel "Abierta por A / Cerrada por B" (back-compat)

El Excel del cierre DEBE registrar cuándo abrió y quién cerró. `JornadaReportData` GANA un campo aditivo opcional `userAperturaNombre?: string | null` (resuelve `user_apertura_id` en los mismos puntos donde hoy se resuelve `userCierreNombre`: `_ejecutarCierre` y `_recolectarDatosJornada`). En `_agregarResumen` y `_agregarJornadaSheet`:

- si `userAperturaNombre` y `userCierreNombre` existen y son DISTINTOS → filas `['Abierta por', userAperturaNombre]` + `['Cerrada por', userCierreNombre]`
- en caso contrario (iguales, o apertura NULL legacy) → se mantiene la fila actual `['Firmado por', userCierreNombre]`

(Previously: solo se escribía `['Firmado por', userCierreNombre]` y no existía el nombre del aperturista.)

- **Escenario A≠B**: DADO `user_apertura_id=A` (nombre "Ana") y cierre por B ("Beto"); CUANDO el Excel (Resumen y JornadaSheet); ENTONCES filas "Abierta por Ana" y "Cerrada por Beto".
- **Escenario A=B**: DADO apertura y cierre por el mismo usuario; ENTONCES aparece una única fila "Firmado por" (igual que hoy).
- **Escenario legacy sin apertura**: DADO `user_apertura_id=NULL`; CUANDO el Excel; ENTONCES se mantiene "Firmado por" (back-compat; reportes viejos no se tocan).

## Requisitos no funcionales

- TDD estricto RED/GREEN en español (`ng test`): sin código productivo antes de un RED que falle.
- No se toca `pos.page.ts`: la habilitación de pendientes con jornada previa llega sola al poblar `jornadAbierta` vía `refreshJornadaAbierta()`.
- No hay cambios de DB (columnas `user_apertura_id`/`user_cierre_id` existen desde migraciones v2/v9). Sin migración nueva.
- Se elimina el método `autoCerrarSiOtroUsuario()` (único caller: login.page.ts:47) y sus tests.

## Enfoque TDD — tests nuevos / reescritos

| Archivo | Cambio |
|---|---|
| `jornada.service.spec.ts` — `obtenerAbierta` | MODIFICAR (RED): assert query sin parámetro fecha + `ORDER BY fecha DESC, id DESC LIMIT 1`; case día anterior, case múltiples huérfanas (la más reciente). |
| `jornada.service.spec.ts` — bloque `autoCerrarSiOtroUsuario` (1410-1953) | REMOVER (método eliminado). |
| `jornada.service.spec.ts` — `_ejecutarCierre`/`_recolectarDatosJornada` | NUEVO (RED): resolver `user_apreturaNombre` desde `user_apertura_id` (JOIN `usuarios`); null si no existe. |
| `login.page.spec.ts` — "otro usuario → auto-cierre/toast" (L216) | REESCRIBIR (RED): jornada de otro user → `showReopenModal=true`, NO llama autoCerrar, sin toast, NO navega. |
| `login.page.spec.ts` — "cerrarYGuardar usa user_apertura_id" (L255) | REESCRIBIR (RED): `cerrar` llamado con `auth.usuario()?.id` (mock user admin id=1) y no con user_apertura_id; caso legacy NULL → uid del autenticado. |
| `login.page.spec.ts` — modal | NUEVO (RED): component/html muestra fecha real de la jornada (copy "sin cerrar" + título con fecha). Trabajar/ admin ambos con jornada previa → modal. |
| `excel.service.spec.ts` — Resumen/JornadaSheet | NUEVO (RED): `userAperturaNombre`≠`userCierreNombre` → "Abierta por"/"Cerrada por"; iguales o apertura NULL → "Firmado por". |
| `pos.page.spec.ts` | Regresión: `sinJornada=false` cuando `obtenerAbierta()` devuelve jornada previa (mocks con fecha != hoy). Sin tocar pos.page.ts. |

## Specs openspec a crear / actualizar

| Spec | Tipo | Cambio |
|---|---|---|
| `openspec/specs/jornada-reopen/spec.md` | MODIFIED | "User Onership" → "Detección de jornada abierta (sin fecha)"; "Reopen Modal" + fecha; aplicar **REMOVED** a "Auto-Close on Different User". |
| `openspec/specs/jornada-lifecycle/spec.md` | MODIFIED | "Jornada Closure" quita escenario `Auto-cierre`; "Jornada State Tracking" — "Signal null" sin "for today"; cierre con `user_cierre_id` autenticado. |
| `openspec/specs/excel-reportes/spec.md` | MODIFIED/ADDED | ADDED: "Abierta por A / Cerrada por B" + back-compat "Firmado por". |
| `login/spec.md` | SIN cambios (no aplica). | — |

## Files de spec a crear

- `docs/sdd/fix-reanudar-jornada-acceso/03-spec.md` (este archivo)
- `openspec/changes/fix-reanudar-jornada-acceso/specs/jornada-reopen/spec.md` (delta)
- `openspec/changes/fix-reanudar-jornada-acceso/specs/jornada-lifecycle/spec.md` (delta)
- `openspec/changes/fix-reanudar-jornada-acceso/specs/excel-reportes/spec.md` (delta)

## Criterios de aceptación

- [ ] AC1→FR1: `obtenerAbierta()` devuelve la última abierta (cualquier fecha); query sin filtro de hoy; `null` sin abierta.
- [ ] AC2→FR2: trabajador Y admin con jornada abierta (hoy o previa) ven el modal; NO hay auto-cierre por otro usuario; no hay toast "cerrada automáticamente".
- [ ] AC3→FR3: modal muestra la fecha real ("Reanudar jornada del 07-08") y el copy "Hay una jornada sin cerrar".
- [ ] AC4→FR4: `cerrarYGuardar` registra `user_cierre_id` del autenticado (incluso legacy/con apertura NULL).
- [ ] AC5→FR5: `user_apertura_id` no se modifica al reabrir.
- [ ] AC6→FR6: Excel "Abierta por A / Cerrada por B" cuando difieren; "Firmado por" en A=B y legacy.
- [ ] AC7: `sinJornada=false` con jornadas previa → pendientes habilitados (sin cambios en pos.page).
- [ ] AC8: Suite completa `ng test` verde (RED/GREEN) + deltas openspec archivables.

## Fuera de scope

Limpieza de jornadas 'abierta' huérfanas históricas (backlog); migraciones de DB (columnas ya existen); gates/permisos nuevos por rol; reasignación de dueño al reabrir; cambios al Excel de reportes viejos ya guardados; múltiples modalidades nuevas.