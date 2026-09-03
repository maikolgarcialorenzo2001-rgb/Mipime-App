# Verification Report: stock-unit-type (unidades vs gramaje)

**Change**: `stock-unit-type`
**Branch**: `feat/stock-unit-type`
**Mode**: Strict TDD (runner: `ng test`/Vitest via `bun run test`)
**Status**: **GREEN** (all tests pass; see WARNING-level coverage notes)
**Date**: 2026-09-03

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 18 (`1.1–8.1`) |
| Tasks complete | 18 (all `[x]` in tasks.md) |
| Tasks incomplete | 0 |

All tasks in `openspec/changes/stock-unit-type/tasks.md` are marked complete; apply-progress reports "Implemented — verified GREEN". The verification below cross-checks this against runtime execution (not just the report).

---

## Build & Tests Execution

**Build (test bundle compile)**: ✅ Passed — after isolating 5 pre-existing broken admin-setup specs (see Isolation note).

**Tests**: ✅ **939 passed | 2 skipped | 0 failed** (49 test files passed, 1 skipped, of 50)

```text
PATH="/c/nvm4w/nodejs:$PATH" bun run test -- --watch=false
Test Files:  49 passed | 1 skipped (50)
Tests:       939 passed | 2 skipped | 0 failed
```

All stock-unit-type relevant spec files built and ran (their bundles appear in the compiled output) and all their tests passed within the 939-passing aggregate. Per-file counts (from source):

| Spec file | Tests |
|-----------|-------|
| `components/stock-badge/stock-badge.component.spec.ts` | 8 |
| `components/quantity-input/quantity-input.component.spec.ts` | 10 |
| `components/cart-item-row/cart-item-row.component.spec.ts` | 10 |
| `services/cart.service.spec.ts` | 17 |
| `services/db-migrations.spec.ts` | 17 |
| `pages/inventario/inventario.page.spec.ts` | 73 |
| `pages/pos/pos.page.spec.ts` | 20 |
| `components/product-card/product-card.component.spec.ts` | 3 |
| `pages/productos/producto.page.spec.ts` | 48 |

**Coverage**: ➖ Not run (coverage tooling not requested; quality metric informational per Strict TDD verify — not a failure).

### Isolation note (pre-existing baseline failures, NOT part of this change)

The repo's `feat/stock-unit-type` branch **diverges from `main`** and does NOT contain the admin-setup-flow spec fix (commit `09a0a0c`). The following 5 broken specs block the Angular unit-test builder compile, so they were temporarily moved out of `src/` to unblock the build, then restored **byte-identical** (verified by md5, `git status` clean afterwards):

- `src/app/pages/setup/setup.page.spec.ts` — mock-typing TS errors
- `src/app/pages/setup/setup.page.integration.spec.ts` — mock-typing TS errors
- `src/app/guards/setup.guard.spec.ts` — mock-typing TS errors
- `src/app/pages/admin/admin.page.spec.ts` — mock-typing TS errors
- `src/app/services/setup.service.spec.ts` — `vi.mock` on relative import unsupported by Angular runner

These are unrelated to `stock-unit-type` and were left untouched.

---

## Spec Compliance Matrix

Source: `openspec/specs/inventario-operaciones/spec.md` + `openspec/changes/stock-unit-type/specs/checkout/spec.md`. (Note: the spec text says "V12"; `design.md` documents this as a known typo — the intended migration is **V19**, which is what is implemented. See Coherence.)

### inventario-operaciones

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 DB migration V19 `unidad_medida` | Column exists after migration / existing rows default `'unidad'` | `db-migrations.spec.ts` > "migration v19 adds unidad_medida column defaulting to unidad..." | ✅ COMPLIANT |
| REQ-1 (cont.) | New product stores `unidad_medida` | `producto.service.spec.ts` INSERT includes `unidad_medida` (+ `?? 'unidad'` default) | ✅ COMPLIANT |
| REQ-2 Producto interface + UNIDAD_MEDIDA | Type narrowing / union | Interface + map present; all Producto fixtures compile | ✅ COMPLIANT |
| REQ-3 Registration unit-type selector | Create with unidad / create with gramaje | `inventario.page.spec.ts` > "21. save calls crear" + "TDD: guardarProducto pasa unidad_medida gramaje" | ✅ COMPLIANT |
| REQ-3 (cont.) | Form validation — no selection blocks submit | No covering test; state unreachable by design (signal always defaults) | ⚠️ UNTESTED / N/A |
| REQ-4 Stock badge dynamic suffix | "5 u." / "2.5 lb" | `stock-badge.component.spec.ts` (suffix assertions) | ✅ COMPLIANT |
| REQ-5 Lot selectors dynamic suffix | "10u" / "3.2lb" | Implemented via `sufijoDe()` in template; **no direct passing test** asserts suffix rendering | ⚠️ UNTESTED (implemented, not directly covered) |
| REQ-6 Stock toast dynamic suffix | "15 u" / "4.7 lb" | `inventario.page.spec.ts` > toast "80 u./7 u." + "80 lb/7 lb" | ✅ COMPLIANT |

### checkout (delta)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| MOD-1 Quantity-input decimal/inputmode/step | integer vs decimal filter, inputmode, max 2 decimals, ±step, label | `quantity-input.component.spec.ts` (10 tests) + `cart.service.spec.ts` (±0.1/±1) | ✅ COMPLIANT (step via cart.service; see Coherence note) |
| ADD-1 POS keyboard ±step | gramaje 2.0→2.1, unidad 3→2 | POS wiring uses `cart.incrementar/decrementar`; logic tested in `cart.service.spec.ts`; no direct POS-level keydown test | ⚠️ PARTIAL (underlying logic tested; POS wiring not directly covered) |

**Compliance summary**: 8 fully COMPLIANT; 2 ⚠️ (REQ-5 UNTESTED directly, ADD-1 PARTIAL); 1 ⚠️ UNTESTED/N/A (REQ-3 no-selection).

---

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| DB migration V19 | ✅ Implemented | `migrationV19` (try/catch idempotent), runner `if (currentVersion < 19)`. Existing rows → default `'unidad'` (no data loss). Header comment "v1–v19" (task 8.1). |
| Producto interface + map | ✅ Implemented | `UnidadMedida`, `UNIDAD_MEDIDA {suffix, step, allowsDecimal}`, required field. |
| Display suffix propagation | ✅ Implemented | `[unidadMedida]` passed on all 5 badges (inventario ×2, product-card, producto.page ×2); 3 lot selectors via `sufijoDe()`; toast via `actualizado.unidad_medida`. |
| Registration form | ✅ Implemented | Radio "Unidad"/"Gramaje", default `'unidad'`, reset on open/close, passed to `crear({unidad_medida})`. |
| Quantity-input decimal | ✅ Implemented | Conditional `permiteDecimal`/`inputmode`/`paso`/`sufijo` from `producto().unidad_medida`; max 2 decimals. |
| Cart ±step | ✅ Implemented | `stepPara()`/`incrementar()`/`decrementar()` with `_redondear` (0.1 steps, float-safe). POS Backspace + cart-item-row ± buttons use them. |
| Dynamic label "c/u" vs "por lb" | ✅ Implemented | quantity-input + cart-item-row. |
| MAX_STOCK rename | ✅ Implemented | `MAX_STOCK_UNIDADES` → `MAX_STOCK_CANTIDAD` (task 1.4), 2 refs + spec updated. |

---

## Coherence (Design)

All architecture decisions from `design.md` are followed:

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Migration **V19** (not V12) | ✅ Yes | Spec typo documented in design; V19 is correct (V12 taken by `total_gastos→total_movimientos`). |
| `UNIDAD_MEDIDA` map in `models/producto.ts` | ✅ Yes | Single source of truth; colocated with type. |
| Badge via input pass-through; pages derive inline | ✅ Yes | `sufijoDe()` in inventario; `UNIDAD_MEDIDA` in toast. |
| Quantity-input reuses `producto` input (not new `unidad` prop) | ✅ Yes | `producto().unidad_medida`. |
| Step behavior in `cart.service` | ✅ Yes | `stepPara`/`incrementar`/`decrementar`. |
| MAX_STOCK rename | ✅ Yes | `MAX_STOCK_CANTIDAD`. |

**Note on step location**: checkout spec MOD-1 describes the ±step living in the quantity-input component, but the design + tasks move it to `cart.service` (the quantity-input component is a quantity-confirm modal with no ± buttons; ± happens in cart-item-row/POS). The behavior is functionally equivalent and tested. The `paso` computed in `quantity-input.component.ts` is currently **unused dead code** (see Issues).

---

## Issues Found

**CRITICAL**: None.

**WARNING**:
- **REQ-5 (lot-selector dynamic suffix) not directly covered by a passing test.** Implemented correctly in `inventario.page.html` via `sufijoDe(producto)` (3 lot selectors) but no spec test asserts the "10u"/"3.2lb" rendering. Behavior verified by source inspection only.
- **ADD-1 (POS keyboard shortcut ±step) has no direct POS-level test.** The wiring is correct (`pos.page.ts` Backspace → `cart.decrementar`, and `.html` ± buttons → `cart.incrementar/decrementar`) and the step logic is unit-tested in `cart.service.spec.ts`, but no test drives a `keydown` at the POS layer asserting "gramaje 2.0→2.1" / "unidad 3→2".
- **REQ-3 "no selection" validation not exercised** (and arguably unreachable by the always-defaulted union design). The spec anticipated a nullable selection with a blocked submit; the implementation uses a non-nullable `UnidadMedida` signal defaulting to `'unidad'`, so no unselected state exists. Consider whether this satisfies the requirement (functionally a product can never be saved without a unit type) or needs an explicit validation test.

**SUGGESTION**:
- `quantity-input.component.ts` declares a `paso` computed (line 25) that is not referenced in the template (the component has no ± buttons; stepping lives in cart.service/POS). Remove the dead computed to avoid confusion, or if ± buttons are added to the modal, wire them to it.
- The two spec docs (inventario-operaciones REQ-1, checkout) reference "V12"; `design.md` correctly overrides to V19. Consider correcting the spec files to V19 so future readers are not misled.

---

## TDD Compliance (Strict TDD)

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress.md "Phase 7 — TDD Specs" documents RED→GREEN for each task. |
| All tasks have tests | ✅ | Test files exist for every task phase (migration, badge, quantity-input, cart, cart-item-row, inventario, pos). |
| RED confirmed (tests exist) | ✅ | 9 relevant spec files verified present. |
| GREEN confirmed (tests pass) | ✅ | Full suite 939 passed / 0 failed (isolated from 5 baseline-broken specs). |
| Triangulation adequate | ⚠️ | REQ-5 (lot suffix) has no direct test; ADD-1 POS layer not directly tested. |
| Safety Net for modified files | ✅ | No production source modified during verification; only test files isolated & restored. |

**TDD Compliance**: 5/6 checks fully pass; 1 partial (triangulation gaps noted as WARNING).

---

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~207 (across the 9 relevant specs) | 9 | Vitest + Angular TestBed |
| Integration | 0 new | — | — |
| E2E | 0 | — | — |

All stock-unit-type tests are unit-level (component + service + page unit tests via TestBed). No integration/E2E coverage for this change.

---

## Assertion Quality

**Assertion quality**: ✅ All assertions in the reviewed stock-unit-type specs verify real behavior (suffix text, inputmode attribute, `preventDefault` outcomes, step arithmetic, toast messages, `crear()` payloads). No tautologies, ghost loops, or type-only standalone assertions found.

---

## Quality Metrics

**Linter**: ➖ Not run (not requested).
**Type Checker**: ✅ Angular build compiled clean (no TS errors) after isolating the 5 baseline-broken specs; all stock-unit-type source/spec files type-check.

---

## Verdict

**PASS** (GREEN) — all tests pass (939/0), all tasks complete, all source-level REQ implemented and verified by inspection, and core REQ (migration, badge, toast, quantity-input, cart step, registration form) are covered by passing tests. Three scenarios carry WARNING-level coverage notes rather than CRITICAL: REQ-5 lot-suffix not directly tested, ADD-1 POS keyboard layer not directly tested, and REQ-3 "no selection" unreachable/untested. None of these represent broken functionality.

**Recommendation**: ship the change; add the 3 WARNING-level tests as fast-follows before archive.
