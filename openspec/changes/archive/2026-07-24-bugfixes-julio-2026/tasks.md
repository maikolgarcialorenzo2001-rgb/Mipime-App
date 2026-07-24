# Tasks: bugfixes-julio-2026

## Workload
- Review Workload Forecast: Low
- Estimated total lines: ~100
- Chained PRs recommended: No
- Decision needed before apply: No

## Bug 1: Login Scrollbar (CSS)

- [ ] **Task 1.1**: Add `overflow-x: hidden` to body in `src/styles.css` (~5 lines)
  - **Files**: `src/styles.css`
  - **Test**: CSS via `getComputedStyle(document.body).overflowX === 'hidden'` — or visual verification
  - **Notes**: Add after the existing transition rules, e.g. `body { overflow-x: hidden; }`

## Bug 2: Excel CuentaCosas Total

The "Total" column and "Total C.C." footer in the CuentaCosas table must use `−(cantidad × precio_costo)` from `productosMap` instead of `−cantidad`. When `precio_costo` is null, treat as 0.

- [ ] **Task 2.1**: Fix `_agregarResumen` CC calculation in `excel.service.ts` (~15 lines)
  - **Files**: `src/app/services/excel.service.ts`
  - **Changes**:
    - Line 118: `const valor = -(item.cantidad * (info?.precio_costo ?? 0));`
    - Line 119: `totalCc += item.cantidad * (info?.precio_costo ?? 0);`
    - Line 122: Keep `-totalCc` (it already sums the cost-based values correctly)
  - **Test**: `src/app/services/excel.service.spec.ts` — verify CC total = `-(cantidad × precio_costo)` with `productosMap`

- [ ] **Task 2.2**: Fix `_agregarJornadaSheet` CC calculation in `excel.service.ts` (~15 lines)
  - **Files**: `src/app/services/excel.service.ts`
  - **Changes**:
    - Line 341: `totalCc += item.cantidad * (info?.precio_costo ?? 0);`
    - Line 345: Show `-(item.cantidad * (info?.precio_costo ?? 0))` instead of `-item.cantidad`
  - **Test**: `src/app/services/excel.service.spec.ts` — verify jornada sheet CC total

## Bug 3: Pendientes in Ventas Total

The "Total ingresos" footer row must exclude `forma_pago='pendiente'` ventas. Add a "Pendientes del día" row and "Total esperado" row (sum of both). Applies to `_agregarVentas` and `_agregarJornadaSheet` only. The standalone `_agregarResumen` method keeps its current behavior (parenthetical pendiente line).

- [ ] **Task 3.1**: Split accumulator in `_agregarVentas` (~30 lines)
  - **Files**: `src/app/services/excel.service.ts`
  - **Changes**:
    - Replace `let granTotal = 0` with `let totalSinPendientes = 0` and `let totalPendientes = 0`
    - In the inner loop (line 150–182): conditionally add to the correct accumulator based on `venta.forma_pago`
    - Replace single footer (lines 185–189) with three rows:
      1. `['Total ingresos', '', '', '', totalSinPendientes, '']`
      2. `['Pendientes del día', '', '', '', totalPendientes, '']`
      3. `['Total esperado', '', '', '', totalSinPendientes + totalPendientes, '']`
    - Handle conditional columns in footer: if `tieneDivisas` or `tienePendientes`, the footer array length must match `footerLen` exactly
  - **Test**: `src/app/services/excel.service.spec.ts` — 3 scenarios from spec: mixed, only-pendientes, no-pendientes

- [ ] **Task 3.2**: Split accumulator in `_agregarJornadaSheet` (~30 lines)
  - **Files**: `src/app/services/excel.service.ts`
  - **Changes**:
    - Same pattern as Task 3.1: split `granTotal` (line 301) into `totalSinPendientes` and `totalPendientes`
    - Replace single footer (line 319) with three rows matching the same format
    - Footer has 6 columns (no conditional extra columns in jornada sheet — it uses a fixed header)
  - **Test**: `src/app/services/excel.service.spec.ts` — verify jornada sheet totals

## Bug 4: Divisas Redesign

Convert `montoDivisa` from a writable signal to a `computed` signal derived from `total()` and `tasaCambio()`. Add `vuelto` computed. Update template: readonly input, vuelto display, prevent confirm when tasa is invalid.

- [ ] **Task 4.1**: Convert `montoDivisa` to computed signal in `checkout-modal.component.ts` (~35 lines)
  - **Files**: `src/app/components/checkout-modal/checkout-modal.component.ts`
  - **Changes**:
    - Add `computed` to the Angular imports (line 1: `import { Component, input, output, signal, computed } from '@angular/core';`)
    - Replace `readonly montoDivisa = signal<number | null>(null)` with:
      ```typescript
      readonly montoDivisa = computed<number | null>(() => {
        const tasa = this.tasaCambio();
        const t = this.total();
        if (tasa == null || tasa <= 0 || t <= 0) return null;
        return Math.ceil(t / tasa);
      });
      ```
    - Add `vuelto` computed signal:
      ```typescript
      readonly vuelto = computed<number | null>(() => {
        const md = this.montoDivisa();
        const tasa = this.tasaCambio();
        const t = this.total();
        if (md == null || tasa == null || tasa <= 0) return null;
        return md * tasa - t;
      });
      ```
    - **Note**: `venta.service.ts` needs NO changes — it already consumes `payload.montoDivisa` from the checkout modal's `onConfirmar()` without modification
  - **Test**: `src/app/components/checkout-modal/checkout-modal.component.spec.ts` — verify computed calculation (null when tasa=0/null, exact Math.ceil)

- [ ] **Task 4.2**: Update HTML template for readonly input + vuelto display (~25 lines)
  - **Files**: `src/app/components/checkout-modal/checkout-modal.component.html`
  - **Changes**:
    - Line 162-169: Replace `montoDivisa` input with readonly version:
      - Change `[ngModel]="montoDivisa()"` to `[value]="montoDivisa()"` (one-way binding)
      - Add `readonly` attribute
      - Remove `(ngModelChange)="montoDivisa.set($event)"`
    - Add vuelto display row after the tasaCambio input (after line 179):
      ```html
      @if (montoDivisa() != null && vuelto()! > 0) {
        <div class="text-sm text-green-600 dark:text-green-400">
          Vuelto: {{ vuelto() | currency:'ARS':'symbol-narrow':'1.0-0' }}
        </div>
      }
      ```
    - Disable confirm button when divisa tasa is invalid — add condition inside `onConfirmar()` in component.ts, or add `[disabled]` on the confirm button in the template when `formaPago() === 'divisas' && (tasaCambio() == null || tasaCambio()! <= 0)`
  - **Test**: `src/app/components/checkout-modal/checkout-modal.component.spec.ts` — verify template renders vuelto, input is readonly

## Dependency Graph

```
Task 1.1 ─── independent
Task 2.1 ───→ Task 2.2   (same file, must be sequential)
Task 3.1 ───→ Task 3.2   (same file, must be sequential)
Task 4.1 ───→ Task 4.2   (component → template, sequential chain)
```

Tasks 2.x and 3.x are in the same file (`excel.service.ts`) but touch different private methods — they can be interleaved as long as within each bug the order is respected.

## Implementation Order (Recommended)

1. **Bug 1** (Task 1.1) — trivial, instant green
2. **Bug 3** (Tasks 3.1 → 3.2) — more visible impact, clear TDD feedback
3. **Bug 2** (Tasks 2.1 → 2.2) — isolated calc change
4. **Bug 4** (Tasks 4.1 → 4.2) — most complex, save for last

## PR Strategy

**Single PR** — estimated ~100 lines total, well under the 400-line threshold for chained PRs. All changes are backward-compatible deltas across 3 files (plus spec updates). No database, routing, or API changes involved. The PR body should reference all 4 bugs with their spec scenarios.

- Branch name: `fix/bugfixes-julio-2026`
- Base: `main` or current development branch
- Commit plan per bug (4 commits, one per bug, each atomic)