# Tasks: fix-auto-cierre-jornada

## Task 1: Extraer helper _generarYGuardarExcel

**Archivos**: `src/app/services/jornada.service.ts`
**Líneas**: Extraer de _ejecutarCierre (lines ~378-402) a método privado
**Estimado**: ~20 líneas movidas
**Criterio**: _ejecutarCierre sigue funcionando, helper es llamable desde autoCerrarSiOtroUsuario

### Subtasks
- [ ] Crear `_generarYGuardarExcel(jornadaId: number, userId: number): Promise<void>` con lógica de generación de Excel
- [ ] _ejecutarCierre() llama al helper en vez de inline
- [ ] 579 tests verdes después del refactor

## Task 2: autoCerrarSiOtroUsuario genera Excel

**Archivos**: `src/app/services/jornada.service.ts`
**Líneas**: autoCerrarSiOtroUsuario ~158-168
**Estimado**: +3 líneas
**Criterio**: autoCerrarSiOtroUsuario genera y guarda Excel post-UPDATE

### Subtasks
- [ ] Llamar `_generarYGuardarExcel(jornada.id, usuario.id)` después del UPDATE
- [ ] Mantener return null (login detecta auto-close)

## Task 3: Login — download Excel + toast

**Archivos**: `src/app/pages/login/login.page.ts`, `src/app/pages/login/login.page.html`
**Líneas**: onSubmit ~44-48, login.page.html ~54+
**Estimado**: ~30 líneas
**Criterio**: Al auto-close, Excel se descarga y toast aparece

### Subtasks
- [ ] onSubmit(): cuando autoCerrarSiOtroUsuario retorna null, llamar obtenerReporte + descargar Excel
- [ ] Agregar toast "Jornada anterior cerrada automáticamente" con auto-dismiss
- [ ] Remover `sessionStorage.setItem('mipime_jornada_auto_cerrada')`

## Task 4: Fix cerrarYGuardar uid

**Archivos**: `src/app/pages/login/login.page.ts`
**Líneas**: ~73
**Estimado**: 1 línea
**Criterio**: cerrarYGuardar usa _jornadaPendiente.user_apertura_id

### Subtasks
- [ ] Cambiar `jornadaService.jornadaAbierta()?.user_apertura_id` por `_jornadaPendiente.user_apertura_id`

## Task 5: Tests

**Archivos**: `src/app/services/jornada.service.spec.ts`, `src/app/pages/login/login.page.spec.ts`
**Estimado**: ~30 líneas
**Criterio**: Tests pasan para nuevo helper + auto-close con Excel

### Subtasks
- [ ] Test: autoCerrarSiOtroUsuario genera Excel (mock ExcelService + verify insert en jornada_reportes)
- [ ] Test: autoCerrarSiOtroUsuario con mismo usuario no genera Excel
- [ ] Verificar 579 tests verdes

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~85 |
| Files modified | 4 (jornada.service.ts, login.page.ts, login.page.html, tests) |
| Chained PRs needed | No |
| Risk level | Low |
