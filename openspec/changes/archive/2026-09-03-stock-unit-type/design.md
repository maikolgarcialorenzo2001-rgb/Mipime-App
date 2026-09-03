# Design: Stock Unit Type (unidades vs gramaje)

## Correction to Proposal/Spec (IMPORTANT)

Proposal and spec reference "migration V12". This is **wrong**: `db-migrations.ts` is already at **V18** and `migrationV12` is taken (`total_gastos → total_movimientos`). The next free slot is **V19**. This design uses V19; specs should be read accordingly.

## Technical Approach

Add a per-product `unidad_medida: 'unidad' | 'gramaje'` column (default `'unidad'`, no data loss) and propagate the correct unit suffix and decimal input behavior everywhere. DB storage is already REAL, so **no data-type migration** is needed for stock/lotes/movimientos — only the new column + model + UI behavior.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Migration number | Proposal says V12 but slot is used | **V19** — next free slot |
| Unit helper location | `models/producto.ts` (near type) vs new file | **`models/producto.ts`** — colocate with type; single import path already used broadly |
| Suffix source | New input vs derive from a global helper | **Shared `UNIDAD_MEDIDA` map** + per-component input pass-through for badges; derive inline for pages |
| Quantity input input prop | Add `unidad` input vs reuse existing `producto` | **Reuse `producto`** — component already receives `producto`; derive `producto().unidad_medida` |
| MAX_STOCK name | Keep vs rename | **Rename → `MAX_STOCK_CANTIDAD`** (2 references + spec test); clarify it is the absolute cap for both types |

### Decision: Unit helper map

```ts
// models/producto.ts
export type UnidadMedida = 'unidad' | 'gramaje';
export const UNIDAD_MEDIDA: Record<UnidadMedida, {
  suffix: string;        // 'u.' | 'lb'
  step: number;          // 1 | 0.1
  allowsDecimal: boolean; // false | true
}> = {
  unidad:  { suffix: 'u.', step: 1,   allowsDecimal: false },
  gramaje: { suffix: 'lb', step: 0.1, allowsDecimal: true },
};
```

## Data Model

- **V19 migration** (additive, `try/catch` idempotent pattern like v16):
  `ALTER TABLE productos ADD COLUMN unidad_medida TEXT NOT NULL DEFAULT 'unidad'`
- **Producto interface**: add `unidad_medida: UnidadMedida`
- No change to `lotes_stock` / `stock_movimientos` / `detalle_ventas` — already REAL.

## Data Flow

```
Form selector → formUnidadMedida signal → ProductoService.crear({unidad_medida})
      │                                            │
      └── persists productos.unidad_medida ────────┘
                     │
   Producto (query SELECT *) carries unidad_medida
                     │
   stock-badge [unidadMedida] · lots · toast · quantity-input · cart ±step
```

`UNIDAD_MEDIDA[producto.unidad_medida]` drives `{suffix, step, allowsDecimal}` at each touch point.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/db-migrations.ts` | Modify | Add `migrationV19` + runner branch |
| `src/app/models/producto.ts` | Modify | Add `UnidadMedida` type, `UNIDAD_MEDIDA` map, field |
| `src/app/pages/inventario/inventario.page.ts` | Modify | `formUnidadMedida` signal (default `'unidad'`), validation, toast suffix on `actualizado.unidad_medida` |
| `src/app/pages/inventario/inventario.page.html` | Modify | Unit selector in modal; dynamic suffix in 3 lot selectors (line 187/298/332 `{{lote.cantidad}}u`→`{{..}}{{sufijo}}`), labels |
| `src/app/components/stock-badge/stock-badge.component.ts/.html` | Modify | Add `unidadMedida` input (default `'unidad'`); suffix `{{stock()}} {{sufijoS}}` |
| `src/app/pages/inventario/inventario.page.html` | Modify | Pass `[unidadMedida]="producto.unidad_medida"` (2 badges) |
| `src/app/components/product-card/product-card.component.html` | Modify | Pass `[unidadMedida]="producto().unidad_medida"` |
| `src/app/pages/productos/producto.page.html` | Modify | Pass `[unidadMedida]="p.unidad_medida"` (2 badges) |
| `src/app/components/quantity-input/quantity-input.component.ts/.html` | Modify | Conditional regex/inputmode/step via `producto().unidad_medida`; "c/u"→dynamic |
| `src/app/components/cart-item-row/cart-item-row.component.html` | Modify | "c/u"→dynamic label |
| `src/app/services/cart.service.ts` | Modify | Optional `incrementar/decrementar` step helpers (per product) |
| `src/app/pages/pos/pos.page.ts/.html` | Modify | Backspace/± use per-product step 0.1 for gramaje |
| `src/app/services/stock-movimiento.service.ts` | Modify | Rename `MAX_STOCK_UNIDADES`→`MAX_STOCK_CANTIDAD` |

## Interfaces / Contracts

- `Producto.unidad_medida: 'unidad' | 'gramaje'`
- `StockBadgeComponent.unidadMedida` input, default `'unidad'`
- `UNIDAD_MEDIDA` map (above) as the single behavioral source

## Testing Strategy (strict TDD via `ng test`)

**New specs:**
- `quantity-input.component.spec.ts` — gramaje decimal filter (2.5 allowed, max 2 decimals), inputmode, ±0.1 step; unidad integer-only regression
- `stock-badge.component.spec.ts` (extend) — `unidadMedida` suffix render "5 u." / "2.5 lb"
- `cart.service.spec.ts` (extend) — per-product step ±0.1
- `db-migrations.spec.ts` (extend) — V19 column exists, default 'unidad', idempotent
- `inventario.page.spec.ts` (extend) — unit selector validation + `crear({unidad_medida})`

**Update existing specs (integer-only assertions):**
- `stock-badge.component.spec.ts` — currently asserts `textContent` contains "5" only; add suffix assertion (default 'unidad' → "5 u.")
- `cart.service.spec.ts` — product fixtures need `unidad_medida` field; step logic
- `db-migrations.spec.ts` — "inserts 18 versions" → 19; v19 idempotency tests
- `pos.page.spec.ts` / `inventario.page.spec.ts` — product fixtures gain required `unidad_medida`

**Test data note:** All Producto fixture literals across specs gain `unidad_medida: 'unidad'` to satisfy the interface.

## Open Questions

- None blocking. (Suffix for gramaje confirmed as "lb" per spec; no rounding config in scope.)
