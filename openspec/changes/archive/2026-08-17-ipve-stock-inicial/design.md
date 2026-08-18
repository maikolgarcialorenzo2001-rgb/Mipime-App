# Design: IPVE Sheet — Stock Tienda Inicial + Entradas

## Architecture Decision

**Choice**: Compute derived columns (Inicial, Entradas) inside `_agregarIpve` — no new interface fields, no schema changes.

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Derive in `_agregarIpve` from existing `JornadaReportData` | Computation duplicated per export; no persistence | **Selected** — zero schema risk, no stale data |
| Snapshot initial stock on jornada open | Accurate, but requires new DB column + migration + write path change | Rejected — disproportionate scope |
| Add fields to `ProductoInfo` | Leaks journa-scoped data into a generic product interface | Rejected — wrong abstraction level |

**Rationale**: `stock_shop` on `ProductoInfo` is end-of-day stock (read from `productos` table at `jornada.service.ts:662-668`). Reverse-engineering initial stock from `final + ventas + merma - entradas` is deterministic for the default ubicacion case, requires zero schema work, and stays contained within one 57-line method.

## Data Flow

```
productos table ──→ productosMap (stock_shop = END-OF-DAY) ─┐
ventas + detalles ──→ ventasTienda (sum cantidad)           ├──→ _agregarIpve
stock_movimientos ──→ entradas (tipo=traslado)              │      │
              └────→ mermaTienda (tipo=merma) ─────────────┘      │
                                                                  ▼
                                                          9-col IPVE sheet
                                                          + merma side-table @ col 10
```

**Formula** (per product):
```
entradas       = stockMovimientos.filter(tipo==='traslado').sum(cantidad)
ventasTienda   = ventas.flatMap(detalles).sum(cantidad)          // product-scoped needed
mermaTienda    = stockMovimientos.filter(tipo==='merma').sum(cantidad)
stckTiendaInit = stockShopFinal + ventasTienda + mermaTienda - entradas
```

> **Important**: `ventasTienda` and `mermaTienda` are currently NOT per-product in `JornadaReportData`. `ventas.flatMap(v.detalles)` gives all detalles across the journa. Each `DetalleVenta` has a `producto_id`, so we must filter by product. `stockMovimientos` also has `producto_id` for per-product filtering.

## Interface Changes

**None.** `ProductoInfo` (line 11-17) keeps its current shape. Derived values are local variables in `_agregarIpve`.

`JornadaReportData` (line 35-53) already provides `ventas`, `stockMovimientos`, and `productosMap` — all fields needed.

## Method Changes — `_agregarIpve` (lines 952-1008)

### Step 1: Compute journa-scoped aggregates

```ts
const ventas = data.ventas ?? [];
const stockMovs = data.stockMovimientos ?? [];

// Per-product maps: productoId → count
const entradasMap = new Map<number, number>();
const mermaMap = new Map<number, number>();
const ventasMap = new Map<number, number>();

for (const m of stockMovs) {
  if (m.tipo === 'traslado') entradasMap.set(m.producto_id, (entradasMap.get(m.producto_id) ?? 0) + m.cantidad);
  if (m.tipo === 'merma')    mermaMap.set(m.producto_id, (mermaMap.get(m.producto_id) ?? 0) + m.cantidad);
}
for (const v of ventas) {
  for (const d of v.detalles) {
    ventasMap.set(d.producto_id, (ventasMap.get(d.producto_id) ?? 0) + d.cantidad);
  }
}
```

### Step 2: 9-column header + row construction

Replace current 7-col header (line 960) with:
```ts
['Nombre', 'Stck Tienda Inicial', 'Entradas', 'Stck Tienda Final', 'Stock Almacén', 'Precio Venta', 'Ingreso Esperado', 'Total Invertido', 'Ganancia Potencial']
```

Per product (inside the `for` loop at line 967):
```ts
const stockShopFinal = info.stock_shop;
const entradas = entradasMap.get(productoId) ?? 0;
const ventasProd = ventasMap.get(productoId) ?? 0;
const mermaProd = mermaMap.get(productoId) ?? 0;
const stckTiendaInicial = stockShopFinal != null
  ? stockShopFinal + ventasProd + mermaProd - entradas
  : null;
```

Row construction (lines 973-984 pattern):
- **Valid path** (`pv != null && stockAlmacen != null && stockShop != null`): `[info.nombre, stckTiendaInicial, entradas, stockShop, stockAlmacen, pv, ingreso, inversion, ganancia]`
- **Null path**: `[info.nombre, stckTiendaInicial ?? '—', entradas, stockShop ?? '—', stockAlmacen ?? '—', '—', '—', inversion, '—']`

### Step 3: Totals row (line 988)

```ts
filas.push(['TOTALES', '', '', '', '', '', sumIngreso, sumInversion, sumGanancia]);
```

### Step 4: Merma side-table offset

Change line 994 from `c: 8` to `c: 10`:
```ts
XLSX.utils.sheet_add_aoa(ws, [['Merma del día', mermaVal]], { origin: { r: 0, c: 10 } });
```

### Step 5: Column widths (lines 996-1004)

```ts
ws['!cols'] = [
  { wch: 20 },  // Nombre
  { wch: 18 },  // Stck Tienda Inicial
  { wch: 12 },  // Entradas
  { wch: 18 },  // Stck Tienda Final
  { wch: 16 },  // Stock Almacén
  { wch: 14 },  // Precio Venta
  { wch: 18 },  // Ingreso Esperado
  { wch: 18 },  // Total Invertido
  { wch: 18 },  // Ganancia Potencial
];
```

## Column Layout

```
Col Index:  0          1                 2        3                 4              5            6               7               8
Header:     Nombre     Stck Tienda Inicial Entradas Stck Tienda Final Stock Almacén  Precio Venta Ingreso Esperado Total Invertido Ganancia Potencial

Merma side-table: col 10 (row 0)
```

## Test Strategy

| # | Test | What to verify |
|---|------|----------------|
| 4.1 | Sheet exists | `SheetNames` contains `'ipve'` (unchanged) |
| 4.2 | Header 9 columns | All 9 headers match, especially `'Stck Tienda Inicial'`, `'Entradas'`, `'Stck Tienda Final'` |
| 4.3 | Derived values per product | With `stock_movimientos: [{tipo:'traslado', cantidad:5, producto_id:1}]` and `ventas` with `detalle.cantidad:3` for product 1: `stckTiendaInicial = 20 + 3 + 0 - 5 = 18`, `entradas = 5` |
| 4.4 | Totals row | Sums at new column indices (6=Ingreso, 7=Inversion, 8=Ganancia) |
| 4.5 | Null pv product | `—` renders correctly in new column positions |
| 4.6 | Merma offset | `'Merma del día'` found at column index 10, value at 11 |
| 4.7 | No movements | `stckTiendaInicial = stockShopFinal`, `entradas = 0` |
| 4.8 | Multiple products, mixed movements | Product with both traslado and merma; verify formula end-to-end |

**Test data setup**: Add `stockMovimientos` and `ventas` with `detalles` to the existing `ipveData()` factory (line 1153).

## Trade-offs

| Concern | Why this approach wins |
|---------|----------------------|
| `ubicacion` not on `stock_movimientos` | Accepted — salidas/mermas default to shop; edge case documented |
| No journa open-time snapshot | Snapshot requires schema migration + write-path change for a label-equivalent derivation |
| Computation re-runs on export | Idempotent and traceable; no stale state risk |
| `DetalleVenta.producto_id` filter needed | `ventas.flatMap(v.detalles)` is all-journa — must filter per product for accurate initial stock |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Pure label + derivation change in a single method. Previously generated Excel files are unaffected.

## Open Questions

None — all data sources confirmed, formulas validated against `JornadaReportData` shape.
