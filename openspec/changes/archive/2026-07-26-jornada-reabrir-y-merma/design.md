# Design: Reabrir Jornada + Merma

## Technical Approach

Unified migration v9 adds 3 columns. Two PRs: PR#1 (jornada reopen) and PR#2 (merma). Both features share the Jornada model and JornadaService changes. PR#1 must land first because PR#2 depends on `user_apertura_id` for the daily table context.

## Architecture Decisions

### AD-1: user_apertura_id in jornadas

**Choice**: ALTER TABLE add column, NULL for existing rows
**Alternatives**: New `jornada_usuarios` junction table
**Rationale**: Simple 1:1 relationship, no need for junction table. NULL = legacy behavior (no reopen prompt). Single ALTER is atomic and fast.

### AD-2: Auto-close at login time, not app init

**Choice**: Check ownership in LoginPage after successful auth
**Alternatives**: Check in APP_INITIALIZER, check in App component constructor
**Rationale**: AuthService.usuario is only available after login. Checking in initializer would require accessing auth before it's ready. Login page already handles navigation flow — natural insertion point.

### AD-3: Merma uses existing _consumirFIFO + costo_total field

**Choice**: Add `costo_total` to stock_movimientos, reuse `_consumirFIFO()`
**Alternatives**: New `merma_lotes` table, reuse `venta_lotes` with nullable venta_id
**Rationale**: `_consumirFIFO()` is tested and working. `costo_total` field keeps the cost historically accurate at registration time. No new tables = fewer migration risks. `venta_lotes` has NOT NULL on venta_id — changing it risks breaking existing queries.

### AD-4: total_merma in jornadas, not computed on-the-fly

**Choice**: Store `total_merma` column in jornadas, update on each merma registration
**Alternatives**: Compute SUM(costo_total) at render time
**Rationale**: Matches existing pattern (total_ventas, total_gastos are stored, not computed). Avoids expensive SUM on every refreshJornadaAbierta call. Consistent with how gastos work.

### AD-5:saldo_esperado formula update

**Choice**: `saldo_esperado = monto_inicial + total_ventas - total_gastos - total_merma`
**Alternatives**: Keep saldo_esperado as-is, add merma separately
**Rationale**: Saldo esperado should reflect ALL deductions. Merma IS a deduction like gastos. User expects to see the true expected amount.

### AD-6: JornadaPage daily table

**Choice**: New section below summary card with 3 subsections: Ventas, Movimientos, Mermas
**Alternatives**: Single flat table, tabbed interface
**Rationale**: Matches existing jornada page pattern (card + sections). Subsections are scannable. No tab complexity needed for 3 categories.

### AD-7: PR chain strategy

**Choice**: stacked-to-main — PR#1 (reopen) merges first, PR#2 (merma) targets main after
**Alternatives**: feature-branch-chain
**Rationale**: Simpler. PR#2 depends on migration v9 from PR#1 but not on reopen logic. After PR#1 merges, PR#2 has clean base.

## Data Flow

### Reopen Flow
```
User logs in
  → LoginPage.login()
  → AuthService.login() → usuario signal set
  → Navigate to /pos
  → PosPage constructor / JornadaService.refreshJornadaAbierta()
  → JornadaService.obtenerAbierta() → SELECT WHERE fecha=today AND estado='abierta'
  → If result AND user_apertura_id !== usuario.id:
      → autoCerrarSiOtroUsuario() → UPDATE estado='cerrada' + generate Excel
      → jornadaAbierta.set(null)
  → If result AND user_apertura_id === usuario.id:
      → jornadaAbierta.set(j)
      → JornadaPage shows reopen modal
  → If no result:
      → jornadaAbierta.set(null)
      → Empty state
```

### Merma Flow
```
InventarioPage → click "Merma"
  → Form: cantidad, motivo
  → stockMovimientoService.registrarMerma(productoId, cantidad, motivo, jornadaId)
    → _consumirFIFO(productoId, cantidad) → ConsumoRecord[]
    → sum(consumos.cantidad * consumos.precio_costo_real) = costoTotal
    → INSERT stock_movimientos (tipo='merma', costo_total=costoTotal)
    → UPDATE productos.stock_actual (derived from lots)
    → UPDATE jornadas.total_merma = total_merma + costoTotal
    → UPDATE jornadas.saldo_esperado = saldo_esperado - costoTotal
  → Refresh inventario + jornada
```

## File Changes

| File | Action | PR | Description |
|------|--------|----|-------------|
| `src/app/models/jornada.ts` | Modify | 1 | +user_apertura_id, +total_merma |
| `src/app/models/stock-movimiento.ts` | Modify | 2 | +tipo 'merma', +costo_total |
| `src/app/services/sqlite.service.ts` | Modify | 1 | Migration v9 (3 ALTERs) |
| `src/app/services/jornada.service.ts` | Modify | 1+2 | abrir() con userId, autoCerrarSiOtroUsuario(), calcularTotalMerma(), total_merma update |
| `src/app/services/stock-movimiento.service.ts` | Modify | 2 | registrarMerma() |
| `src/app/services/excel.service.ts` | Modify | 2 | Merma in Excel |
| `src/app/pages/jornada/jornada.page.ts` | Modify | 1+2 | Reopen modal + daily table |
| `src/app/pages/jornada/jornada.page.html` | Modify | 1+2 | Modal UI + table UI |
| `src/app/pages/inventario/inventario.page.ts` | Modify | 2 | Merma button + form logic |
| `src/app/pages/inventario/inventario.page.html` | Modify | 2 | Merma button + form UI |
| `src/app/components/jornada-summary-card/jornada-summary-card.component.ts` | Modify | 2 | total_merma input |
| `src/app/components/jornada-summary-card/jornada-summary-card.component.html` | Modify | 2 | Show total_merma |

## Interfaces / Contracts

```typescript
// Jornada model (extended)
interface Jornada {
  // ... existing fields ...
  user_apertura_id: number | null;  // NEW
  total_merma: number;              // NEW (default 0)
}

// StockMovimiento model (extended)
interface StockMovimiento {
  // ... existing fields ...
  tipo: 'entrada' | 'salida' | 'ajuste' | 'merma';  // NEW: 'merma'
  costo_total: number;                                 // NEW (default 0)
}

// New method signature
interface StockMovimientoService {
  registrarMerma(
    productoId: number,
    cantidad: number,
    motivo?: string,
    jornadaId?: number,
  ): Promise<{ consumos: ConsumoRecord[]; costoTotal: number }>;
}

// JornadaService new methods
interface JornadaService {
  abrir(montoInicial: number, userId?: number): Observable<Jornada>;
  autoCerrarSiOtroUsuario(usuario: UsuarioPublico): Promise<Jornada | null>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | registrarMerma FIFO consumption | Mock DB, verify lot consumption + cost calculation |
| Unit | autoCerrarSiOtroUsuario | Mock DB, verify auto-close logic |
| Unit | saldo_esperado with merma | Mock DB, verify formula |
| Unit | Reopen modal logic | TestBed, verify modal shows/hides based on user match |
| Integration | Full merma flow | Register merma → verify stock updated → verify jornada totals |
| Integration | Login with open jornada | Mock auth → verify auto-close or reopen prompt |

## Migration / Rollout

### Migration v9
```sql
ALTER TABLE jornadas ADD COLUMN user_apertura_id INTEGER REFERENCES usuarios(id);
ALTER TABLE stock_movimientos ADD COLUMN costo_total REAL DEFAULT 0;
ALTER TABLE jornadas ADD COLUMN total_merma REAL DEFAULT 0;
```

- All ADD COLUMN with DEFAULT — safe, no data loss
- Existing jornadas: user_apertura_id=NULL, total_merma=0 (backward compatible)
- Existing stock_movimientos: costo_total=0 (non-merma movements unaffected)

## Open Questions

None — all decisions resolved.
