# Tasks: Gestión de Inventario — Mejoras

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~586 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: C → PR 2: A+D → PR 3: B |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | Migration v7 + Stock sheet in Excel (C) | PR 1 | main |
| 2 | Multi-jornada + Export range (A+D) | PR 2 | main |
| 3 | CRUD productos (B) | PR 3 | main |

## Phase 1: Foundation — DB & Model Changes

- [x] 1.1 `src/app/models/stock-movimiento.ts` — Add `jornada_id?: number` field
- [x] 1.2 `src/app/services/sqlite.service.ts` — Add `_migrationV7()` with `ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id)` wrapped in try/catch; register check in `initialize()`
- [x] 1.3 `src/app/services/stock-movimiento.service.ts` — Add `jornada_id?: number` optional param to `registrarEntrada/Salida/Ajuste`; include in INSERT
- [ ] 1.4 `src/app/pages/inventario/inventario.page.ts` — Update `onSubmitMovimiento` calls to pass `jornada_id` (undefined for non-jornada contexts)

## Phase 2: Core — Feature C (Excel Stock Sheet)

- [x] 2.1 `src/app/services/excel.service.ts` — Add `stockMovimientos: StockMovimiento[]` to `JornadaReportData`
- [x] 2.2 `src/app/services/excel.service.ts` — Add `_agregarMovimientosStock(wb, data)` method creating sheet "Stock" with columns: Producto, Tipo, Cantidad, Motivo, Fecha
- [x] 2.3 `src/app/services/excel.service.ts` — Call `_agregarMovimientosStock` from `generarExcelJornada`
- [x] 2.4 `src/app/services/excel.service.ts` — Add consolidated "Movimientos de Stock" sheet via `_agregarStockConsolidado` in `generarExcelMensual`
- [x] 2.5 `src/app/services/jornada.service.ts` — In `_recolectarDatosJornada`, fetch `stock_movimientos WHERE jornada_id = ?` and include in return data

## Phase 3: Feature A (Multi-jornada HistorialPage)

- [x] 3.1 `src/app/pages/historial/historial.page.ts` — Change `DiaCalendario.jornada?: Jornada` → `jornadas: Jornada[]`
- [x] 3.2 `src/app/pages/historial/historial.page.ts` — Change `_jornadasPorFecha` return type to `Map<string, Jornada[]>`, push array
- [x] 3.3 `src/app/pages/historial/historial.page.ts` — Change `diaSeleccionado` type to `{ fecha: string; jornadas: Jornada[] }`, map from array
- [x] 3.4 `src/app/pages/historial/historial.page.ts` — Update `grid()` to assign `jornadas` array from map; filler cells get `jornadas: []`
- [x] 3.5 `src/app/pages/historial/historial.page.html` — Calendar cell: `@for` over `cell.jornadas` showing badge per jornada
- [x] 3.6 `src/app/pages/historial/historial.page.html` — Detail panel: `@for` over `sel.jornadas`; one card per jornada with own Descargar/Preview buttons

## Phase 4: Feature B (CRUD Productos)

- [x] 4.1 `src/app/services/producto.service.ts` — Add `crear(data)` → INSERT and RETURNING; `actualizar(id, data)` → UPDATE; `eliminar(id)` → DELETE
- [x] 4.2 `src/app/pages/inventario/inventario.page.ts` — Add signals: `showProductoModal`, `editandoProductoId`, `formNombre/Costo/PrecioVenta/Unidades`, `formError`, `confirmandoEliminar`, `procesando`
- [x] 4.3 `src/app/pages/inventario/inventario.page.ts` — Add `abrirNuevoProducto()`, `abrirEditarProducto(p)`, `guardarProducto()` with validation, `confirmarEliminar(id)`, `ejecutarEliminar()`, `cancelarEliminar()`, `cerrarModal()`
- [x] 4.4 `src/app/pages/inventario/inventario.page.html` — Add "Nuevo producto" button; modal form with 4 fields + Guardar/Cancelar; `precio_costo` column in table; Editar/Eliminar buttons per row with confirmation dialog
- [x] 4.5 `src/app/pages/inventario/inventario.page.css` — Modal overlay styles (fixed position, backdrop, centered card) via Tailwind classes

## Phase 5: Feature D (Export Range)

- [x] 5.1 `src/app/services/jornada.service.ts` — Add `jornadasDelRango(desde, hasta)` + `generarExportacionPorRango(desde, hasta)`: fetch jornadas in range, `_recolectarDatosJornada` per jornada, `generarExcelMensual(allData)`
- [x] 5.2 `src/app/pages/historial/historial.page.ts` — Add signals `showRangePicker`, `rangoDesde`, `rangoHasta`, `exportandoRango`; methods `toggleRangePicker()`, `exportarRango()` calling `_jornadaService.generarExportacionPorRango`
- [x] 5.3 `src/app/pages/historial/historial.page.html` — Add "Exportar rango" button + date inputs (desde/hasta) + confirm/cancel buttons, disabled during export. Added `FormsModule` import.

## Phase 6: Tests

- [x] 6.1 `src/app/services/producto.service.spec.ts` — Test `crear`, `actualizar`, `eliminar` mock DB calls
- [x] 6.2 `src/app/services/stock-movimiento.service.spec.ts` — Test `registrarEntrada/Salida/Ajuste` with `jornada_id` param
- [x] 6.3 `src/app/services/jornada.service.spec.ts` — Test `generarExportacionPorRango` returns Excel for valid range; throws for empty range; passes user_cierre_id per jornada
- [x] 6.4 `src/app/services/excel.service.spec.ts` — Test "Stock" sheet exists in `generarExcelJornada` output; "Movimientos de Stock" in `generarExcelMensual`
- [x] 6.5 `src/app/pages/historial/historial.page.spec.ts` — Test 2 jornadas same date → grid() has both; detail panel shows 2 cards; export range button click, error handling, validation
- [x] 6.6 `src/app/pages/inventario/inventario.page.spec.ts` — Test modal opens for new product/editing; validation rejects empty; save calls ProductoService; delete confirmation flow; Precio Costo column; cerrarModal
