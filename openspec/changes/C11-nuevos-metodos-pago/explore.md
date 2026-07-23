# Exploration: C11-nuevos-metodos-pago

## Current State

The POS app currently supports 2 payment methods (`efectivo`, `transferencia`) stored in `ventas.forma_pago` with a CHECK constraint `CHECK(forma_pago IN ('efectivo', 'transferencia'))` (enforced by migration v5). The checkout flow is:

1. User selects items → CartService (in-memory signals)
2. User clicks "Cobrar" → CheckoutModalComponent opens with 2 payment buttons
3. User selects payment method and confirms → PosPage.confirmarVenta() → VentaService.registrar()
4. VentaService runs a SQL transaction:
   - INSERT ventas → INSERT detalle_ventas → UPDATE stock on productos → UPDATE jornada (total_ventas, saldo_esperado) → StockMovimientoService.registrarSalida per item
5. On jornada close, ExcelService generates 3 sheets: Resumen, Ventas, Movimientos

All ventas **always** affect both `total_ventas` and `saldo_esperado` equally (lines 126-132 in venta.service.ts).

---

## Affected Areas

### 1. Database — `sqlite.service.ts`

| What | Detail |
|------|--------|
| Current migration | v5 (last). CHECK is `('efectivo', 'transferencia')` |
| Requires | **Migration v6** — recreate `ventas` with new CHECK (or remove it) and add columns for divisas |
| New columns needed on `ventas` | `divisa_tipo TEXT` (nullable), `tasa_cambio REAL` (nullable), `comprador_nombre TEXT` (nullable), `autorizado_por TEXT` (nullable), `descripcion TEXT` (nullable) |
| New table needed | `cuenta_cosas` — separate from `ventas` entirely |
| `cuenta_cosas` schema | `id INTEGER PK`, `jornada_id INTEGER REFERENCES jornadas(id)`, `fecha_hora TEXT`, `productos` (JSON or separate detail table?), `created_at TEXT` |
| Risks | CHECK constraint in v5 is `('efectivo', 'transferencia')` — either expand to include `'divisas'` and `'pendiente'`, or remove CHECK entirely and validate in app. **Recreating table with ALTER is the existing pattern (v5)**. |

### 2. Models — `venta.ts`, `jornada.ts`, new `cuenta-cosa.ts`

| File | Changes |
|------|---------|
| `venta.ts` | Add optional fields: `divisa_tipo?: 'EUR' \| 'USD'`, `tasa_cambio?: number`, `comprador_nombre?: string`, `autorizado_por?: string`, `descripcion?: string`. **Or** keep Venta lean and add a separate `VentaDivisa` / `VentaPendiente` discriminated type. |
| `jornada.ts` | No changes needed — JornadaReportData interface doesn't know about payment types, just aggregates totals. |
| **New** `cuenta-cosa.ts` | Interface for the Cuenta Cosas table. |
| `index.ts` | Export new model. |

### 3. Checkout Modal — `checkout-modal.component.ts` + `.html`

| What | Current | Needs |
|------|---------|-------|
| `formaPago` signal | `'efectivo' \| 'transferencia'` | Expand union: `'efectivo' \| 'transferencia' \| 'divisas' \| 'pendiente'` |
| Template buttons | 2 buttons (Efectivo, Transferencia) | Add Divisas (with currency selector sub-form) and Pendiente (with fields: comprador, autorizado por) |
| Output emission | `confirmar.emit({ formaPago })` | For Divisas: needs `{ formaPago, divisaTipo, tasaCambio }`. For Pendiente: needs `{ formaPago, compradorNombre, autorizadoPor, descripcion }`. **Breaking change** to the output interface. |
| Spec | Tests check `'efectivo'` and `'transferencia'` only | All will break — must be rewritten with new payment types |

### 4. VentaService — `venta.service.ts`

| Method | Current | Needs |
|--------|---------|-------|
| `registrar()` | Takes `formaPago: string`, updates jornada with `total` for BOTH `total_ventas` and `saldo_esperado` | For **Pendiente**: must NOT update `total_ventas` or `saldo_esperado` (only stock). Pass extra flag or split logic. |
| `_ejecutar()` | Single transaction: INSERT venta → INSERT detalles → UPDATE stock → UPDATE jornada → StockMovimiento | For **Divisas**: same flow but store extra columns in ventas. Update `saldo_esperado` with ARS equivalent (total). |
| New logic | N/A | **Cuenta Cosas is NOT a sale** — needs separate service or method. Does NOT call VentaService. Still affects stock. |
| Risk | The `UPDATE jornadas` is hardcoded to add `total` to both columns. Pendiente requires conditional logic here. |

### 5. PosPage — `pos.page.ts` + `.html`

| What | Current | Needs |
|------|---------|-------|
| `confirmarVenta(formaPago)` | Calls `ventaService.registrar(jId, items, usuarioId, formaPago)` | For Divisas/Pendiente: needs to pass extra data. For Cuenta Cosas: entirely separate flow, not through this method. |
| UI | Single "Cobrar" button that opens checkout-modal | Cuenta Cosas needs its own button/flow, separate from checkout. Possibly a "Cuenta Cosas" action on the cart or a dedicated button near the cart. |
| Success message | "Venta registrada con éxito" | Different messages per type. |
| Spec | Tests only check success/error for `registrar()` | New flows need new tests. |

### 6. JornadaService — `jornada.service.ts`

| What | Current | Needs |
|------|---------|-------|
| `_ejecutarCierre()` | SELECT ventas + movimientos → build VentaConDetalles | Cuenta Cosas must be queried separately and included in the report data. |
| `_recolectarDatosJornada()` | Same | Same — new CuentaCosas query. |
| `_ejecutarCierre()` Excel call | Passes `ventasConDetalles` to ExcelService | Need to also pass `cuentaCosas` to ExcelService. |

### 7. ExcelService — `excel.service.ts`

| Sheet | Current | Needs |
|-------|---------|-------|
| **Resumen** | Total efectivo, Total transferencia, Total ventas + gastos + saldo | Add: Total divisas (with sub-breakdown EUR/USD), Pendientes (shown in parentheses per spec), Cuenta Cosas row (negative values) |
| **Ventas** | Column: Forma de pago shows 'efectivo'/'transferencia' | Show 'divisas' with currency info, 'pendiente' with comprador/autorizado. Extra columns or inline details. |
| **Movimientos** | No change needed | No change needed |
| **New sheet?** | N/A | Maybe a "Cuenta Cosas" sheet listing items taken with negative values |
| `VentaConDetalles` type | Extends Venta | Adding new optional fields to Venta would flow through here. Or create `VentaConDetalles` union type. |
| Specs | Test desglose efectivo/transferencia, forma_pago column, etc. | All need updating for new methods |

### 8. StockMovimientoService — `stock-movimiento.service.ts`

| What | Needs |
|------|-------|
| `registrarSalida()` | Already works for Cuenta Cosas — just call it with motivo describing it's C.C. No changes needed to this service. |

### 9. Tests That Will Break

| Spec | Tests | Impact |
|------|-------|--------|
| `checkout-modal.component.spec.ts` | formaPago default, button render, emit | **HIGH** — signal type changes from union of 2 to 4, template adds new sub-forms with conditional fields, output interface changes |
| `venta.service.spec.ts` | Mock-based, tests transaction pattern | **MEDIUM** — tests won't break structurally but new conditional logic for Pendiente (skip total_ventas) needs new tests |
| `pos.page.spec.ts` | confirmarVenta success/error | **LOW** — existing tests may still pass if signature compatible, but Cuenta Cosas flow is entirely new |
| `excel.service.spec.ts` | Resumen/Ventas structure | **HIGH** — Resumen sheet adds rows, Ventas sheet changes, new Cuenta Cosas sheet might be added |
| `sqlite.service.spec.ts` | Migration v5 tests | **MEDIUM** — new migration v6 tests needed, no existing test should break |
| `jornada.service.spec.ts` | _ejecutarCierre mocks | **MEDIUM** — if _ejecutarCierre queries cuenta_cosas table, existing mocks may need updating |

---

## Approaches

### Approach 1: Extend Venta interface + conditional service logic (Recommended)

Add nullable columns to `ventas` table, extend `Venta` interface with optional fields, and add conditional logic in `VentaService.registrar()`.

| Method | DB | How |
|--------|----|-----|
| **Divisas** | Extends ventas with `divisa_tipo`, `tasa_cambio` | Normal registrar() with extra columns in INSERT. Updates total_ventas + saldo_esperado normally. |
| **Pendiente** | Extends ventas with `comprador_nombre`, `autorizado_por`, `descripcion` | Modified registrar() — skips total_ventas + saldo_esperado update. Still affects stock. |
| **C.C.** | New `cuenta_cosas` table | Separate service. Separate UI button. Updates stock only. |

- **Pros**: Follows existing patterns, minimal new tables, discriminada por `forma_pago`
- **Cons**: Venta interface becomes bloated with optional fields, conditional logic in service
- **Effort**: High (this is a large change)

### Approach 2: Discriminated union types + polymorphic services

Keep `ventas` base table lean, use separate detail/linked tables for each payment type, use discriminated union pattern.

- **Pros**: Clean types, no optional bloat, each type is self-contained
- **Cons**: Over-engineered for this size, more JOINs, slower
- **Effort**: Very High

### Approach 3: Minimal — remove CHECK constraint, use JSON for extra data

Remove CHECK constraint entirely (validate in app). Store divisa/pendiente data as JSON in a single `extra_data TEXT` column on ventas.

- **Pros**: Maximum flexibility, no migration column additions needed
- **Cons**: No type safety, SQL can't query inside JSON easily, app-level validation only
- **Effort**: Medium

---

## Recommendation

**Approach 1** — extend `Venta` with optional fields and add conditional logic in `VentaService`. It's the most practical:

- Follows the existing pattern (v1→v5 migrations)
- Cuenta Cosas gets its own table because it's fundamentally NOT a sale
- Divisas and Pendiente ARE sales, just with different accounting treatment
- Modifies `VentaService.registrar()` to accept an options object instead of bare `formaPago: string`
- Modifies checkout modal output to emit a richer payload

### Cuenta Cosas Modeling Decision

**Separate table**, NOT a flag on ventas. Reasons:
1. Completely different semantics — NOT a sale, NOT revenue
2. No checkout process — products are taken, not sold through POS
3. Different accounting treatment — negative values in Resumen, not counted in total_ventas
4. Separate table means cleaner queries and no confusion in reporting
5. A `forma_pago = 'cuenta_cosas'` on ventas would still increment `total_ventas` (the current code does this unconditionally), which is wrong

---

## Risks

1. **Spec breakage is massive** — checkout-modal, ExcelService, VentaService specs all must be rewritten. This is not a small change.
2. **Cuenta Cosas stock handling** — must ensure stock IS decremented for C.C. even though no sale is registered. Call `StockMovimientoService.registrarSalida()` with motivo "Cuenta Cosas".
3. **Pendiente accounting** — current code unconditionally adds `total` to both `total_ventas` and `saldo_esperado`. Must introduce conditional logic. Risk of bug where Pendiente accidentally affects saldo_esperado.
4. **Divisas exchange rate** — what rate to use? User-provided (manual input) or system-calculated? Spec says "required" so user inputs it. Must validate rate > 0.
5. **Jornada close** — must now query `cuenta_cosas` table and include in Excel. Existing `_ejecutarCierre` will need an additional SQL query.
6. **Migration v6 order** — must run AFTER v5. If v5 already dropped v4's CHECK, v6 must work with v5's schema. The pattern of `CREATE TABLE ventas_v6 → INSERT SELECT → DROP → RENAME` is safe.
7. **Divisa in Excel desglose** — Resumen currently shows "Total efectivo" and "Total transferencia". Adding "Total divisas" is straightforward, but spec says EUR/USD sub-breakdown. That means grouping.
8. **Pendiente in Excel** — "shown in Resumen as separate line in parentheses". This is a design choice for the Excel layout.

---

## Ready for Proposal

**Yes**. The exploration is thorough enough to proceed to the proposal phase. The orchestrator should inform the user that:

1. Cuenta Cosas needs its own table (not a ventas flag) — confirmed by code analysis
2. Migration v6 is required with table recreation (existing safe pattern)
3. The checkout modal needs significant UI rework (sub-forms for divisa/pendiente data)
4. VentaService needs conditional accounting logic for Pendiente
5. Excel Resumen sheet needs 3 new line items
6. All tests in 6 spec files will require updates
7. Recommended approach: extend Venta interface with optional fields + separate Cuenta Cosas table
