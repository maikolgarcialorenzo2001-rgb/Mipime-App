# Tasks: fix-auto-cierre-jornada

> **ACTUALIZADO 2026-08-10 (apply)**: el plan original (hacer que
> `autoCerrarSiOtroUsuario` genere Excel) quedó OBSOLETO. El bug reportado por
> el dueño (conflicto del autocierre con la branch palmar + bug en reanudar
> jornada) derivó en la decisión de ELIMINAR el autocierre por completo: la
> reapertura se maneja exclusivamente con el modal "reanudar jornada" para
> cualquier usuario autenticado (fix-reanudar-jornada-acceso, ya mergeado).
> Las tareas a continuación reflejan el trabajo REALMENTE implementado.

## Task 1: Eliminar autoCerrarSiOtroUsuario de JornadaService

**Archivos**: `src/app/services/jornada.service.ts`
**Criterio**: grep `autoCerrarSiOtroUsuario` = 0 en `src/`; el import `UsuarioPublico` desaparece

### Subtasks
- [x] Remover el método `autoCerrarSiOtroUsuario(usuario: UsuarioPublico)` completo (~80 líneas: query abierta, UPDATE, generación Excel, auto-save Electron)
- [x] Remover el import `type { UsuarioPublico }` de `../models`
- [x] Verificar que `_generarYGuardarExcel` / `_recolectarDatosJornada` siguen intactos (los usa `_ejecutarCierre`)

## Task 2: Login — flujo reanudar/cerrar sin autocierre

**Archivos**: `src/app/pages/login/login.page.ts`, `src/app/pages/login/login.page.html`
**Criterio**: sin llamadas a `autoCerrarSiOtroUsuario`; `cerrarYGuardar` usa `_jornadaPendiente.user_apertura_id`; modal para CUALQUIER usuario con jornada abierta

### Subtasks
- [x] `onSubmit()`: tras login, `obtenerAbierta()` → si hay jornada, modal de reanudar; si no, navegar a `/pos`
- [x] `cerrarYGuardar()`: `cerrar(j.id, j.user_apertura_id ?? 0)` + descargar Excel + navegar a `/pos`
- [x] Remover `successMessage` y `sessionStorage.setItem('mipime_jornada_auto_cerrada')` (flags del autocierre viejo)
- [x] Mantener `formatearFecha` y los guards de backdrop/Escape (debe elegir)

## Task 3: Tests actualizados

**Archivos**: `src/app/pages/login/login.page.spec.ts`, `src/app/pages/pos/pos.page.spec.ts`, `src/app/services/jornada.service.spec.ts`

### Subtasks
- [x] `login.page.spec.ts`: reescrito — sin referencias a `autoCerrarSiOtroUsuario`; tests de reanudar (mismo/otro usuario) y cerrarYGuardar con `user_apertura_id`
- [x] `pos.page.spec.ts`: test FR-1/AC7 — jornada de día anterior tratada como activa (sinJornada=false, botones habilitados)
- [x] `jornada.service.spec.ts`: mocks de `obtenerDatosJornada` realineados con el query LEFT JOIN usuarios (FR-6) en 2.3/2.3-empty/3.2/4.2; vars muertas removidas; `as any` → `as never`

## Task 4: Verificación

### Subtasks
- [x] `grep -r autoCerrarSiOtroUsuario src/` → 0 coincidencias
- [x] `npx tsc --noEmit` → sin errores
- [x] `eslint` en archivos tocados → limpio (0 errores en login.*, pos.page.spec, jornada.service.*)
- [x] `bun run test` → **858/858 passed (50 files)**, sin regresión

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~450 (diff vs HEAD; incluye realineamiento de mocks heredados) |
| Files modified | 7 (jornada.service.ts, login.page.ts/html/spec, pos.page.spec, jornada.service.spec, excel.service.ts) |
| Chained PRs needed | No |
| Risk level | Low |
