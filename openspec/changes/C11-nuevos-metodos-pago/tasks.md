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

- [x] 1.1 RED: Test CuentaCosa interface fields
- [x] 1.2 GREEN: Create `src/app/models/cuenta-cosa.ts`
- [x] 1.3 Update `src/app/models/index.ts` — re-export CuentaCosa
- [x] 1.4 RED: Test Venta has divisa_tipo, monto_divisa, tasa_cambio, comprador_nombre, autorizado_por, descripcion
- [x] 1.5 GREEN: Add 6 optional fields to `Venta` interface
- [x] 1.6 RED: Test migration v6 preserves v5 data + creates cuenta_cosas table
- [x] 1.7 GREEN: Register `_migrationV6()` call in `initialize()` after v5
- [x] 1.8 GREEN: Add `_migrationV6()` with CHECK('efectivo','transferencia','divisas','pendiente') + CREATE cuenta_cosas + version 6

## Phase 2: PR2 — Checkout UI + Services

### PR2a — CheckoutModal UI (tasks 2.1-2.5) ✅

- [x] 2.1 RED: Test modal renders 5 buttons + conditional sub-forms per formaPago
- [x] 2.2 GREEN: Expand `formaPago` signal to 5 values; add conditional form signals
- [x] 2.3 GREEN: Add sub-form HTML: divisa_tipo/montoDivisa/tasaCambio, compradorNombre/autorizadoPor/descripcion
- [x] 2.4 RED: Test CheckoutPayload emitted with correct fields per formaPago
- [x] 2.5 GREEN: Emit full `CheckoutPayload` from `confirmar` output

### PR2b — Services (tasks 2.6-2.10) ✅

- [x] 2.6 RED: Test CuentaCosasService INSERT + stock salida + no afecta jornada
- [x] 2.7 GREEN: Create `src/app/services/cuenta-cosa.service.ts`
- [x] 2.8 RED: Test divisas total = monto * tasa + UPDATE jornadas
- [x] 2.9 RED: Test pendiente INSERT + stock pero salta UPDATE jornadas
- [x] 2.10 GREEN: Update `VentaService._ejecutar()` with payload param + conditional UPDATE

### PR2c — PosPage routing (tasks 2.11-2.12) ✅

- [x] 2.11 RED: Test pos.page routes cuenta_cosas to CuentaCosasService
- [x] 2.12 GREEN: Update `PosPage.confirmarVenta()` switch on formaPago

## Phase 3: PR3 — Excel + Jornada

- [ ] 3.1 RED: Test JornadaService queries cuenta_cosas in cierre
- [ ] 3.2 GREEN: Add CC query in `_ejecutarCierre()` + `_recolectarDatosJornada()`
- [ ] 3.3 RED: Test Excel Resumen — CC table (negative), divisas row, pendientes (paréntesis)
- [ ] 3.4 RED: Test Excel Ventas — conditional columns for divisas/pendientes
- [ ] 3.5 GREEN: `_agregarResumen()` — tabla CC negativa, fila divisas, pendientes paréntesis
- [ ] 3.6 GREEN: `_agregarVentas()` — conditional divisa_tipo/monto_divisa/tasa_cambio columns
