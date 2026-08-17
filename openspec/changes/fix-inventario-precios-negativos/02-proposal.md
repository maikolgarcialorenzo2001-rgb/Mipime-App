# Proposal: fix-inventario-precios-negativos (F4)

## Intent

Bug F4 (`docs/Fix-Inventario-Bugs.md:76-83`): negative prices/costs are accepted and persisted. `registrarEntrada` validates quantity but not `precioCosto`; `registrarEditar` validates nothing about prices; `producto.service.crear/actualizar` have no validation; page `guardarProducto` only checks `=== null`. HTML `min="0"` never applies (`novalidate` + modal without `<form>`). Impact: negative investment via `obtenerInversionGlobal` and contaminated COGS/ganancia through `venta_lotes` and merma. Guard is `< 0`: zero cost is legitimate (gifts, free items).

## Scope

### In Scope
- Service guards (`_validar*` + throw, after `_checkAdmin`, before DB): `registrarEntrada` (`precioCosto`), `registrarEditar` (`precioVenta`, `precioCosto`), `producto.service.crear`/`actualizar` (both prices).
- UI feedback (formError/error + return before service call): `inventario.page.ts` `guardarProducto`, case `'editar'`, case `'entrada'`.
- Tests: `stock-movimiento.service.spec.ts` (S-05 mirror), `producto.service.spec.ts`, `inventario.page.spec.ts`.
- Messages: 'El costo no puede ser negativo' / 'El precio de venta no puede ser negativo'. `0` and `null` allowed.

### Out of Scope
- Sanitizing legacy negative rows (blocked new entries only; a contaminated product is fixed by editing it — validation forces the fix).
- DB CHECK constraint (needs migration v18 — F2 already touches versioning).
- F1–F3, F5–F9 of the plan; `_syncPrecioCosto`/`_consumirFIFO`/`registrarAjuste` propagation (no price input).

## Capabilities

> No `inventario` capability exists in `openspec/specs/` (only unarchived change deltas `fifo-inventario`, `gestion-inventario-mejoras`). Contract with sdd-spec:

### New Capabilities
- `inventario`: non-negative product pricing — every price/cost write path rejects `< 0` (service guard + UI feedback); `0` and `null` remain valid.

### Modified Capabilities
- None (no archived spec-level behavior changes; requirements land in the new capability).

## Approach

Two-layer defense: service guards reject invalid writes (single source of truth, catches every caller), UI checks give immediate feedback before calling the service. Guard expression `!(v >= 0)` is NaN-safe (`NaN < 0` is false). `null` stays allowed (`precio_costo` nullable legacy). Alternatives rejected: DB CHECK (migration v18, out of scope) and `<= 0` guard (0 is legitimate).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/stock-movimiento.service.ts` | Modified | Guards en `registrarEntrada` (~214) y `registrarEditar` (~526) |
| `src/app/services/producto.service.ts` | Modified | Guards en `crear` (44) y `actualizar` (76) |
| `src/app/pages/inventario/inventario.page.ts` | Modified | Checks en `guardarProducto` (413), case `'editar'` (218), case `'entrada'` (149) |
| `src/app/services/stock-movimiento.service.spec.ts` | Modified | S-05: negativos `rejects.toThrow` + `sql` no llamado; 0 permitido |
| `src/app/services/producto.service.spec.ts` | Modified | Casos negativos en `crear`/`actualizar` |
| `src/app/pages/inventario/inventario.page.spec.ts` | Modified | `formError`/`error` + servicio no llamado |
| `db-migrations.ts` | Unchanged | Sin CHECK (no migración) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| NaN slips past `v < 0` | Low | `!(v >= 0)` guard |
| Null `precio_costo` broken (nullable legacy) | Med | Guard only blocks `< 0`, never null |
| Legacy negative rows persist | Med (by design) | New entries blocked; edit forces fix |
| Entrada con costo vacío → `?? 0` | Low | 0 allowed; current behavior kept |

## Rollback Plan

Pure code reversion: remove guards from the 4 service methods + 3 UI checks, revert tests. No schema/migration/data touched — clean revert. Legacy rows unaffected by design.

## Dependencies

- Branch `fix-inventario-bugs`; plan `docs/Fix-Inventario-Bugs.md` F4.
- Existing `_validar*` pattern (`stock-movimiento.service.ts:35-52`) and `_checkAdmin` ordering.

## Success Criteria

- [ ] `registrarEntrada(-5)` rejects with 'El costo no puede ser negativo', `sql` not called; costo 0 accepted.
- [ ] `registrarEditar` rejects negative `precioVenta`/`precioCosto`; `crear`/`actualizar` reject both prices.
- [ ] Page: negative inputs show formError/error and never call the service (guardarProducto, editar, entrada).
- [ ] `null` `precio_costo` still accepted; existing specs stay green.
- [ ] `bun run test` green.
