# Archive Report: bugfixes-julio-2026

**Date**: 2026-07-24
**Mode**: hybrid (engram + openspec)
**Status**: ✅ COMPLETE

## Summary

Four confirmed bugs affecting daily POS operations were identified, specified, designed, implemented, verified, and archived through the full SDD cycle. All 7 tasks completed, all 332 tests passing (331 original + 1 bonus), and 12 new test cases added.

## Bugs Fixed

| # | Bug | Domain | Severity | Files Changed |
|---|-----|--------|----------|---------------|
| 1 | Login horizontal scrollbar | login | Low | `src/styles.css` |
| 2 | CuentaCosas Excel total ignores precio_costo | excel-reportes | High | `src/app/services/excel.service.ts`, `src/app/services/excel.service.spec.ts` |
| 3 | Ventas "Total ingresos" includes pending sales | excel-reportes | High | `src/app/services/excel.service.ts`, `src/app/services/excel.service.spec.ts` |
| 4 | Divisas checkout: montoDivisa manual, no vuelto | checkout | Medium | `src/app/components/checkout-modal/checkout-modal.component.ts`, `checkout-modal.component.html`, `checkout-modal.component.spec.ts` |

## Artifacts

| Artifact | Engram ID | Topic Key |
|----------|-----------|-----------|
| Proposal | #301 | `sdd/bugfixes-julio-2026/proposal` |
| Spec (delta) | #302 | `sdd/bugfixes-julio-2026/spec` |
| Design | #303 | `sdd/bugfixes-julio-2026/design` |
| Tasks | #304 | `sdd/bugfixes-julio-2026/tasks` |
| Verify Report | #307 | `sdd/bugfixes-julio-2026/verify-report` |
| **Archive Report** | — | `sdd/bugfixes-julio-2026/archive-report` |

## Files Modified

| File | Change |
|------|--------|
| `src/styles.css` | Added `body { overflow-x: hidden; }` |
| `src/app/services/excel.service.ts` | Bug 2: CC uses `cantidad × precio_costo`; Bug 3: split total into SinPendientes/Pendientes |
| `src/app/services/excel.service.spec.ts` | 8 new tests for CC precio_costo + Ventas pendientes split |
| `src/app/components/checkout-modal/checkout-modal.component.ts` | Bug 4: `montoDivisa` → computed, added `vuelto` computed |
| `src/app/components/checkout-modal/checkout-modal.component.html` | Bug 4: readonly input, vuelto display, disabled confirm |
| `src/app/components/checkout-modal/checkout-modal.component.spec.ts` | Bug 4: updated divisa tests for computed values |
| `src/app/services/theme.service.spec.ts` | **Bonus fix**: added `beforeEach` cleanup for dark mode state leak |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| login | Created | 1 new requirement: body overflow-x hidden |
| checkout | Created | 1 requirement: divisas computed signals (supersedes C11) |
| excel-reportes | Created | 2 requirements: CC precio_costo calc + Ventas pendientes split |

Main specs created at:
- `openspec/specs/login/spec.md`
- `openspec/specs/checkout/spec.md`
- `openspec/specs/excel-reportes/spec.md`

## Test Results

| Metric | Value |
|--------|-------|
| Total tests | 332 |
| Passing | 332 |
| Failing | 0 |
| New tests added | 12 |
| Bonus fix | `theme.service.spec.ts` — `beforeEach` cleanup resolved pre-existing flaky dark mode test |

## Bonus Fix

The pre-existing `theme.service.spec.ts` test failure ("debería iniciar en modo claro por defecto") was caused by missing `beforeEach` cleanup — the ThemeService retained dark mode state from previous tests. Added a `beforeEach(() => TestBed.resetTestingModule())` block that resolved the flaky test, bringing the total from 331 → 332 passing.

## SDD Cycle Complete

| Phase | Status |
|-------|--------|
| Proposal | ✅ #301 |
| Spec | ✅ #302 |
| Design | ✅ #303 |
| Tasks | ✅ #304 |
| Apply | ✅ 7/7 tasks |
| Verify | ✅ #307 — APPROVED |
| Archive | ✅ This report |

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
