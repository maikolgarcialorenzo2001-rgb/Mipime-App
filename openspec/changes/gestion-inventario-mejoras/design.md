# Design: Gestión de Inventario — Mejoras

## Technical Approach

4 features, zero inter-dependencies, implementable in any order. Each follows existing patterns: Signals + computed for state, SQLocal rxjs wrappers for DB, Angular 18+ `@if`/`@for` control flow in templates.

## Architecture Decisions

### Decision: Migration v7 (not v6)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| v6 (as spec says) | Current DB is at v6 — would re-run | **v7** (proposal is correct) |
| v7 (`ALTER TABLE ADD COLUMN`) | Safe with try/catch, same as v2 pattern | **Use v7** |

`ALTER TABLE ADD COLUMN` with try/catch guard — identical to v2's pattern for `user_cierre_id`.

### Decision: `StockMovimiento.jornada_id` — optional param overload

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New overload methods per tipo | Explosion: 6 methods instead of 3 | **Optional param** — cleanest, matches existing API |
| Separate `registrarConJornada` | Breaking, callers must know which | **Rejected** |

### Decision: Product modal — inline in InventarioPage vs standalone component

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Standalone `<app-producto-form>` | Reusable, testable, but overkill for single usage | **Inline modal** in InventarioPage — follows existing pattern (JornadaPage cierre modal is inline) |
| Signals for form fields | Same as JornadaPage movimiento form | **Adopt same pattern** — `nombre`, `precio_costo`, `precio_venta`, `stock_actual` signals |

### Decision: Admin gate for CRUD

AuthService already exposes `usuario` signal + `hasRole('admin')`. Inject in InventarioPage. Same pattern as JornadaPage.

## Data Flow

```
[InventarioPage]
  │
  ├─ crear/actualizar/eliminar ──→ ProductoService ──→ SQLocal DB
  │
  └─ auth.usuario().rol === 'admin' ──→ show CRUD buttons + precio_costo column

[HistorialPage]
  │
  ├─ A: _jornadasPorFecha (Map<string, Jornada[]>) ──→ grid() cells ──→ diaSeleccionado.jornadas[]
  │
  └─ D: date picker ──→ generarExportacionPorRango ──→ _recolectarDatosJornada × N ──→ generarExcelMensual

[JornadaService._recolectarDatosJornada]
  ──→ ahora incluye stock_movimientos con jornada_id = N
  ──→ JornadaReportData.stockMovimientos[]

[ExcelService]
  ──→ generarExcelJornada: + hoja "Stock" con data.stockMovimientos
  ──→ generarExcelMensual: + hoja "Movimientos de Stock" consolidada
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/models/stock-movimiento.ts` | Modify | Add `jornada_id?: number` |
| `src/app/services/sqlite.service.ts` | Modify | Migration v7: `ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id)` |
| `src/app/services/stock-movimiento.service.ts` | Modify | `registrarEntrada/Salida/Ajuste` accept `jornada_id?: number` |
| `src/app/services/producto.service.ts` | Modify | Add `crear()`, `actualizar()`, `eliminar()` |
| `src/app/services/excel.service.ts` | Modify | Add stock movements sheet to `generarExcelJornada` and `generarExcelMensual`; update `JornadaReportData` |
| `src/app/services/jornada.service.ts` | Modify | `_recolectarDatosJornada` fetches stock movements; add `generarExportacionPorRango()` |
| `src/app/pages/historial/historial.page.ts` | Modify | Multi-jornada types + signals + exportarRango method |
| `src/app/pages/historial/historial.page.html` | Modify | Multi-badge cells, multi-card detail, date picker + export range button |
| `src/app/pages/inventario/inventario.page.ts` | Modify | Inject AuthService; add CRUD signals + methods |
| `src/app/pages/inventario/inventario.page.html` | Modify | Add "Nuevo producto" button, modal, `precio_costo` column, delete button |
| `src/app/pages/inventario/inventario.page.css` | Modify | Modal overlay styles |

## Interfaces / Contracts

### StockMovimiento model (modified)

```typescript
export interface StockMovimiento {
  id: number;
  producto_id: number;
  cantidad: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  motivo: string | null;
  jornada_id?: number;      // ← new, nullable
  created_at: string;
}
```

### ProductoService — new methods

```typescript
class ProductoService {
  crear(data: { nombre: string; precio_costo: number; precio_venta: number; stock_actual: number }): Observable<Producto>;
  actualizar(id: number, data: { nombre: string; precio_costo: number; precio_venta: number; stock_actual: number }): Observable<Producto>;
  eliminar(id: number): Observable<void>;
}
```

### StockMovimientoService — modified signatures

```typescript
class StockMovimientoService {
  async registrarEntrada(productoId: number, cantidad: number, motivo?: string, jornada_id?: number): Promise<void>;
  async registrarSalida(productoId: number, cantidad: number, motivo?: string, jornada_id?: number): Promise<void>;
  async registrarAjuste(productoId: number, cantidad: number, motivo: string, jornada_id?: number): Promise<void>;
}
```

### DiaCalendario (changed)

```typescript
export interface DiaCalendario {
  day: number | null;
  dateStr: string | null;
  jornadas: Jornada[];          // ← was jornada?: Jornada
  isToday: boolean;
  isCurrentMonth: boolean;
}
```

### JornadaReportData (extended)

```typescript
export interface JornadaReportData {
  // ... existing fields ...
  stockMovimientos: StockMovimiento[];  // ← new
}
```

## Migration SQL (v7)

```sql
-- In _migrationV7(), after v6 check
ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id);
INSERT INTO schema_version (version) VALUES (7);
```

Wrapped in try/catch — identical to v2 ALTER TABLE pattern.

## Component State Changes

### HistorialPage

| Signal/Computed | Current | New |
|-----------------|---------|-----|
| `_jornadasPorFecha` | `Map<string, Jornada>` | `Map<string, Jornada[]>` |
| `diaSeleccionado` | `{ fecha, jornada? }` | `{ fecha, jornadas: Jornada[] }` |
| `grid()` cells | `jornada?: Jornada` | `jornadas: Jornada[]` |
| `selectedDateStr` | unchanged | unchanged |
| — | — | `rangoDesde = signal('')` |
| — | — | `rangoHasta = signal('')` |
| — | — | `exportandoRango = signal(false)` |
| — | — | `exportarRango()` |

### InventarioPage (additions)

| Signal | Type | Purpose |
|--------|------|---------|
| `showModal` | `signal(false)` | Modal visibility |
| `editandoProducto` | `signal<Producto \| null>(null)` | null = new, non-null = edit |
| `formNombre` | `signal('')` | Modal field |
| `formPrecioCosto` | `signal(0)` | Modal field |
| `formPrecioVenta` | `signal(0)` | Modal field |
| `formStock` | `signal(0)` | Modal field |
| `guardando` | `signal(false)` | Loading state |
| `mostrarConfirmacion` | `signal<number \| null>(null)` | Product ID pending delete confirmation |

## Template Changes

### Historial calendar cell (multi-badge)
```
cell.jornadas → iterate @for badge per jornada
```
### Historial detail panel (multi-card)
```
@for (j of diaSeleccionado.jornadas) { ... card with descargarExcel(j) + verPreview(j) ... }
```
### Historial date range picker
```
<input type="date" [(ngModel)]="rangoDesde"> — <input type="date" [(ngModel)]="rangoHasta">
<button (click)="exportarRango()">Exportar rango</button>
```
### Inventario modal
```
@if (showModal) { overlay → form → botón guardar + cancelar }
```
### Inventario precio_costo column
```
<th>P. Costo</th>  (visible unconditionally — this is admin-only page)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (service) | ProductoService.crear/actualizar/eliminar | Mock DATABASE, verify SQL calls |
| Unit (service) | StockMovimientoService with jornada_id | Verify INSERT includes jornada_id |
| Unit (component) | HistorialPage multi-jornada | Mock service returns 2 jornadas same date; verify grid() has both |
| Unit (component) | InventarioPage CRUD modal | Verify modal opens with empty/prefilled fields, validation rejects empty |
| Unit (component) | InventarioPage delete confirmation | Verify confirm dialog show/hide |
| Unit (service) | JornadaService.generarExportacionPorRango | Verify calls _recolectarDatosJornada for each jornada in range |
| Unit (service) | ExcelService stock sheet in jornada | Verify sheet "Stock" exists with correct columns |
| Unit (service) | ExcelService stock sheet in mensual | Verify sheet "Movimientos de Stock" exists |

## Migration / Rollout

**Migration v7**: Add column only. No data loss. Existing rows get `jornada_id = NULL`.

**Rollback**: Revert all file changes. `ALTER TABLE stock_movimientos DROP COLUMN jornada_id` (SQLite 3.35+), or recreate table if needed.

## Implementation Order

No hard dependencies between features. Recommended sequence:

1. **Feature C first** (DB migration v7 + stock movement model + Excel sheet) — migration is foundational, safest applied early
2. **Feature A** (multi-jornada) — template-only changes, easy to verify visually
3. **Feature B** (CRUD productos) — self-contained with modal UI
4. **Feature D** (export by range) — reuses existing `generarExcelMensual` pattern

## Open Questions

- None identified. All decisions map to existing codebase patterns.
