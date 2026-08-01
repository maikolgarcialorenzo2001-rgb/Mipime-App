# Proposal: Merma Validation

## Intent

La merma registra hoy con motivo opcional y sin feedback visual de stock disponible, generando errores recién al submit cuando el stock es insuficiente. Además, al ser irreversible (consume lotes vía FIFO), falta una confirmación previa. En la tabla diaria de jornada no se ve la ubicación de cada merma. Mejorar la experiencia con validaciones tempranas, confirmación y datos completos.

## Scope

### In Scope
1. **Motivo obligatorio** en `registrarMerma()` (service + UI)
2. **Stock check en UI**: mostrar stock disponible + validar antes de submit
3. **Confirmación previa**: resumen (producto, cantidad, costo estimado, motivo, ubicación) antes de ejecutar
4. **Columna ubicación** en tabla de mermas de jornada
5. **Tests**: merma en almacén, motivo obligatorio, stock insuficiente desde UI mock

### Out of Scope
- Guard de saldo de caja (exclusión correcta del SDD anterior)
- Cambios en flujo de cierre de jornada
- Cambios en schema DB
- Página dedicada de gestión de mermas (post-MVP)

## Capabilities

### New Capabilities
None — todos los cambios son modificaciones a specs existentes.

### Modified Capabilities
- **merma-tracking**: cambios en requisitos existentes:
  - `Register Merma`: motivo pasa de opcional a obligatorio
  - `Merma exceeds available stock`: agregar validación pre-submit en UI + confirmación antes de ejecutar
  - `Merma Displayed in Jornada Daily Table`: agregar columna ubicación a cada entry

## Approach

**Approach B (recomendado por exploration)**:

1. **Service** (`stock-movimiento.service.ts`): hacer `motivo` required (throw si vacío, como `registrarAjuste`)
2. **UI Producto page**: mostrar stock_shop/stock_almacén al lado del input cantidad; validar cantidad ≤ stock antes de submit; modal de confirmación con resumen antes de llamar al service
3. **UI Jornada page**: agregar columna "Ubicación" a la tabla de mermas
4. **Tests**: spec con casos de almacén, motivo vacío y mock de UI con stock insuficiente

Costo estimado en confirmación = `cantidad × precio_costo` del producto (puede diferir levemente del FIFO real — aceptado).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `services/stock-movimiento.service.ts` | Modified | Motivo obligatorio en `registrarMerma()` |
| `pages/productos/producto.page.ts` + `.html` | Modified | Stock check UI + confirmación modal |
| `pages/jornada/jornada.page.ts` + `.html` | Modified | Columna ubicación en tabla de mermas |
| `services/stock-movimiento.service.spec.ts` | Modified | Tests: almacén, motivo, stock UI |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Costo estimado ≠ FIFO real en confirmación | Medium | Mostrar como "costo estimado", aceptar diferencia |
| Sin rollback de lotes consumidos | Low | Confirmación explícita reduce error humano |

## Rollback Plan

Revert commits del cambio. Los cambios son aditivos (validaciones UI, columna) — no hay migraciones ni cambios de schema que requieran reversed migration.

## Dependencies

None.

## Success Criteria

- [ ] Motivo vacío en merma → error antes de submit + error 400 del service
- [ ] Stock insuficiente → botón deshabilitado y mensaje visible, sin llamada al service
- [ ] Confirmación muestra resumen y requiere acción explícita para ejecutar
- [ ] Tabla de mermas en jornada muestra columna "Ubicación"
- [ ] Tests pasan con motivo obligatorio, merma en almacén, stock insuficiente
