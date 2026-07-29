# Tasks: fix-pago-mixto-divisa-efectivo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~55 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Model + Label (trivial, no deps)

- [ ] 1.1 Add `completacion_efectivo?: number` after `tasa_cambio` in `src/app/models/venta.ts` — one line
- [ ] 1.2 Change `<dt>Saldo esperado</dt>` to `<dt>Saldo en caja</dt>` at line 29 of `src/app/components/jornada-summary-card/jornada-summary-card.component.html`

## Phase 2: Venta insert logic (R2)

- [ ] 2.1 In `src/app/services/venta.service.ts` (lines 176-184), compute `efectivoEnCaja` from `payload.formaPago` + `payload.completacionEfectivo` and use it as the second `?` param instead of `total` in the `saldo_esperado` UPDATE column

## Phase 3: Jornada service (R3–R5)

- [ ] 3.1 Fix `_calcularTotalEnCaja()` in `src/app/services/jornada.service.ts` (R3, lines 138-140) — replace filter+reduce with canonical TS reduce that includes `completacion_efectivo` from divisa ventas
- [ ] 3.2 Fix auto-cierre SQL in `src/app/services/jornada.service.ts` (R4, lines 188-192) — replace `WHERE forma_pago = 'efectivo'` with `CASE WHEN ... COALESCE(...)` pattern
- [ ] 3.3 Fix `_ejecutarCierre()` in `src/app/services/jornada.service.ts` (R5, lines 366-368) — same canonical TS reduce pattern as R3

## Phase 4: Excel service (R6–R9)

- [ ] 4.1 Fix `_agregarResumen()` in `src/app/services/excel.service.ts` (R6, lines 90-92) — canonical TS reduce with `completacion_efectivo`
- [ ] 4.2 Fix `_agregarJornadaSheet()` in `src/app/services/excel.service.ts` (R7, lines 445-447) — same canonical TS reduce
- [ ] 4.3 Fix `_agregarArqueo()` in `src/app/services/excel.service.ts` (R8, lines 663-665) — same canonical TS reduce
- [ ] 4.4 Add "Completación efectivo" column in `_agregarVentas()` (R9, lines 221-259): header, row data for divisa+non-divisa, update footerLen at line 226

## Phase 5: Verify

- [ ] 5.1 Run `ng build` (or `tsc --noEmit`) — confirm no type errors from `completacion_efectivo` field
- [ ] 5.2 Trace each spec scenario manually: efectivo sale, pure divisa (no cash), mixed divisa+cash, transferencia, pendiente, close with mixed payments, auto-cierre, Resumen/Arqueo totals, Ventas column display, NULL completacion handling
