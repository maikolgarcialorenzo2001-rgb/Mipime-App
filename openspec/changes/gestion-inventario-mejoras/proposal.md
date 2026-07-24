# Proposal: Gestión de Inventario — Mejoras

## Intent

Solucionar el bug de múltiples jornadas por día en HistorialPage (se sobrescriben con `Map<string, Jornada>`), agregar CRUD de productos admin-only en InventarioPage, incluir movimientos de stock en Excel (diario/mensual), y permitir exportación por rango de fechas.

## Scope

### In Scope
- **A**: Multi-jornada: `Map<string, Jornada[]>` + badge N jornadas + detalle por jornada
- **B**: CRUD productos (modal reusable nuevo/editar + delete con confirmación) + columna `precio_costo` visible
- **C**: Hoja "Movimientos de Stock" en Excel diario y mensual + migration v7 (`jornada_id` nullable en `stock_movimientos`)
- **D**: Exportar jornadas por rango de fechas desde HistorialPage

### Out of Scope
- Edición masiva de productos
- Exportación en PDF
- Dashboard o gráficos de inventario

## Capabilities

### New Capabilities
- `stock-movimientos-excel`: Hoja separada de movimientos de stock en exportación diaria y mensual.

### Modified Capabilities
- `inventario`: Se agrega CRUD admin (crear/editar/eliminar productos) + columna `precio_costo`.
- `historial-jornadas`: Calendario soporta múltiples jornadas por día + exportación por rango de fechas.

## Approach

**A**: Cambiar `DiaCalendario.jornada?: Jornada` → `jornadas: Jornada[]`. `_jornadasPorFecha` pasa a `Map<string, Jornada[]>`. Calendario muestra N badges si hay N jornadas. Panel de detalle itera tarjetas por jornada.

**B**: Modal flotante reutilizable en InventarioPage para Nuevo/Editar producto. `ProductoService.crear()`, `actualizar()`, `eliminar()`. Columna `precio_costo` agregada a la tabla HTML con `*ngIf` de rol admin.

**C**: Migration v7: `ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id)`. `StockMovimientoService.registrarEntrada/Salida/Ajuste` aceptan `jornada_id?: number`. ExcelService agrega hoja "Mov. Stock" con JOIN a productos. JornadaService pasa movimientos del día al Excel.

**D**: Nuevo método `JornadaService.jornadasDelRango(fechaDesde, fechaHasta)` que reusa `_recolectarDatosJornada` + `ExcelService.generarExcelMensual`. Date picker en HistorialPage con fechas desde/hasta + botón "Exportar rango".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `historial.page.ts` | Modified | Multi-jornada + exportar rango |
| `historial.page.html` | Modified | Badge N, detalle por jornada, date picker rango |
| `inventario.page.ts` | Modified | Signals/methods para modal CRUD |
| `inventario.page.html` | Modified | Modal flotante + columna precio_costo + delete confirm |
| `producto.service.ts` | Modified | `crear()`, `actualizar()`, `eliminar()` |
| `sqlite.service.ts` | Modified | Migration v7 |
| `stock-movimiento.service.ts` | Modified | `jornada_id?` param en registrar* |
| `stock-movimiento.ts` | Modified | `jornada_id?: number` |
| `excel.service.ts` | Modified | Hoja "Mov. Stock" en diario y mensual |
| `jornada.service.ts` | Modified | `jornadasDelRango()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration v7 falla en ALTER TABLE con datos existentes | Low | `ALTER TABLE ADD COLUMN` con try/catch (mismo patrón v2) |
| Stock movements sin jornada_id quedan huérfanos | Low | Columna nullable, null es válido (fuera de jornada) |
| Multi-jornada rompe vista previa existente | Medium | Preview itera `jornadas[]`, no `jornada?` — compatible hacia adelante |

## Rollback Plan

1. Migration v7: `ALTER TABLE stock_movimientos DROP COLUMN jornada_id` (o ignorar columna)
2. Revertir modelo StockMovimiento, servicios, y templates de historial e inventario
3. Restaurar `DiaCalendario.jornada?: Jornada` original

## Dependencies

- Migration v7 debe ejecutarse antes de Feature C
- Features A, B, D son independientes entre sí

## Success Criteria

- [ ] Dos jornadas en misma fecha muestran 2 badges en calendario
- [ ] Preview del día seleccionado muestra N tarjetas (una por jornada)
- [ ] Admin puede crear/editar/eliminar productos desde InventarioPage
- [ ] `precio_costo` visible en tabla de inventario
- [ ] Excel diario y mensual incluyen hoja "Mov. Stock" con columnas Producto, Tipo, Cantidad, Motivo, Fecha
- [ ] Exportación por rango de fechas descarga Excel con todas las jornadas del rango
- [ ] Tests existentes pasan + nuevos tests para cada feature
