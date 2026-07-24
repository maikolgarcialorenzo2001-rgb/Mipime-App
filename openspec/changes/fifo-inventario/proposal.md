# Proposal: FIFO Inventory System

## Intent

`precio_costo` in `productos` is a single mutable value — when a product is repurchased at a different cost, the old cost is lost. Gross income calculations in `jornada.service` use the current `precio_costo`, which is incorrect for any product whose cost has changed since purchase. There's also no way to trace which batch of stock was sold. This makes the P&L unreliable for any business with fluctuating supplier prices.

## Scope

### In Scope
- New `lotes_stock` table: per-product batch tracking with `precio_costo` and `fecha_ingreso`
- New `venta_lotes` table: records which lot was consumed per sale line item
- FIFO consumption algorithm in stock exit paths (sales, cuenta-cosas, manual exits)
- Migration v8: backfill existing `stock_actual` into a single lot per product
- Gross income recalculation using `venta_lotes.precio_costo_real` instead of `productos.precio_costo`
- Inventory UI updates: lot display, cost input on entry
- All affected services: `stock-movimiento`, `venta`, `cuenta-cosa`, `jornada`, `excel`

### Out of Scope
- Product deduplication (separate concern)
- Lot expiry or shelf-life tracking
- Multi-warehouse / location tracking
- Lot-level pricing overrides on sales (sale price stays per-product)

## Capabilities

### New Capabilities
- `fifo-lot-tracking`: Lot-based stock tracking with FIFO consumption, new tables, migration, and consumption algorithm
- `fifo-inventory-ui`: UI changes for lot-aware stock entry and inventory display

### Modified Capabilities
- `checkout`: Sale flow must consume lots via FIFO and record `venta_lotes` entries (spec change in consumption behavior)
- `excel-reportes`: Gross income / totalCosto must derive from `venta_lotes` instead of `productos.precio_costo`

## Approach

**New tables** (migration v8):

```sql
CREATE TABLE lotes_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_costo REAL NOT NULL,
  fecha_ingreso TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE venta_lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id),
  lote_id INTEGER NOT NULL REFERENCES lotes_stock(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_costo_real REAL NOT NULL,
  created_at TEXT NOT NULL
);
```

**Migration backfill**: For each product with `stock_actual > 0`, INSERT one lot with `cantidad = stock_actual`, `precio_costo = precio_costo`, `fecha_ingreso = created_at`.

**FIFO consumption** (used by `venta.service`, `cuenta-cosa.service`, `stock-movimiento.registrarSalida`):

```
1. SELECT lots for producto_id WHERE cantidad > 0 ORDER BY fecha_ingreso ASC
2. Iterate: consume min(remaining, lot.cantidad) from each lot
3. UPDATE lot.cantidad -= consumed
4. INSERT venta_lotes record per lot consumed
5. UPDATE productos.stock_actual (as before, for backward compat)
```

**Gross income** in `jornada.service._ejecutarCierre` and `_recolectarDatosJornada`:

```sql
SELECT COALESCE(SUM(vl.cantidad * vl.precio_costo_real), 0) AS total_costo
FROM venta_lotes vl WHERE vl.venta_id IN (...)
```

**Key files affected**:

| File | Change |
|------|--------|
| `src/app/services/sqlite.service.ts` | Add `_migrationV8()` with tables + backfill |
| `src/app/models/lote-stock.ts` | New model: `LoteStock` interface |
| `src/app/models/venta-lote.ts` | New model: `VentaLote` interface |
| `src/app/services/stock-movimiento.service.ts` | `registrarEntrada` creates lot; `registrarSalida` consumes FIFO |
| `src/app/services/venta.service.ts` | Sale consumes lots via FIFO, inserts `venta_lotes` |
| `src/app/services/cuenta-cosa.service.ts` | CC consumption uses FIFO |
| `src/app/services/jornada.service.ts` | `totalCosto` from `venta_lotes` instead of `productos.precio_costo` |
| `src/app/services/excel.service.ts` | Price base from lot cost for Cuenta Cosas table |
| `src/app/pages/inventario/inventario.page.ts` | Entry form includes cost input |
| `src/app/pages/inventario/inventario.page.html` | Lot display in inventory view |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration backfill loses precision if `precio_costo` is NULL | Medium | Low | Set `precio_costo = 0` for NULL cases; log warning |
| FIFO consumption performance with many lots | Low | Low | Lots per product will be small (<50 in practice); indexed query |
| Existing sales have no `venta_lotes` records | High | Medium | Reports gracefully fallback to `productos.precio_costo` when `venta_lotes` is empty for a sale |
| Concurrent stock modifications | Low | Low | SQLite serializes writes; single-user local-first app |

## Rollback Plan

1. Remove `_migrationV8()` call from `sqlite.service.ts`
2. Drop `lotes_stock` and `venta_lotes` tables
3. Revert all service changes to pre-FIFO versions
4. No data loss: original `productos.precio_costo` and `stock_actual` are preserved throughout

## Dependencies

None external. All changes are internal to the existing codebase.

## Success Criteria

- [ ] `lotes_stock` and `venta_lotes` tables created via migration v8
- [ ] Existing products backfilled with one lot each
- [ ] Stock entry creates a new lot with the provided `precio_costo`
- [ ] Stock exit consumes from oldest lot first, recording `venta_lotes` entries
- [ ] Gross income in Excel reports uses `venta_lotes.precio_costo_real`
- [ ] Inventory page shows lot breakdown per product
- [ ] All existing tests pass; new tests cover FIFO consumption edge cases
