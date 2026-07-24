# Design: Bug Fixes Julio 2026

## Technical Approach

Four isolated fixes across three files: one CSS global patch, two Excel calculation corrections in `excel.service.ts`, and one signal-based redesign of the divisas sub-form in `checkout-modal`. All fixes are backward-compatible deltas over the C11 feature set. No database, routing, or service architecture changes needed.

## Architecture Decisions

### Decision: Body overflow via styles.css, not index.html

| Option | Tradeoff |
|--------|----------|
| `style="overflow-x:hidden"` inline on `<body>` in `index.html` | Works but couples layout to template |
| **`body { overflow-x: hidden }` in `styles.css`** ✅ | Keeps layout concerns in stylesheet; follows existing pattern |

### Decision: Computed signals for divisa calc, not derived getter

| Option | Tradeoff |
|--------|----------|
| Plain getter calling `Math.ceil(total() / tasaCambio())` | Breaks reactivity — getter re-evaluates only on change detection |
| **`computed()` signal** ✅ | True reactive dependency graph; `montoDivisa` auto-updates when `total()` or `tasaCambio()` changes, zero-effort |

### Decision: Split footer rows, not conditional single row

| Option | Tradeoff |
|--------|----------|
| Single "Total ingresos" with conditional pendiente inline text | Hides semantic split; harder to read in reports |
| **Three rows: Total ingresos / Pendientes del día / Total esperado** ✅ | Clear breakdown; matches accounting convention |

## Data Flow

### Bug 4 — Divisas Signal Graph

```
total() (input signal, parent-driven)
  │
  ├──► tasaCambio() (writable signal, user input)
  │         │
  │         ▼
  │    montoDivisa = computed(() => Math.ceil(total() / tasaCambio()))
  │         │                              │
  │         ▼                              ▼
  │    vuelto = computed(() =>        onConfirmar() reads
  │      montoDivisa() * tasaCambio()  montoDivisa() and
  │      - total()                     tasaCambio() into payload
  │         │
  │         ▼
  │    Template: readonly input + vuelto display
```

### Bug 2 & 3 — Excel Data Flow

```
JornadaReportData
  ├── cuentaCosas[] ──► Bug 2: _agregarResumen / _agregarJornadaSheet
  │                       productosMap lookup → precio_costo
  │                       valor = -(cantidad × precio_costo)
  │
  └── ventas[] ──────► Bug 3: _agregarVentas / _agregarJornadaSheet
                          forma_pago === 'pendiente'
                          ├── yes → totalPendientes
                          └── no  → totalSinPendientes
                          Footer: both rows displayed
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/styles.css` | Modify | Add `body { overflow-x: hidden; }` — Bug 1 |
| `src/app/services/excel.service.ts` | Modify | Bug 2: `_agregarResumen` + `_agregarJornadaSheet` — CuentaCosas uses `cantidad × precio_costo`. Bug 3: `_agregarVentas` + `_agregarJornadaSheet` — split granTotal into `totalSinPendientes`/`totalPendientes`, add footer rows |
| `src/app/components/checkout-modal/checkout-modal.component.ts` | Modify | Bug 4: Replace `montoDivisa` signal with `computed`. Add `vuelto` computed. Import `computed`. Add validation guard in `onConfirmar` |
| `src/app/components/checkout-modal/checkout-modal.component.html` | Modify | Bug 4: `montoDivisa` input becomes readonly; add vuelto display row; block confirm when `tasaCambio` invalid |
| `src/app/components/checkout-modal/checkout-modal.component.spec.ts` | Modify | Bug 4: Update divisa tests to use computed values, add vuelto tests, remove manual montoDivisa setter tests |
| `src/app/services/venta.service.ts` | None needed | Already consumes `payload.montoDivisa` — computed value flows through unchanged |
| `src/app/services/excel.service.spec.ts` | Modify | Bug 2+3: Add tests for CuentaCosas `precio_costo` calc and ventas pendientes split |

## Signal Design (Bug 4)

```typescript
// checkout-modal.component.ts — new computed signals

// total is already an input signal — no change needed
readonly total = input.required<number>();

// tasaCambio remains writable (user enters the rate)
readonly tasaCambio = signal<number | null>(null);

// montoDivisa becomes derived — auto-computed, no user input
readonly montoDivisa = computed<number | null>(() => {
  const tasa = this.tasaCambio();
  const t = this.total();
  if (tasa == null || tasa <= 0 || t <= 0) return null;
  return Math.ceil(t / tasa);
});

// vuelto = (ceiling - exact) in ARS — what the customer overpays
readonly vuelto = computed<number | null>(() => {
  const md = this.montoDivisa();
  const tasa = this.tasaCambio();
  const t = this.total();
  if (md == null || tasa == null || tasa <= 0) return null;
  return md * tasa - t;
});
```

### Key behaviors
- `montoDivisa` is `null` when `tasaCambio` is null, 0, or negative — template shows `—`
- `vuelto` is `null` when `montoDivisa` is null — template shows nothing
- `montoDivisa` is **always `Math.ceil`** — never rounds down, so `vuelto >= 0`
- No manual `montoDivisa.set()` calls remain; the signal is read-only

### Template impact

```html
<!-- Monto en divisa — readonly, computed -->
<input
  type="number"
  class="..."
  [value]="montoDivisa()"
  readonly
/>

<!-- Vuelto display — only when applicable -->
@if (montoDivisa() != null && vuelto()! > 0) {
  <div class="text-sm text-green-600 dark:text-green-400">
    Vuelto: {{ vuelto() | currency:'ARS':'symbol-narrow':'1.0-0' }}
  </div>
}

<!-- Confirm button disabled when tasa inválida for divisas -->
@if (formaPago() === 'divisas') {
  <button ... [disabled]="tasaCambio() == null || tasaCambio()! <= 0">
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit — Bug 1 | No horizontal scroll on login page | CSS test via `getComputedStyle(document.body).overflowX === 'hidden'` — or visual/component test |
| Unit — Bug 2 | CuentaCosas `valor = -(cantidad × precio_costo)` | `_agregarResumen` and `_agregarJornadaSheet` produce correct totals with `productosMap` lookup |
| Unit — Bug 2 | Fallback when `precio_costo` is null | Should treat null as 0 |
| Unit — Bug 3 | `_agregarVentas` footer split | 3 scenarios from spec: mixed, only-pendientes, no-pendientes |
| Unit — Bug 3 | `_agregarJornadaSheet` footer split | Same 3 scenarios for jornada sheet |
| Unit — Bug 4 | `montoDivisa = Math.ceil(total / tasa)` | Exact calculation; null when tasa=0; null when tasa=null |
| Unit — Bug 4 | `vuelto = (monto × tasa) - total` | Zero case (exact division), positive case |
| Component — Bug 4 | Input becomes readonly, vuelto displayed | Template assertions via fixture |
| Component — Bug 4 | Confirm blocked when tasa inválida | `onConfirmar` does not emit; button disabled |

## Implementation Order

```
Bug 1 ──► Done (1 line CSS, no test needed)
  │
  ├── Bug 2 ──► excel.service.ts (2 methods, test file)
  │
  ├── Bug 3 ──► excel.service.ts (2 methods, test file)
  │     └── (B2 and B3 are independent, can be parallel)
  │
  └── Bug 4 ──► checkout-modal (component + template + spec)
```

All bugs are independent — no fix blocks another. Recommended order:
1. Bug 1 (trivial, quick green)
2. Bug 3 (pendientes split — more visible impact)
3. Bug 2 (CC cost calc — isolated)
4. Bug 4 (most complex — save for last)

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bug 2: productMap missing product_id | Low | `info?.precio_costo ?? 0` — falls back to 0, same as current null treatment |
| Bug 3: `_agregarVentas` footerLen mismatch with new rows | Low | Reuse same `Array(footerLen).fill('')` padding for each footer row |
| Bug 4: `montoDivisa` signal removal breaks existing tests | Medium | Update spec file: remove `.set()` calls, assert computed values instead |
| Bug 4: `total()` is an input signal from parent — computed may return stale if parent hasn't pushed yet | Low | Inputs are set synchronously before component creation; `computed` tracks `total()` as dependency, updates on push |
| Shared file conflicts (B2 + B3 same file) | Low | Each modifies different private methods — no merge conflicts |
