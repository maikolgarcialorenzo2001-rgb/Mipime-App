# Spec: fix-auto-cierre-jornada

> **OBSOLETO (2026-08-10)** — este documento describe el plan ORIGINAL (que el
> autocierre generara Excel). La decisión final del dueño fue ELIMINAR el
> autocierre por completo: reanudar jornada se maneja con el modal para
> cualquier usuario autenticado. El plan REAL está en `tasks.md`; el resultado
> en `apply-report.md`.

## About this spec
This is a delta spec for an internal refactor. No new capabilities or spec-level changes.

## Behavioral Changes
- [x] Logging in with a **different user** when a jornada is open → auto-close saves Excel report + downloads it + user enters fresh
- [x] Logging in with the **same user** when a jornada is open → modal to resume (unchanged behavior, regression guard)
- [x] Manual close from JornadaPage → works exactly as before (regression guard)

## Technical Requirements
- `autoCerrarSiOtroUsuario()` MUST generate and save Excel report to `jornada_reportes` table
- Excel MUST be automatically downloaded after auto-close
- Toast notification MUST appear after auto-close
- `cerrarYGuardar()` MUST use `_jornadaPendiente.user_apertura_id`

## Acceptance Criteria
- [ ] AC1: Different user logs in with open jornada → Excel saved, downloaded, toast shown
- [ ] AC2: Same user logs in with open jornada → modal appears (regression)
- [ ] AC3: Manual close from JornadaPage still works (regression)
- [ ] AC4: 579 tests pass
