# Tasks: C11 — Nuevos Métodos de Pago

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-700 |
| 300-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1: DB+Models → PR2: UI+Services → PR3: Excel+Jornada |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
300-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base | Est. lines |
|------|------|-----------|------|------------|
| 1 | Migration v6 + all models | PR 1 | new-features | ~176 |
| 2 | Checkout + VentaService + CuentaCosasService | PR 2 | PR 1 branch | ~380 |
| 3 | Excel + Jornada CC query | PR 3 | PR 2 branch | ~180 |

## Phase 1: PR1 — DB + Models

- [ ] 1.1 RED: Test CuentaCosa interface fields
- [ ] 1.2 GREEN: Create `src/app/models/cuenta-cosa.ts`
- [ ] 1.3 Update `src/app/models/index.ts` — re-export CuentaCosa
- [ ] 1.4 RED: Test Venta has divisa_tipo, monto_divisa, tasa_cambio, comprador_nombre, autorizado_por, descripcion
- [ ] 1.5 GREEN: Add 5 optional fields to `Venta` interface
- [ ] 1.6 RED: Test migration v6 preserves v5 data + creates cuenta_cosas table
- [ ] 1.7 GREEN: Register `_migrationV6()` call in `initialize()` after v5
- [ ] 1.8 GREEN: Add `_migrationV6()` with CHECK('efectivo','transferencia','divisas','pendiente') + CREATE cuenta_cosas + version 6

## Phase 2: PR2 — Checkout UI + Services

- [ ] 2.1 RED: Test modal renders 5 buttons + conditional sub-forms per formaPago
- [ ] 2.2 GREEN: Expand `formaPago` signal to 5 values; add conditional form signals
- [ ] 2.3 GREEN: Add sub-form HTML: divisa_tipo/montoDivisa/tasaCambio, compradorNombre/autorizadoPor/descripcion
- [ ] 2.4 RED: Test CheckoutPayload emitted with correct fields per formaPago
- [ ] 2.5 GREEN: Emit full `CheckoutPayload` from `confirmar` output
- [ ] 2.6 RED: Test CuentaCosasService INSERT + stock salida + no afecta jornada
- [ ] 2.7 GREEN: Create `src/app/services/cuenta-cosa.service.ts`
- [ ] 2.8 RED: Test divisas total = monto * tasa + UPDATE jornadas
- [ ] 2.9 RED: Test pendiente INSERT + stock pero salta UPDATE jornadas
- [ ] 2.10 GREEN: Update `VentaService._ejecutar()` with payload param + conditional UPDATE
- [ ] 2.11 RED: Test pos.page routes cuenta_cosas to CuentaCosasService
- [ ] 2.12 GREEN: Update `PosPage.confirmarVenta()` switch on formaPago

## Phase 3: PR3 — Excel + Jornada

- [ ] 3.1 RED: Test JornadaService queries cuenta_cosas in cierre
- [ ] 3.2 GREEN: Add CC query in `_ejecutarCierre()` + `_recolectarDatosJornada()`
- [ ] 3.3 RED: Test Excel Resumen — CC table (negative), divisas row, pendientes (paréntesis)
- [ ] 3.4 RED: Test Excel Ventas — conditional columns for divisas/pendientes
- [ ] 3.5 GREEN: `_agregarResumen()` — tabla CC negativa, fila divisas, pendientes paréntesis
- [ ] 3.6 GREEN: `_agregarVentas()` — conditional divisa_tipo/monto_divisa/tasa_cambio columns
