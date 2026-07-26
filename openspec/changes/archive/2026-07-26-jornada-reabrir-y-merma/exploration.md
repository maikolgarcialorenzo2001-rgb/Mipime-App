# Exploration: Reabrir Jornada + Merma

## Current State

### Jornada
- `Jornada` model: id, fecha, hora_apertura, monto_inicial, hora_cierre, total_ventas, total_gastos, saldo_esperado, saldo_real, estado, user_cierre_id, created_at, updated_at
- **Sin `user_apertura_id`** — no hay forma de saber quién abrió la jornada
- `AuthService._restoreSession()` limpia sesión al cerrar tab (heartbeat sessionStorage), pero NO cierra la jornada
- `JornadaService.constructor()` → `refreshJornadaAbierta()` busca jornada abierta del día
- `abrir(montoInicial)` INSERT con estado='abierta', no guarda usuario
- `cerrar(id, saldoReal, userId)` UPDATE estado='cerrada', genera Excel
- Login: LoginPage navega a /pos al hacer login exitoso

### Merma
- `StockMovimiento`: id, producto_id, cantidad, tipo ('entrada'|'salida'|'ajuste'), motivo, jornada_id, created_at
- `_consumirFIFO()` consume lotes más antiguos, retorna ConsumoRecord[]
- `registrarSalida()` usa FIFO, actualiza stock
- `lotes_stock`: id, producto_id, cantidad, precio_costo, fecha_ingreso
- `venta_lotes`: id, venta_id, lote_id, producto_id, cantidad, precio_costo_real
- `saldo_esperado = monto_inicial + total_ventas - total_gastos`
- JornadaPage: solo summary card + form movimientos + modal cierre. **Sin tabla detallada**
- InventarioPage: botones Entrada/Salida/Ajuste por producto

### DB
- SQLite via SQLocal, migraciones v1-v8
- `schema_version` table rastrea versión actual

## Affected Areas

### Feature 1: Reabrir Jornada
- `src/app/models/jornada.ts` — agregar user_apertura_id
- `src/app/services/sqlite.service.ts` — migration v9 (ALTER TABLE)
- `src/app/services/jornada.service.ts` — abrir() guarda user_apertura_id, nuevo método autoCerrarSiOtroUsuario()
- `src/app/services/auth.service.ts` — after login, check jornada ownership
- `src/app/pages/login/login.page.ts` — after login, trigger jornada check
- `src/app/pages/jornada/jornada.page.ts` + `.html` — modal de reapertura
- `src/app/pages/jornada/jornada.page.spec.ts` — tests

### Feature 2: Merma
- `src/app/models/stock-movimiento.ts` — agregar tipo 'merma' + costo_total
- `src/app/models/jornada.ts` — agregar total_merma
- `src/app/services/sqlite.service.ts` — migration v9 (ALTER TABLE stock_movimientos + jornadas)
- `src/app/services/stock-movimiento.service.ts` — nuevo registrarMerma() usando FIFO
- `src/app/pages/inventario/inventario.page.ts` + `.html` — botón Merma + form
- `src/app/pages/jornada/jornada.page.ts` + `.html` — tabla ventas/movimientos/merma
- `src/app/components/jornada-summary-card/jornada-summary-card.component.ts` + `.html` — mostrar total_merma
- `src/app/services/jornada.service.ts` — calcular total_merma en refreshJornadaAbierta y cerrar
- `src/app/services/excel.service.ts` — incluir merma en Excel
- Tests: stock-movimiento.service.spec.ts, inventario.page.spec.ts, jornada.page.spec.ts

## Approach: Reabrir Jornada

### Migration v9
```sql
ALTER TABLE jornadas ADD COLUMN user_apertura_id INTEGER REFERENCES usuarios(id);
```

### JornadaService
- `abrir(montoInicial, userId)` — guardar user_apertura_id
- `obtenerAbierta()` — incluir user_apertura_id en SELECT
- Nuevo: `autoCerrarSiOtroUsuario(usuarioActual: UsuarioPublico)`:
  1. Buscar jornada abierta del día
  2. Si no hay → retornar null
  3. Si hay y user_apertura_id !== usuarioActual.id → cerrar automáticamente (UPDATE estado='cerrada', user_cierre_id=usuarioActual.id)
  4. Si hay y user_apertura_id === usuarioActual.id → retornar la jornada (para que LoginPage muestre modal)

### AuthService
- Nuevo método: `getUsuarioActual()` que retorna signal actual (ya existe como `usuario`)
- No necesita cambios significativos

### Login Flow
1. LoginPage hace login → navega a /pos
2. En /pos (o en App component), se verifica: ¿hay jornada abierta del día?
3. Si sí: ¿user_apertura_id === usuarioActual.id?
   - Sí → mostrar modal "Reabrir jornada" con opciones: Reabrir / Cerrar y guardar
   - No → auto-cerrar jornada anterior, abrir nueva automáticamente
4. Si no hay jornada → mostrar空 state "Iniciar día"

### UI — Modal de Reapertura
- Similar al modal de cierre existente
- Título: "Jornada del día"
- Mensaje: "Hay una jornada abierta de hoy. ¿Qué deseas hacer?"
- Botones: "Reabrir jornada" (verde) / "Cerrar y guardar" (rojo)
- Al cerrar: generar Excel como en cerrar normal

## Approach: Merma

### Migration v9 (continuación)
```sql
ALTER TABLE stock_movimientos ADD COLUMN costo_total REAL DEFAULT 0;
ALTER TABLE jornadas ADD COLUMN total_merma REAL DEFAULT 0;
-- + user_apertura_id de arriba
```

### StockMovimientoService
- Nuevo tipo: `'merma'` en StockMovimiento interface
- Nuevo método: `registrarMerma(productoId, cantidad, motivo?, jornadaId?)`:
  1. Consumir FIFO (reusar `_consumirFIFO`)
  2. Calcular costo total de consumos
  3. INSERT en stock_movimientos con tipo='merma' y costo_total
  4. Actualizar stock (derived from lots)
  5. Retornar { consumos, costoTotal }

### JornadaService
- `refreshJornadaAbierta()` — calcular total_merma al cargar jornada
- Nuevo: `calcularTotalMerma(jornadaId)` — SUM(costo_total) WHERE tipo='merma' AND jornada_id=?
- `saldo_esperado = monto_inicial + total_ventas - total_gastos - total_merma`
- `_ejecutarCierre()` — incluir merma en cálculos y Excel

### JornadaPage
- Nueva tabla debajo del summary card:
  - Sección "Ventas del día" con cada venta (fecha, total, forma_pago)
  - Sección "Movimientos" con gastos/ingresos extra
  - Sección "Mermas" con producto, cantidad, costo
- Todos los totales afectados por merma

### InventarioPage
- Nuevo botón "Merma" (rojo/naranja) al lado de Ajustar
- Al hacer click: abrir form inline similar a Salida
- Campos: cantidad, motivo (opcional)
- Al enviar: llamar registrarMerma() con jornadaId actual

### JornadaSummaryCard
- Nuevo campo: "Mermas" con total_merma (rojo, negativo)
- saldo_esperado ya incluye descuento de merma

## Recommendation

Ambas features comparten migration v9 y tocan el mismo modelo Jornada. Unificar en un solo cambio SDD con 2 PRs encadenados:

**PR #1 (Jornada):** Migration v9 + Jornada model + JornadaService (user_apertura_id, auto-close, reopen) + JornadaPage (modal reopen) + tests
**PR #2 (Merma):** StockMovimiento model + StockMovimientoService (registrarMerma) + InventarioPage (botón merma) + JornadaPage (tabla detallada) + JornadaSummaryCard (total_merma) + Excel + tests

## Risks

1. **Migration v9** — ALTER TABLE en SQLite con SQLocal puede fallar si la columna ya existe (manejar con try/catch como v7)
2. **saldo_esperado recalculation** — al agregar total_merma, el cálculo cambia. Jornadas abiertas existentes necesitan recálculo
3. **Concurrencia** — si dos usuarios hacen login al mismo tiempo con la misma jornada abierta, el auto-close puede tener race condition (mitigar con transacción)
4. **Excel generation** — merma debe reflejarse en el Excel de cierre, lo que requiere modificar ExcelService

## Ready for Proposal
Yes — ambos features están claros, los archivos están identificados, y la approach es sólida. Proceder con proposal.
