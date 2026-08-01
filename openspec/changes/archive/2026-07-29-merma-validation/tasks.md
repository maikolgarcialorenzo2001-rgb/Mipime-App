# Tasks: merma-validation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Service validation + UI stock check + confirm + jornada column + tests | PR 1 | All in one PR (< 400 lines), base = main |

## Phase 1: Foundation / Model

- [x] 1.1 `src/app/models/stock-movimiento.ts` — agregar `ubicacion?: string` al interface (para que la UI jornada pueda tiparlo)
- [x] 1.2 `src/app/services/stock-movimiento.service.ts` — cambiar `registrarMerma()` firma: `motivo` pasa de `motivo?: string` a `motivo: string` (obligatorio). Agregar `if (!motivo || motivo.trim().length === 0) throw new Error('El motivo es obligatorio')` como primer check. Actualizar JSDoc.

## Phase 2: UI Producto Page

- [x] 2.1 `src/app/pages/productos/producto.page.ts` — agregar computed `mermaStockDisponible` que según `mermaUbicacion` devuelve `producto.stock_shop` o `producto.stock_almacen`. Agregar computed `mermaStockSuficiente` que compara `mermaCantidad` vs `mermaStockDisponible`.
- [x] 2.2 `src/app/pages/productos/producto.page.html` — agregar indicador visual de stock disponible en el form de merma. Deshabilitar botón submit con `mermaStockSuficiente()` y agregar `[title]` tooltip "Stock insuficiente" cuando corresponda.
- [x] 2.3 `src/app/pages/productos/producto.page.ts` — envolver `onSubmitMerma()` con `confirm('¿Registrar merma de ' + cantidad + ' unidades de ' + producto + '?')`. Si confirm devuelve false, return sin llamar al service. Mostrar motivo y ubicación en el mensaje.

## Phase 3: UI Jornada Page

- [x] 3.1 `src/app/pages/jornada/jornada.page.html` — agregar columna `<th>Ubicación</th>` en tabla de mermas y celda `<td>{{ m.ubicacion ? (m.ubicacion === 'almacen' ? 'Almacén' : 'Tienda') : '—' }}</td>`.

## Phase 4: Testing

- [x] 4.1 `src/app/services/stock-movimiento.service.spec.ts` — test: `registrarMerma(1, 5, '')` rechaza con "El motivo es obligatorio". Test: `registrarMerma(1, 3, 'Rotura', undefined, 'almacen')` pasa ubicacion a `_consumirFIFO`.
- [x] 4.2 `src/app/pages/productos/producto.page.spec.ts` — test: `mermaCantidad.set(999)` con producto stock=10 → botón disabled + tooltip. Test: `onSubmitMerma()` con `confirm` mock devolviendo `false` → `registrarMerma` no llamado.
