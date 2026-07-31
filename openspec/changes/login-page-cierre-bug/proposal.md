# Proposal: login-page-cierre-bug — Eliminar parámetro muerto `saldoReal`

## Intent

`jornadaService.cerrar(id, saldoReal, userId, arqueo?)` tiene un parámetro `saldoReal` que `_ejecutarCierre()` ignora completamente — recalcula `saldoRealCalculado` desde datos fuente. Hoy es código muerto. Si alguien lo usa en el futuro, `login.page.ts` pasa `saldo_esperado` (semánticamente incorrecto), causando bugs silenciosos en `saldo_real`. Eliminamos el parámetro para prevenir ese riesgo.

## Scope

### In Scope
- `jornada.service.ts`: firma `cerrar(id, saldoReal, userId, arqueo?)` → `cerrar(id, userId, arqueo?)`
- `login.page.ts`: actualizar caller (línea 85)
- `app-nav.component.ts`: actualizar caller (línea 155)
- Tests: remover argumento dummy ~22+ calls

### Out of Scope
- Flujo de cierre (`_ejecutarCierre`, `_cerrarAsync`)
- Lógica de Excel (no usa `saldo_real` de DB)
- Schema DB (`jornadas.saldo_real` se escribe correctamente)
- Arqueo (`arqueo_caja` no se modifica)

## Capabilities

### New Capabilities
None

### Modified Capabilities
None — refactor puro, sin cambios de comportamiento.

## Approach

1. Cambiar firma de `cerrar()` y propagar a `_cerrarAsync()` y `_ejecutarCierre()`
2. Actualizar callers: `login.page.ts` y `app-nav.component.ts`
3. Actualizar tests (remover argumento dummy)
4. Verificar que tests y build pasen

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/jornada.service.ts` | Modified | Firma `cerrar()`, `_cerrarAsync()`, `_ejecutarCierre()` |
| `src/app/pages/login/login.page.ts` | Modified | Caller línea 85 |
| `src/app/components/layout/app-nav.component.ts` | Modified | Caller línea 155 |
| `src/app/services/jornada.service.spec.ts` | Modified | ~22+ calls actualizados |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper caller olvidado | Low | `grep` de todas las calls a `cerrar(` |
| Test falso positivo | Low | Verificar cobertura de `saldo_real` |

## Rollback Plan

Revert commit. Cambio es pequeño (< 30 líneas), diff fácil de revertir.

## Dependencies

Ninguna.

## Success Criteria

- [ ] Todos los tests existentes pasan (`npm test`)
- [ ] Ninguna referencia a `saldoReal` como parámetro en calls a `cerrar()`
- [ ] Build sin errores de compilación
