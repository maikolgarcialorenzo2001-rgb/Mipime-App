# Proposal: Validación de saldo en caja (CajaGuard)

## Intent

Prevenir que operaciones de egreso de efectivo (gastos, compra_divisa, vuelto divisa) se ejecuten si el saldo en caja es insuficiente, evitando estados financieros inconsistentes en la DB.

## Scope

### In Scope
- UI validation en jornada.page — deshabilitar botón de gasto/compra_divisa si `totalEnCaja() < monto`
- UI validation en checkout-modal — verificar saldo antes de confirmar venta divisa con vuelto
- Service guard en `jornada.service._registrarMovimientoAsync` — throw si `saldo_esperado - monto < 0`
- Service guard en `venta.service._ejecutar` — throw si `saldo_esperado - vuelto < 0`
- Shared helper `verificarSaldoSuficiente(monto)` en JornadaService

### Out of Scope
- Merma validation — es costo de inventario, no egreso de caja
- Bug de login.page (usa `saldo_esperado` en vez de `totalEnCaja()`) — pre-existente, no relacionado

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `jornada-lifecycle`: Validación de saldo antes de registrar gasto/compra_divisa. Nueva precondición: saldo suficiente o se rechaza la operación.
- `checkout`: Validación de vuelto antes de confirmar venta divisa. Bloqueo si vuelto > saldo disponible.

## Approach

Validación dual (recomendado por exploration):

1. **UI guard**: Check `JornadaService.totalEnCaja()` signal antes de permitir la acción. Botón deshabilitado + mensaje visual si saldo insuficiente.
2. **Service guard**: Dentro de la transacción, leer `saldo_esperado` y verificar que `saldo_esperado - monto >= 0` antes de modificar. Lanzar error si insuficiente.
3. **Shared helper**: Método `verificarSaldoSuficiente(monto)` en JornadaService reutilizable por ambos contextos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `services/jornada.service.ts` | Modified | Guard transaccional en _registrarMovimientoAsync |
| `services/venta.service.ts` | Modified | Guard transaccional en _ejecutar para vuelto |
| `pages/jornada/jornada.page.ts` | Modified | UI check pre-movimiento |
| `pages/pos/pos.page.ts` | Modified | UI check pre-confirmarVenta divisa |
| `components/checkout-modal/` | Modified | Inyectar JornadaService para check de vuelto |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition (2 ops pasan check simultáneo) | Low | SQLite aislamiento — 2da op ve saldo comprometido |
| Signal stale (totalEnCaja() no actualizado) | Low | Service guard verifica antes de escribir |

## Rollback Plan

Revert commits de service guard y UI check. Sin migraciones de DB — cambio puramente lógico.

## Dependencies

Ninguna.

## Success Criteria

- [ ] UI deshabilita botón + muestra mensaje si saldo insuficiente para gasto/compra_divisa/vuelto
- [ ] Service lanza error si se invoca con saldo insuficiente sin pasar por UI
- [ ] Tests unitarios cubren ambos guards (UI y service)
- [ ] Operaciones con saldo suficiente continúan funcionando normalmente
