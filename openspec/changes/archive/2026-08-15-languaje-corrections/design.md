# Design: languaje-corrections — Español neutro

## Technical Approach

Wrap Angular's `currency` behind a single domain pipe `pesos` bound to a `MONEDA_LOCAL` constant (`ARS`, hidden from UI); swap the 46 `currency:'ARS':'symbol-narrow':'1.0-0'` call-sites to `pesos:'1.0-0'`; neutralize 12 voseo strings and 2 grammar errors; relabel CUP/"pesos cubanos" Excel headers to "pesos". All changes are string-level — no data, calculation, or domain-value changes. Orchestrator decisions honored: docs argentinismos = no-goal; `es-AR` dates kept; `MONEDA_LOCAL` = constant.

Codebase verification deltas vs proposal: ARS call-sites are **46 across 8 templates** (proposal said 9); voseo source strings are **12** (proposal said 11). Evidence: `currency:'ARS'` grep + voseo grep in `src/`. Tasks use these verified counts.

## Architecture Decisions

### Decision: PesosPipe contract

**Choice**: standalone pipe `pesos` wrapping `CurrencyPipe` with `MONEDA_LOCAL` + `symbol-narrow`; single optional arg `digitsInfo` (default `'1.0-0'`).
**Alternatives considered**: keep `currency:'ARS'` (rejected: ARS reference remains in 46 templates); expose a currencyCode arg (over-flexible, re-opens ARS).
**Rationale**: all 46 call-sites use `'1.0-0'`, so one optional arg covers every case; symbol/currency are baked so ARS never appears in templates. ARS narrow symbol is `$` in both `es` and `en-US` → byte-identical output; existing `$`/`150,000` asserts stay green.
**Locale gotcha**: the pipe must `inject(LOCALE_ID)` — app provides `es` (app.config.ts:20), tests default to `en-US`. Hardcoding `'es'` breaks test output (`150.000` vs `150,000`). Do NOT hardcode.
**Out of replacement scope**: 2 divisa estimates at `checkout-modal.component.html:187` and `cobro-pendiente-modal.component.html:210` (`currency: divisaTipo()==='USD' ? 'USD' : 'EUR'`). Keep them.

### Decision: MONEDA_LOCAL as constant

**Choice**: `export const MONEDA_LOCAL = 'ARS'` in `src/app/core/constants.ts`.
**Alternatives considered**: `environment.*` files.
**Rationale**: the local currency is a business-domain invariant, not per-environment config (env files differ only by dbName/ttlDays/testMode). A constant cannot diverge per build, imports into the pipe without DI, and cannot appear in templates — the pipe name `pesos` is the template indirection. Multi-currency would be a settings feature, not env config.

## Voseo / grammar replacements (verified file:line)

| File:line | Original → Neutral |
|---|---|
| src/main.ts:21 | Contactá al desarrollador. → Contacte al desarrollador. |
| components/db-error/db-error.component.html:7 | Contactá al desarrollador para recuperar tus datos. → Contacte al desarrollador para recuperar sus datos. |
| components/checkout-modal/checkout-modal.component.html:203 | Completá con efectivo o aumentá el monto en divisa. → Complete con efectivo o aumente el monto en divisa. |
| components/checkout-modal/checkout-modal.component.html:328 | Reducí el billete o elegí otra forma de pago. → Reduzca el billete o elija otra forma de pago. |
| components/cobro-pendiente-modal/cobro-pendiente-modal.component.html:219 | same as checkout :203 |
| components/cobro-pendiente-modal/cobro-pendiente-modal.component.html:255 | same as checkout :328 |
| pages/inventario/inventario.page.ts:170 | Elegí la ubicación y el lote para el traslado → Elija la ubicación y el lote para el traslado |
| pages/historial/historial.page.ts:296 | Seleccioná fecha desde y hasta para exportar. → Seleccione fecha desde y hasta para exportar. |
| pages/inventario/inventario.page.html:267 | Seleccioná la ubicación… → Seleccione la ubicación… |
| pages/inventario/inventario.page.html:280 | Seleccioná un lote… → Seleccione un lote… |
| pages/historial/historial.page.html:204 | Abrí una jornada desde la página de Jornada. → Abra una jornada desde la página de Jornada. |
| pages/pos/pos.page.html:61 | Iniciá el día en Jornada. → Inicie el día en Jornada. |
| components/ttl-expired/ttl-expired.component.html:7 | La acceso finalizó el → El acceso finalizó el |
| pages/jornada/jornada.page.ts:209 | 'Error al registro' → 'Error al registrar' |

## Data Flow

```
Template ──| pesos:'1.0-0' ──► PesosPipe.transform
  value ──► CurrencyPipe.transform(value, MONEDA_LOCAL='ARS', 'symbol-narrow', '1.0-0')
  ──► "$1.500" (app, es)  |  "$1,500" (tests, en-US)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/core/constants.ts` | Create | `MONEDA_LOCAL = 'ARS'` |
| `src/app/pipes/pesos.pipe.ts` | Create | standalone `PesosPipe` |
| `src/app/pipes/pesos.pipe.spec.ts` | Create | pipe contract tests |
| 8 templates (checkout-modal, cart-item-row, cobro-pendiente-modal, producto, pos, product-card, quantity-input, historial) | Modify | 46 `currency:'ARS':'symbol-narrow':'1.0-0'` → `pesos:'1.0-0'` |
| 8 components/pages (same list + historial.page.ts, producto.page.ts) | Modify | `imports` swaps `CurrencyPipe` → `PesosPipe` (keep DatePipe/DecimalPipe/FormsModule) |
| 8 source files (voseo/grammar, per table) | Modify | string replacements |
| `services/excel.service.ts` | Modify | :190 `'Total divisas en pesos cubanos'`→`'Total divisas en pesos'`; :709 `'Total CUP'`→`'Total en pesos'`. Values/columns of data untouched. |
| 10 spec files | Modify | see Testing |

## Interfaces / Contracts

```ts
@Pipe({ name: 'pesos', standalone: true })
export class PesosPipe implements PipeTransform {
  transform(value: number | string | null | undefined, digitsInfo = '1.0-0'): string | null;
}
```
Template usage: `{{ v | pesos:'1.0-0' }}` (or `{{ v | pesos }}`). Registration: add `PesosPipe` to the `imports` array of every component whose template uses it (standalone).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (new) | pipe equivalence | `pesos.pipe.spec.ts`: `transform(500,'1.0-0') === '$500'`; equals CurrencyPipe(ARS, symbol-narrow, '1.0-0') output |
| Unit (7 template specs) | pipe registered | checkout-modal, cart-item-row, cobro-pendiente-modal, producto, pos, product-card, historial: add `PesosPipe` to TestBed imports; format asserts unchanged (quantity-input has no spec) |
| Unit (string asserts) | new expected values | db-error spec: Contacte; ttl-expired spec: El acceso (lines 48/53); historial spec:510 Seleccione; excel spec:671/1613 pesos labels |
| Full | suite green | `bunx vitest run` |

RED→GREEN order per area: (1) pipe spec RED (no pipe) → create pipe → GREEN; (2) template specs RED (unknown pipe NG0302 after swap, before import) → add import → GREEN; (3) string asserts updated first (RED) → fix source → GREEN.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Rollback: work-unit commits (pipe → templates → strings → excel) are independently revertable; removing `PesosPipe` and restoring `currency:'ARS'` returns exact prior output.

## Open Questions

None blocking. Count deltas vs proposal (9→8 templates, 11→12 voseo strings) are resolved in favor of codebase evidence; spec count 8→10 files (7 pipe-registration + db-error + ttl-expired + excel, historial spans both areas).
