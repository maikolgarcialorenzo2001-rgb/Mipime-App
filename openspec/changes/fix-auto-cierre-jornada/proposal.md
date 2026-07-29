# Proposal: Fix auto-cierre de jornada — Excel + toast + bug

## Intent

Completar el flujo de auto-cierre de jornada: cuando un usuario diferente loguea y se cierra automáticamente la jornada previa, debe generarse y guardarse el Excel, y el usuario debe recibir feedback visual.

## Scope

### In Scope
- Generar y guardar Excel en `autoCerrarSiOtroUsuario()` (reusando lógica de `_ejecutarCierre`)
- Mostrar toast "Jornada anterior cerrada automáticamente" al navegar a /pos
- Fix: `cerrarYGuardar()` use `_jornadaPendiente.user_apertura_id` en vez de `jornadaAbierta()?.user_apertura_id`

### Out of Scope
- No cambiar el flujo de cierre manual (solo refactor interno)
- No agregar nuevas pantallas o modales

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (es refactor interno, no cambian requerimientos de spec)

## Approach

1. **Extraer helper `_generarYGuardarExcel(jornadaId, userId)`** en JornadaService que recolecte datos (ventas, movimientos, costos, etc.), genere Excel vía ExcelService, y guarde en `jornada_reportes`. Usado por `_ejecutarCierre` (ya tiene esta lógica) y por `autoCerrarSiOtroUsuario`.
2. **`autoCerrarSiOtroUsuario`**: después del UPDATE, llamar al helper para generar + guardar Excel. Retornar `{ jornadaCerrada, reporte }` o similar para que login pueda descargarlo.
3. **Login page**: cuando autoCerrarSiOtroUsuario cierra la jornada y guarda el Excel, descargarlo automáticamente y mostrar toast. Reemplazar flag `sessionStorage` por señal local.
4. **Fix cerrarYGuardar**: cambiar `jornadaAbierta()?.user_apertura_id` por `_jornadaPendiente.user_apertura_id`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/jornada.service.ts` | Modified | Refactor _ejecutarCierre → helper + autoCerrarSiOtroUsuario genera Excel |
| `src/app/pages/login/login.page.ts` | Modified | Toast post-auto-cierre, fix uid, descarga Excel |
| `src/app/pages/login/login.page.html` | Modified | Agregar toast notification |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Refactor rompe cierre manual | Low | Extraer helper sin cambiar firma de _ejecutarCierre |
| Excel no refleja datos exactos al cierre automático | Low | Recolectar datos JUSTO antes del UPDATE en autoCerrar |

## Rollback Plan

Revertir cambios en `jornada.service.ts`, `login.page.ts`, `login.page.html`. El auto-close sin Excel no es crítico — la data sigue en DB.

## Dependencies

- ExcelService (ya existe)

## Success Criteria

- [ ] Login con usuario diferente → jornada anterior se cierra, Excel se guarda y descarga, toast visible
- [ ] Login con mismo usuario → modal de reapertura funciona (regresión)
- [ ] Cierre manual desde jornada page sigue funcionando (regresión)
- [ ] 579 tests verdes
