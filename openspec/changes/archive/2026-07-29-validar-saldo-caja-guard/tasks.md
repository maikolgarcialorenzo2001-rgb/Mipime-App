# Tasks: validar-saldo-caja-guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — Helper en JornadaService

- [x] 1.1 Agregar método `saldoSuficientePara(monto)` en `jornada.service.ts` usando `totalEnCaja()` signal
- [x] 1.2 Manejar edge cases: monto <= 0 → true, monto > totalEnCaja → false

## Phase 2: Service Guards (core business logic)

- [x] 2.1 En `jornada.service.ts` _registrarMovimientoAsync: SELECT saldo_esperado antes de INSERT gasto/compra_divisa, throw si insuficiente
- [x] 2.2 En `venta.service.ts` _ejecutar: SELECT saldo_esperado después de BEGIN TRANSACTION, throw si vuelto > saldo

## Phase 3: UI Wiring (pages + modal)

- [x] 3.1 En `jornada.page.ts`: computed que use `saldoSuficientePara()`, deshabilitar botón + tooltip
- [x] 3.2 En `pos.page.ts`: pasar `saldoEnCaja` (totalEnCaja signal) a checkout-modal
- [x] 3.3 En `checkout-modal.component.ts`: input `saldoEnCaja` + computed `saldoInsuficienteVuelto`, deshabilitar Confirmar

## Phase 4: Tests (escritos junto con código via TDD)

- [x] 4.1 Tests unitarios: `saldoSuficientePara()` (monto=0, negativo, exacto, insuficiente)
- [x] 4.2 Tests: guard _registrarMovimientoAsync (suficiente, insuficiente, borde exacto, NULL)
- [x] 4.3 Tests: guard _ejecutar (vuelto suficiente, insuficiente, sin vuelto, exacto)
- [x] 4.4 Tests: checkout-modal `saldoInsuficienteVuelto` computed
- [x] 4.5 Tests: jornada.page UI disabled estado
