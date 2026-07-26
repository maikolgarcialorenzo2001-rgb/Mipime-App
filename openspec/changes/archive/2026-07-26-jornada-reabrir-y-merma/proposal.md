# Proposal: Reabrir Jornada + Merma

## Intent

Proteger la integridad del negocio con dos features acopladas:
1. **Reabrir jornada** — prevenir acceso no autorizado a jornadas ajenas, auto-cierre para usuarios diferentes
2. **Merma** — registrar rotura/perdida de productos con costo FIFO, reflejado en ganancia del día

## Scope

### In Scope
- Migration v9: 3 columnas nuevas (jornadas.user_apertura_id, stock_movimientos.costo_total, jornadas.total_merma)
- JornadaService: abrir() guarda usuario, autoCerrarSiOtroUsuario(), calcularTotalMerma()
- JornadaPage: modal reapertura + tabla detallada (ventas/movimientos/mermas)
- StockMovimientoService: registrarMerma() con FIFO
- InventarioPage: botón Merma + form inline
- JornadaSummaryCard: mostrar total_merma
- Excel: incluir mermas en reporte de cierre
- Tests para todos los cambios nuevos

### Out of Scope
- Cambios al sistema de auth (solo se lee usuario actual)
- Nuevas páginas o componentes grandes
- Formato del Excel más allá de agregar merma
- Modificar jornadas cerradas existentes

## Capabilities

### New Capabilities
- `jornada-reopen`: Flujo de reapertura de jornada con verificación de propiedad por usuario
- `merma-tracking`: Registro de rotura/perdida de productos con costing FIFO

### Modified Capabilities
- `jornada-lifecycle`: Jornada ahora trackea user_apertura_id y total_merma; saldo_esperado incluye descuento de merma

## Approach

### Migration v9
```sql
ALTER TABLE jornadas ADD COLUMN user_apertura_id INTEGER REFERENCES usuarios(id);
ALTER TABLE stock_movimientos ADD COLUMN costo_total REAL DEFAULT 0;
ALTER TABLE jornadas ADD COLUMN total_merma REAL DEFAULT 0;
```

### PR #1 — Reabrir Jornada
- Jornada model: +user_apertura_id
- JornadaService: abrir() con userId, autoCerrarSiOtroUsuario()
- Login flow: check ownership → modal o auto-close
- JornadaPage: modal de reapertura (Reabrir / Cerrar y guardar)
- Tests

### PR #2 — Merma
- StockMovimiento model: +tipo 'merma', +costo_total
- Jornada model: +total_merma
- StockMovimientoService: registrarMerma() con FIFO
- InventarioPage: botón Merma
- JornadaPage: tabla ventas/movimientos/mermas
- JornadaSummaryCard: total_merma
- saldo_esperado = monto_inicial + total_ventas - total_gastos - total_merma
- Excel: incluir merma
- Tests

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/models/jornada.ts` | Modified | +user_apertura_id, +total_merma |
| `src/app/models/stock-movimiento.ts` | Modified | +tipo 'merma', +costo_total |
| `src/app/services/sqlite.service.ts` | Modified | Migration v9 |
| `src/app/services/jornada.service.ts` | Modified | abrir(), autoCerrarSiOtroUsuario(), calcularTotalMerma(), cerrar() |
| `src/app/services/stock-movimiento.service.ts` | Modified | registrarMerma() |
| `src/app/services/excel.service.ts` | Modified | Incluir merma en Excel |
| `src/app/pages/jornada/jornada.page.ts` | Modified | Modal reapertura + tabla diaria |
| `src/app/pages/jornada/jornada.page.html` | Modified | UI modal + tabla |
| `src/app/pages/inventario/inventario.page.ts` | Modified | Botón merma + form |
| `src/app/pages/inventario/inventario.page.html` | Modified | UI botón merma |
| `src/app/components/jornada-summary-card/jornada-summary-card.component.html` | Modified | Mostrar total_merma |
| `src/app/pages/login/login.page.ts` | Modified | Trigger jornada check post-login |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration v9 falla si columna ya existe | Low | try/catch como v7 |
| Race condition en auto-close | Low | Transacción atómica en autoCerrarSiOtroUsuario |
| Jornadas abiertas sin user_apertura_id | Medium | NULL = comportamiento actual (sin reapertura) |
| saldo_esperado incorrecto con merma existente | Low | Recalcular al cargar jornada |

## Rollback

- Cada PR es revertible independientemente
- Migration solo agrega columnas (no borra datos)
- Rollback: revert commit + migration inversa (DROP COLUMN)

## Dependencies

- Ninguna dependencia externa
- Requiere que las migraciones v1-v8 ya estén aplicadas

## Success Criteria

- [ ] Diferente usuario en login → auto-cierre de jornada anterior
- [ ] Mismo usuario en login → modal de reapertura
- [ ] Merma reduce stock vía FIFO
- [ ] costo_total refleja costo real FIFO de la merma
- [ ] saldo_esperado incluye descuento de merma
- [ ] JornadaPage muestra tabla detallada con mermas
- [ ] Excel incluye datos de merma
- [ ] Todos los tests existentes pasan
- [ ] Tests nuevos para merma y reapertura pasan
