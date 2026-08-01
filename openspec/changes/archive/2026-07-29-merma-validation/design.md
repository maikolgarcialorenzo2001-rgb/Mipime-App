# Design: merma-validation

## Technical Approach

Tres cambios coordinados: (1) Service — motivo obligatorio con validación al estilo `registrarAjuste`, (2) UI producto page — stock check + confirm nativa, (3) UI jornada page — columna ubicación con migración DB para persistirla en stock_movimientos.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| `confirm()` vs modal personalizado | Nativo es simple, funciona offline, no agrega dependencias. Modal da mejor UX en mobile. | `confirm()` — acción irreversible justifica bloqueo nativo del thread |
| `stockSuficiente` computed vs validación en submit | Computed permite deshabilitar botón reactivamente sin esperar submit | computed — mismo patrón que `saldoInsuficiente` en jornada.page.ts |
| ALTER TABLE vs recrear tabla para `ubicacion` | ALTER es seguro para columna nullable sin CHECK | ALTER TABLE ADD COLUMN `ubicacion TEXT` — migración v17 |
| Motivo: trim vacío vs solo empty check | trim vacío es más robusto, evita espacios | `if (!motivo \|\| motivo.trim().length === 0) throw...` — mismo patrón que `registrarAjuste` |

## Data Flow

```
Producto Page                           Jornada Page
─────────────                           ────────────
select ubicacion ──→ stockDisponible (computed from producto.stock_shop/stock_almacen)
         │
         ├─ stockSuficiente? ─→ disable button + tooltip
         │
         └─ onSubmitMerma()
              ├─ confirm("¿Registrar merma?") ── cancel → return
              └─ stockService.registrarMerma(prdId, cant, motivo, jrnId, ubic)
                     │
                     ├─ _consumirFIFO(ubicacion)
                     ├─ INSERT stock_movimientos (+ ubicacion)
                     └─ UPDATE stock_{ubicacion}
                              ↓
                     Jornada Page SELECT * → columna Ubicación
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/stock-movimiento.service.ts` | Modify | `motivo` required + trim validation + JSDoc update |
| `src/app/services/stock-movimiento.service.spec.ts` | Modify | Tests: motivo vacío, merma almacén |
| `src/app/services/sqlite.service.ts` | Modify | Migration v17: ADD COLUMN ubicacion a stock_movimientos |
| `src/app/models/stock-movimiento.ts` | Modify | Add `ubicacion?: string` to interface |
| `src/app/pages/productos/producto.page.ts` | Modify | Signals: `mermaStockDisponible`, `mermaStockSuficiente`. `onSubmitMerma` + confirm |
| `src/app/pages/productos/producto.page.html` | Modify | Stock indicator, button disabled + tooltip |
| `src/app/pages/productos/producto.page.spec.ts` | Modify | Tests: stock check, confirm cancel |
| `src/app/pages/jornada/jornada.page.html` | Modify | Columna "Ubicación" en tabla mermas |
| `src/app/pages/jornada/jornada.page.spec.ts` | Modify | Test: columna ubicación renderizada |

## Interfaces / Contracts

**StockMovimiento model** (add field):
```typescript
export interface StockMovimiento {
  // ... existing fields
  ubicacion?: string;  // 'shop' | 'almacen' | null (legacy)
}
```

**registrarMerma** new signature:
```typescript
async registrarMerma(
  productoId: number,
  cantidad: number,
  motivo: string,           // required (was optional)
  jornadaId?: number,
  ubicacion: 'almacen' | 'shop' = 'shop',
): Promise<{ consumos: ConsumoRecord[]; costoTotal: number }>
```

**Migration v17**: `ALTER TABLE stock_movimientos ADD COLUMN ubicacion TEXT;`

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Service unit | Motivo vacío → throw | `registrarMerma(1, 5, '')` reject con 'El motivo es obligatorio' |
| Service unit | Merma de almacén | `registrarMerma(1, 3, 'Rotura', undefined, 'almacen')` → verifica SQL con ubicacion='almacen' |
| UI unit | Stock check display | `abrirMerma(1)` + `mermaUbicacion.set('shop')` → `mermaStockDisponible()` = producto.stock_shop |
| UI unit | Confirm cancelado | `onSubmitMerma()` con confirm mock → `registrarMerma` no llamado |
| UI unit | Botón deshabilitado | Cantidad > stock → button disabled + title tooltip |
| UI unit | Columna ubicación | Merma mock con `ubicacion: 'shop'` → texto "Tienda" en tabla |

## Migration / Rollout

**v17 migration**: `ALTER TABLE stock_movimientos ADD COLUMN ubicacion TEXT` (nullable — registros legacy muestran "—"). Sin feature flag.

## Open Questions

- Ninguna.
