# Tasks: languaje-corrections — Español neutro

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~230 (200–260) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | PesosPipe + MONEDA_LOCAL | PR 1 | `bunx vitest run src/app/pipes/pesos.pipe.spec.ts` | N/A — no e2e harness; vitest specs are the harness | Delete pipe + constants.ts |
| 2 | 46 call-sites → `pesos` + imports | PR 1 | `bunx vitest run src/app` | N/A — vitest specs are the harness | Revert template + import swaps |
| 3 | 14 neutral strings | PR 1 | `bunx vitest run src/app/components/db-error src/app/components/ttl-expired src/app/pages/historial` | N/A — string-only | Revert string edits |
| 4 | Excel labels | PR 1 | `bunx vitest run src/app/services/excel.service.spec.ts` | N/A — string-only | Revert labels |

## Phase 1: Foundation (RED→GREEN)

- [x] 1.1 RED: create `src/app/pipes/pesos.pipe.spec.ts` — `transform(500,'1.0-0')` must equal CurrencyPipe(ARS,'symbol-narrow','1.0-0') output; fails (no pipe)
- [x] 1.2 GREEN: create `src/app/core/constants.ts` with `export const MONEDA_LOCAL = 'ARS'`
- [x] 1.3 GREEN: create standalone `src/app/pipes/pesos.pipe.ts` wrapping CurrencyPipe via `inject(LOCALE_ID)` — never hardcode 'es' (tests run en-US)
- [x] 1.4 Verify: pipe spec green

## Phase 2: Templates migration (RED→GREEN)

- [x] 2.1 RED: swap 46 `currency\s*:\s*'ARS':'symbol-narrow':'1.0-0'` → `pesos` in 8 templates (checkout-modal, cart-item-row, cobro-pendiente-modal, producto, pos, product-card, quantity-input, historial); KEEP divisa exceptions checkout-modal.html:187 and cobro-pendiente-modal.html:210; run 7 template specs → NG0302 unknown pipe (RED)
- [x] 2.2 GREEN: swap `CurrencyPipe` → `PesosPipe` in imports of the 8 component/page .ts files (keep DatePipe/DecimalPipe/FormsModule)
- [x] 2.3 GREEN: add `PesosPipe` to TestBed imports in 7 template specs (checkout-modal, cart-item-row, cobro-pendiente-modal, producto, pos, product-card, historial); format asserts unchanged (quantity-input has no spec)
- [x] 2.4 Verify: affected specs green

## Phase 3: Neutral language (RED→GREEN)

- [x] 3.1 RED: update asserts — db-error.spec.ts:40/42 ('Contacte'), ttl-expired.spec.ts:48/53 ('El acceso'), historial.page.spec.ts:510 ('Seleccione')
- [x] 3.2 GREEN: apply 14 design-table replacements — main.ts:21, db-error.html:7, checkout-modal.html:203/328, cobro-pendiente-modal.html:219/255, inventario.page.ts:170, historial.page.ts:296, inventario.page.html:267/280, historial.page.html:204, pos.page.html:61, ttl-expired.html:7, jornada.page.ts:209
- [x] 3.3 Verify: affected specs green

## Phase 4: Excel labels (RED→GREEN)

- [x] 4.1 RED: update excel.service.spec.ts:671 → 'Total divisas en pesos', :1613 → 'Total en pesos'
- [x] 4.2 GREEN: excel.service.ts:190 → 'Total divisas en pesos', :709 → 'Total en pesos'
- [x] 4.3 Verify: excel spec green

## Phase 5: Verification / closing greps

- [x] 5.1 Full suite green: `bunx vitest run`
- [x] 5.2 Grep: 0 `currency\s*:\s*'ARS'` in src/ templates (matches compact AND spaced syntax)
- [x] 5.3 Grep: 0 voseo imperatives (Completá/Seleccioná/Reducí/Elegí/Abrí/Iniciá/Contactá/aumentá) and 0 'La acceso'/'Error al registro' in src/
- [x] 5.4 Grep: 0 'CUP'/'pesos cubanos' in src/ UI and Excel labels
