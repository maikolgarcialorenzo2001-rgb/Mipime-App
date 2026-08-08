# SDD — Proposal: `fix-reanudar-jornada-acceso`

> Artefacto de propuesta (2026-08-08). Guardado también en Engram (`sdd/fix-reanudar-jornada-acceso/proposal`).

## Intent

"Reanudar jornada" debe habilitarse para TODO usuario autenticado (trabajador o admin) SIEMPRE que exista una jornada sin cerrar (la de hoy o una anterior). Hoy el gate REAL no es de rol — `obtenerAbierta()` (`jornada.service.ts:844-854`) y `autoCerrarSiOtroUsuario()` (`:201-273`) filtran `WHERE fecha = hoy AND estado='abierta'`, así que una jornada abierta de un día anterior NO dispara el modal: el login navega directo a `/pos`, `sinJornada=true` (pos.page.html:121,135) bloquea "Cobrar Pendiente"/"Ver Pendientes" y queda una jornada huérfana que permite abrir otra nueva. Además `cerrarYGuardar()` (login.page.ts:80) pasa `user_apertura_id` como userId → registra mal a quién cierra.

## Scope

### In Scope
- `obtenerAbierta()`: última jornada `estado='abierta'` sin filtrar fecha — `ORDER BY fecha DESC, id DESC LIMIT 1`
- Eliminar `autoCerrarSiOtroUsuario()` del flujo y de `jornada.service.ts` (único caller: login.page.ts:47): el modal de reanudar se muestra a CUALQUIER usuario si hay jornada abierta
- `login.page.ts` `cerrarYGuardar()`: `user_cierre_id` = usuario autenticado (`auth.usuario()?.id`), NO `user_apertura_id`
- Ownership: `user_apertura_id` conserva al aperturista (A); `reabrirJornada()` no lo reasigna (ya correcto, se fija con tests)
- Excel ("Abierta por A / Cerrada por B" cuando difieren): campo `userAperturaNombre?` en `JornadaReportData` + resolución en `_ejecutarCierre`/`_recolectarDatosJornada` + fila condicional en `_agregarResumen`/`_agregarJornadaSheet`
- Copy del modal (login.page.html:80): sacar "de hoy" → "Hay una jornada sin cerrar"
- Tests RED/GREEN + delta specs de capabilities modificadas (`jornada-reopen`, `jornada-lifecycle`, `excel-reportes` si aplica)

### Out of Scope
- Migración de datos / changes en db-migrations (columnas ya existen)
- Limpieza de jornadas 'abierta' huérfanas ya existentes en DBs vivas (múltiples filas abiertas de fechas viejas)
- Gates/permisos nuevos por rol (no hay gate hoy; no se agrega)
- Reabrir NO reasigna dueño (comportamiento actual se preserva)

## Estado actual (verificado)

- `jornada.service.ts:844-854` `obtenerAbierta()` + `:201-273` `autoCerrarSiOtroUsuario()` → ambas con `fecha = HOY`
- 'autoCerrarSiOtroUsuario' se usa SOLO en login.page.ts:47 y en specs (grep confirma)
- `refreshJornadaAbierta()` (constructor) puebla `jornadaAbierta` con `obtenerAbierta()` → con el fix, el POS deja de ver `sinJornada=true` automáticamente (pos.page.ts:85-87)
- Excel hoy escribe solo `['Firmado por', userCierreNombre]` (excel.service.ts:174-176 y :592-594); no existe el nombre del aperturista en `JornadaReportData`
- `app-nav.component.ts:136` ya usa `auth.usuario()?.id` para cerrar — patrón a replicar en login

## Enfoque

**Query única corregida**: `obtenerAbierta()` pasa a `SELECT * FROM jornadas WHERE estado='abierta' ORDER BY fecha DESC, id DESC LIMIT 1`. Con eso el POXP deja de bloquear pendientes (la señal `jornadaAbierta` se puebla con la jornada previa) y el login muestra el modal para cualquier usuario.

**Login simplificado**: `onSubmit()` → `if (abierta) showReopenModal=true` (sin llamar a `auto-cerrar`); `cerrarYGuardar()` → `cerrar(j.id, this.auth.usuario()?.id)`.

**Excel**: resolver ambos nombres donde hoy se resuelve `userCierreNombre` (`_ejecutarCierre` :543-548 y `_recolectarDatosJornada` :765-771) + pasarlos a `JornadaReportData`. En el Excel: si ambos existen y difieren → filas "Abierta por A" + "Cerrada por B"; si iguales o falta el aperturista (legacy NULL) → mantener "Firmado por" actual.

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Múltiples jornadas 'abierta' huérfanas en DBs vivas | Media | `LIMIT 1` ordenado devuelve la más reciente; limpieza de datos out of scope (anotar en spec) |
| Borrado de `autoCerrarSiOtroUsuario` rompe specs existentes (jornada.service.spec :1410-1953) | Alta | Reescribir el bloque: tests de nuevo comportamiento (sin auto-cierre; modal p/ cualquier user) |
| `cerrar` desde modal con usuario autenticado: si `auth.usuario()` es null | Baja | Guard ya existente: `if (!uid) return` como en app-nav.ts:138 |
| Excel retroactivo (reportes viejos sin apertura) | Baja | Campo opcional; si falta, se mantiene "Firmado por" (back-compat) |
| Copy de fecha en Excel ("Cerrada por B" fecha = día de cierre) | Baja | La fecha es de la jornada (fecha original A); no cambia |

## Rollback

- Revert de código: restaurar queries `fecha=hoy`, restaurar `autoCerrarSiInteraccionlUsuario` y `cerrarYGuardar`. Sin migración ni volverds de datos: bins seguro. Los reporte Excel viejos no se tocan.

## Dependencias

- Ninguna externa. Internas: `LoginPage` ya inyecta `AuthService` (login.page.ts:19); el `JornadaReportData` es additive.

## Criterios de éxito

- [ ] Trabajador y admin con jornada abierta (hoy o día anterior) ven el modal de reanudar
- [ ] NO hay auto-cierre por "otro usuario"; el modal sale para cualquier user
- [ ] `cerrarYGuardar` registra `user_cierre_id` = usuario que cierra (B), no el apertura
- [ ] Reabrir no altera `user_apertura_id`
- [ ] Excel muestra "Abierta por A / Cerrada por B" cuando difieren; "Firmado por" en el resto
- [ ] `sinJornada=false` con jornada previa → pendientes habilitados sin cambios en pos.page
- [ ] Tests RED/GREEN verdes (`ng test`), specs openspec actualizadas (deltas)

## Preguntas abiertas

1. ¿El modal debe mostrar la fecha real de la jornada (p.ej. "del 07-08") para que el usuario sepa que es de ayer? Propuesta: incluir fecha en el copy — confirmar.
2. Múltiples huérfanas `abierta` de fechas distintas: tomamos la más reciente. --¿armamos limpieza aparte o queda fuera? Propuesta: fuera de scope (backlog).