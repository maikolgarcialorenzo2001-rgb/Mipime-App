# Apply Progress: fix-inventario-bugs (F7)

> Change: F7 del plan `docs/Fix-Inventario-Bugs.md` (P3: edición por lote mixto preselecciona
> lote viejo de cualquier ubicación; historial registra ajustes como absoluto en vez de delta).
> Branch: `f4-f7` (contiene F4+F5+F6). Strict TDD activo. Runner: vitest.

## Estado

- [x] F7-RED — 19 tests (12 service + 7 page) failed (RED confirmado)
- [x] F7-GREEN — 94/94 spec service, 62/62 spec page; suite completa 886/886 (46 files); lint limpio en archivos tocados

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| R1 (delta en historial) | `src/app/services/stock-movimiento.service.spec.ts` | Unit | ✅ 145/145 (2 specs) | ✅ 12 failed (INSERT con absoluto + secuencia sin SELECT) | ✅ 94/94 | ✅ 4 casos: delta negativo (ajuste + editar), delta positivo (ambos), guard lote inexistente | ✅ Guard con mensaje rioplatense consistente (`_consumirFIFO` usa el mismo patrón) |
| R2 (preselección por ubicación) | `src/app/pages/inventario/inventario.page.spec.ts` | Unit | ✅ 145/145 (2 specs) | ✅ 7 failed (5 función no existe + 2 preselección global-viejo) | ✅ 62/62 | ✅ 5 casos función pura + 2 casos integración page (almacen principal / shop principal) | ✅ Función pura exportada (extract-before-mock) |

## Test Summary

- **Total tests escritos**: 11 (4 service + 7 page)
- **Total tests pasando**: 886/886 suite (875 previos + 11 nuevos)
- **Layers**: Unit (11)
- **Approval tests**: Ninguno (sin refactoring de comportamiento existente)
- **Pure functions**: 1 — `elegirLoteInicialEdicion(lotes, stockAlmacen, stockShop)` exportada desde `inventario.page.ts`

## Implementación

- `stock-movimiento.service.ts` — `registrarAjusteLote` y `registrarEditar`:
  - Paso 0 nuevo al inicio de la txn: `SELECT * FROM lotes_stock WHERE id = ? AND producto_id = ?`
    para leer la cantidad actual del lote; `throw new Error('El lote no existe')` si no hay fila
    (sin valor previo no hay delta posible — evita INSERT con NaN).
  - El INSERT del movimiento pasa de `nuevaCantidad` (absoluto) a `delta = nuevaCantidad - loteActual.cantidad`.
    Un cambio 10→3 figura ahora como `'ajuste'` con `-7` (antes `3`).
- `inventario.page.ts` — `onSelectAction` (case `'editar'`):
  - Nueva función pura exportada `elegirLoteInicialEdicion`: preselecciona el frente FIFO de la
    ubicación con más stock del producto (empate → `'almacen'`, ubicación primaria de la app);
    si la ubicación principal no tiene lotes (dato legacy divergente) cae al frente FIFO global.
  - `selectedLoteIndex` ahora se deriva del lote elegido (`indexOf + 1`) y el prefill
    (precio_costo/cantidad) usa ese lote.

## Decisiones

- **Opción A del plan F7** (filtrar por ubicación al preseleccionar): el selector sigue mostrando
  TODOS los lotes (con su ubicación en el label — ya existía en `inventario.page.html`), solo la
  PRESELECCIÓN se filtra por la ubicación principal. Filtrar la lista completa rompería la edición
  de lotes de la otra ubicación.
- **Regla de ubicación principal**: `stockAlmacen >= stockShop ? 'almacen' : 'shop'` — la
  ubicación donde el producto concentra su stock es la más probable de editar; empate → almacen
  (ubicación primaria: `registrarEntrada` default, orden del toast y de las columnas de la tabla).
  Determinística y preserva los tests pre-existentes de editar (lotes de una sola ubicación).
- **`obtenerLotesPorProducto` NO cambia**: la query "no filtra por ubicación" es el diagnóstico
  del bug (necesita devolver todas las ubicaciones — el toggle "Lotes" y la tabla lotes la usan);
  el filtro vive en la preselección. Agregar un parámetro opcional habría sido código muerto.
- **`registrarAjuste` (full) NO cambia**: semántica distinta ("redefinir stock total en almacén"),
  sin caller de producción; fuera del alcance F7.
- **Actualización deliberada de tests pre-existentes**: `debería registrar movimiento tipo ajuste`
  y `debería actualizar producto precio_venta y lote precio_costo/cantidad` fijaban el absoluto
  (`[1, 5, 'ajuste']`, `[1, 8, 'ajuste']`). Son specs del cambio (el delta ES el nuevo contrato),
  no regresiones — verificado contra el plan F7 y auditado el consumo de `stock_movimientos`
  (solo display; cálculos usan exclusivamente tipo='merma' en `jornada.service.ts`/`jornada.page.ts`).

## Archivos

| File | Acción |
|------|--------|
| `src/app/services/stock-movimiento.service.ts` | Modificado (R1: SELECT delta + guard en ambos métodos) |
| `src/app/services/stock-movimiento.service.spec.ts` | Modificado (R1: 12 tests actualizados + 4 nuevos) |
| `src/app/pages/inventario/inventario.page.ts` | Modificado (R2: función pura + wiring en `onSelectAction`) |
| `src/app/pages/inventario/inventario.page.spec.ts` | Modificado (R2: 7 tests nuevos) |

## Risks

- El `SELECT` inicial agrega una lectura por operación de edición/ajuste de lote (negligible, misma txn).
- `delta = 0` (edición sin cambio de cantidad) registra un movimiento 'ajuste' con 0 — mismo
  comportamiento que antes (siempre registraba), solo cambia el valor almacenado.
- Consumidores de `stock_movimientos` auditados: historial (`inventario.page.html` ~414 muestra
  el delta con signo, correcto), export Excel (`excel.service.ts` ~744 — fixtures mock hardcodeados,
  sin dependencia del servicio), jornada (solo tipo='merma'). Sin impacto en cálculos.
