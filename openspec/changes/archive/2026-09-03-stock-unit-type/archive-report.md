# Archive Report: stock-unit-type (unidades vs gramaje)

**Change**: `stock-unit-type`
**Branch**: `feat/stock-unit-type` (LOCAL ONLY — not pushed, not merged to main)
**Status**: **COMPLETE**
**Date**: 2026-09-03
**Verify verdict**: PASS (GREEN) — 939 tests passed | 2 skipped | 0 failed, all 18 tasks complete.
**SDD cycle**: 📦 Archived — proposal → spec → design → tasks → apply → verify → archive all complete.

---

## 1. Final State

| Field | Value |
|-------|-------|
| Status | COMPLETE (GREEN) |
| Verify verdict | PASS |
| Tests | 939 passed / 0 failed |
| Tasks | 18/18 complete |
| Delivery | Local branch `feat/stock-unit-type` only — NO push, NO merge to main |
| Gramaje scope | Per user decision, lives ONLY on this local branch |

Implementation delivered: per-product `unidad_medida: 'unidad' | 'gramaje'` field (migration V19 + model + `UNIDAD_MEDIDA` map) driving dynamic unit suffixes (stock-badge, lot selectors, toasts), decimal-capable quantity input, and per-product ±step (0.1 gramaje / 1 unidad) across POS and cart.

---

## 2. Artifacts Location

### Filesystem (openspec)

| Artifact | Path |
|----------|------|
| Proposal | `openspec/changes/archive/2026-09-03-stock-unit-type/proposal.md` |
| Spec (delta) | `openspec/changes/archive/2026-09-03-stock-unit-type/specs/checkout/spec.md` |
| Design | `openspec/changes/archive/2026-09-03-stock-unit-type/design.md` |
| Tasks | `openspec/changes/archive/2026-09-03-stock-unit-type/tasks.md` |
| Apply-progress | `openspec/changes/archive/2026-09-03-stock-unit-type/apply-progress.md` |
| Verify-report | `openspec/changes/archive/2026-09-03-stock-unit-type/verify-report.md` |
| **Archive-report** | **`openspec/changes/archive/2026-09-03-stock-unit-type/archive-report.md`** (this file) |
| Main spec (inventario-operaciones) | `openspec/specs/inventario-operaciones/spec.md` |
| Main spec (checkout) | `openspec/specs/checkout/spec.md` |

### Engram (topic keys, project `mipime-app`)

| Artifact | Observation ID | Topic key |
|----------|----------------|-----------|
| Design | #634 | `sdd/stock-unit-type/design` |
| Apply-progress | #637 | `sdd/stock-unit-type/apply-progress` |
| Verify-report | #643 | `sdd/stock-unit-type/verify-report` |
| Archive-report | (see escape) | `sdd/stock-unit-type/archive-report` |

---

## 3. Spec Sync — Delta → Main

| Domain | Action | Details |
|--------|--------|---------|
| `inventario-operaciones` | Updated | REQ-1 heading + scenario corrected **V12 → V19**; added explicit drift note |
| `checkout` | Updated | Merged delta MOD-1 (quantity input conditional decimal) + ADD-1 (POS keyboard ±step) requirements + scenarios into main check spec |

Migration reconciliation: proposal/spec text referenced **V12**; implementation used **V19** (correct — `db-migrations.ts` was at V18 before this change, and V12 is taken by `total_gastos → total_movimientos`). **Canonical = V19.** Main inventario-operaciones spec now reads V19 and carries a drift note so future readers see no inconsistency.

---

## 4. Fast-follow WARNING Items (from verify) — NOT YET DONE

These are tracked from the verify-report as intentional coverage gaps. Ship was approved (PASS) but three warning items plus one dead-code item remain:

| # | Item | Detail | Priority |
|---|------|--------|----------|
| W1 | Direct test for lot-selector suffix (REQ-5) | Implemented via `sufijoDe()` in `inventario.page.html` (3 lot selectors) but no passing test asserts "10u"/"3.2lb" rendering. | Fast-follow |
| W2 | Direct POS-layer test for keyboard ±step (ADD-1) | Logic unit-tested in `cart.service.spec.ts` and wired via `pos.page.ts` Backspace + `.html` ±, but no test drives a POS `keydown` asserting "gramaje 2.0→2.1" / "unidad 3→2". | Fast-follow |
| W3 | Clarify REQ-3 "no-selection" validation | Unreachable by design: `formUnidadMedida` signal is non-nullable and always defaults `'unidad'`, so no unselected state exists. Decide whether a validation test is needed or the requirement is satisfied structurally. | Clarify |
| S1 | Dead code: unused `paso` computed | `quantity-input.component.ts` line ~25 declares a `paso` computed not referenced in the template (no ± buttons in that modal; stepping lives in cart.service/POS). Remove it, or wire ± buttons to it if added. | Cleanup |

---

## 5. Delivery / Snapshot

- The change lives **ONLY** on local branch `feat/stock-unit-type` (commit `5d2634e`).
- NOT pushed, NOT merged to main. Gramaje stays local per user decision.
- Working tree on that branch reflects the full change (source + tests); verify ran clean there.

---

## 6. Baseline Divergence — MUST RESOLVE BEFORE MERGE TO MAIN

This branch **diverges from `main`** and does NOT contain the admin-setup spec fix (commit `09a0a0c`). Consequence: 5 broken specs on this branch (setup.page, setup.page.integration, setup.guard, admin.page, setup.service) block the Angular unit-test builder compile. Verify had to temporarily isolate and restore them byte-identical to unblock the run.

**Action required**: before ever merging `feat/stock-unit-type` to main, rebase or merge from main to pick up the admin-setup fix (`09a0a0c`). Do NOT merge this branch to main while the divergence exists.

---

## 7. Risks & Next Recommended

**Risks:**
- Medium: W1–W3 coverage gaps — behavior implemented and inspected, but not directly pinned by tests. Regression could go unnoticed.
- Medium: baseline divergence must be resolved before any merge to main; ignoring it re-blocks the test builder.
- Low: dead `paso` computed could mislead future readers into thinking stepping happens in quantity-input.

**Next recommended:**
1. Fast-follow tests (W1 lot-suffix, W2 POS keydown) before relying on this feature long-term.
2. Resolve REQ-3 clarification (W3) with the owner.
3. Remove dead `paso` computed (S1).
4. When ready to merge to main: rebase/merge to pick up `09a0a0c`, re-run the full suite, then merge.
