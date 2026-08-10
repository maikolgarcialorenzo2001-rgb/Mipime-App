# Design: fix-auto-cierre-jornada

> **OBSOLETO (2026-08-10)** — este documento describe el plan ORIGINAL (que el
> autocierre generara Excel). La decisión final del dueño fue ELIMINAR el
> autocierre por completo: reanudar jornada se maneja con el modal para
> cualquier usuario autenticado. El plan REAL está en `tasks.md`; el resultado
> en `apply-report.md`.

## Technical Approach

Extraer la recolección de datos + generación de Excel + guardado de `_ejecutarCierre()` a un helper `_generarYGuardarExcel()` reutilizable. `autoCerrarSiOtroUsuario()` llama al helper tras el UPDATE.