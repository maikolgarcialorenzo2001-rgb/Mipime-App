# Apply Progress: f4-f6-producto

> Change: F6 del plan `docs/Fix-Inventario-Bugs.md` (crear no atómico + CRUD sin guard admin).
> Branch: `f4-f7` (contiene F4+F5). Strict TDD activo. Runner: vitest.

## Estado

- [x] F6-RED — 8 tests nuevos, 8 failed (RED confirmado; 22 previos siguen verdes)
- [x] F6-GREEN — 30/30 spec; suite completa 875/875 (46 files); lint limpio

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| R1 (crear atómico) | `src/app/services/producto.service.spec.ts` | Unit | ✅ 22/22 | ✅ 1 failed (transaction no llamada) | ✅ 30/30 | ✅ 2 casos (fallo a mitad + txn única) | ✅ Imports limpiados |
| R2 (guard admin crear) | `src/app/services/producto.service.spec.ts` | Unit | ✅ 22/22 | ✅ 2 failed (resuelve, no rechaza) | ✅ 30/30 | ✅ 2 casos (trabajador + null) | ✅ Patrón `_checkAdmin` copiado |
| R3 (guard admin eliminar) | `src/app/services/producto.service.spec.ts` | Unit | ✅ 22/22 | ✅ 2 failed (resuelve, no rechaza) | ✅ 30/30 | ✅ 2 casos (trabajador + null) | ✅ Idem |
| R4 (guard admin actualizar) | `src/app/services/producto.service.spec.ts` | Unit | ✅ 22/22 | ✅ 2 failed (resuelve, no rechaza) | ✅ 30/30 | ✅ 2 casos (trabajador + null) | ✅ Idem |

## Test Summary

- **Total tests escritos**: 8 (2 por requerimiento)
- **Total tests pasando**: 875/875 suite (867 previos + 8 nuevos)
- **Layers**: Unit (8)
- **Approval tests**: Ninguno (no refactoring de comportamiento existente — solo extensiones de guard/atomicidad)
- **Pure functions**: 0 (los guards son métodos de servicio con side effects de auth, patrón del repo)

## Implementación

- `producto.service.ts`:
  - `_checkAdmin()` privado copiado exacto de `stock-movimiento.service.ts:24-29` (usa `AuthService.usuario()`).
  - `crear`: refactor a async IIFE dentro de `from()` — `_checkAdmin()` → guards F4 → `this._db.transaction()` con INSERT (`RETURNING *`) + `registrarEntrada` dentro de la MISMA txn. Si `registrarEntrada` falla, el adapter hace ROLLBACK (contrato T-08/D1 re-entrante → JOIN). Eliminados `switchMap`, `of`, `throwError` de imports.
  - `actualizar`: `_checkAdmin()` + guards F4 antes del UPDATE (async IIFE).
  - `eliminar`: `_checkAdmin()` antes de los 4 DELETE.
- `producto.service.spec.ts`:
  - Mock `AuthService` (patrón `createMockAuth` de stock-movimiento spec, default rol 'admin').
  - 8 tests nuevos: R1 (fallo registrarEntrada → rejects + `transaction` llamada; happy path → 1 sola txn), R2/R3/R4 (trabajador y null → `rejects.toThrow('Solo administradores')` + `mockDb.sql` no llamada).

## Decisiones

- `actualizar` SÍ lleva guard admin: el plan F6 dice "CRUD sin guard admin" y `actualizar` es API pública de escritura (Update). Sin callers de producción (explore #581) → no rompe UI.
- `listar/buscar/obtenerPorId` quedan abiertos (Read, necesario para POS).
- Guard admin dentro del async IIFE (no `throwError`) para que el throw sincrónico del patrón `_checkAdmin` se convierta en rechazo del Observable (mismo contrato que F4, sin romper `rejects.toThrow`).

## Archivos

| File | Acción |
|------|--------|
| `src/app/services/producto.service.ts` | Modificado (R1+R2+R3+R4) |
| `src/app/services/producto.service.spec.ts` | Modificado (8 tests nuevos + mock AuthService) |

## Risks

- El mock `transaction()` del spec es transparente (no simula ROLLBACK real); la semántica de ROLLBACK del adapter ya está probada en `native-sqlite.service.spec.ts` (N2: fallo en fn → ROLLBACK). A nivel de servicio se prueba el CONTRATO: INSERT dentro de `transaction()` y error propagado.
- `producto.page.spec.ts` usa el ProductoService real: su mock de AuthService ya es admin → no se rompió (verificado en suite completa).
