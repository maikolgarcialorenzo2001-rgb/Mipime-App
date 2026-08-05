# SDD — Exploration: `pagar-pendiente`

> Artefacto de exploración (2026-08-05). Guardado también en Engram (`sdd/pagar-pendiente/explore`).
> NOTA: la conclusión "excluir pendientes del mismo día" fue **SUPERSEDIDA** por decisión del usuario (incluir mismo día, modelo de dos operaciones). Ver spec FR-2.

## Executive summary

El método de pago "Pendiente" **ya existe end-to-end**: desde la migración v6, una venta registrada como "Pendiente" persiste `comprador_nombre`/`autorizado_por`/`descripcion`/`total` en `ventas`, consume stock vía FIFO al momento de la venta, y suma su total a `jornadas.total_ventas` pero NO a `saldo_esperado` (la plata nunca entra a la caja). Excel ya trackea "Pendientes del día" por jornada.

Lo que FALTA es solo el lado del cobro: no hay query/UI para listar pendientes sin cobrar, no hay forma de marcarlos como cobrados, y no hay camino de efectivo para acreditar la caja de hoy.

El cobro NO debe pasar por `VentaService.registrar` (doble-consumo de stock y doble-insert de detalles). Recomendado: migración v17 con `cobro_de_venta_id` nullable + `registrarCobroPendiente()` dedicado que inserta una venta cash (efectivo/transferencia/divisas) SIN stock/detalles, de modo que todas las agregaciones existentes de caja/cierre/Excel (que iteran `ventas`) capturan la plata con CERO cambios.

## Estado actual (file:line)

- **Métodos de pago (5)**: checkout-modal.component.html:35-143 — Efectivo, Transferencia, Divisas, Pendiente, Cuenta Casas. `formaPago` signal default 'efectivo' (checkout-modal.component.ts:31). Cuenta Casas → `CuentaCosasService` (pos.page.ts:183-195); el resto → `VentaService.registrar` (pos.page.ts:196-212).
- **Storage del pendiente**: db-migrations.ts:312 — `ventas.forma_pago CHECK IN ('efectivo','transferencia','divisas','pendiente')` (desde v6, line 302-337); columnas comprador_nombre/autorizado_por/descripcion (v6), completacion_efectivo (v16, line 544-553).
- **Schema `ventas` actual**: db-migrations.ts:304-319 — id, jornada_id FK, fecha_hora, total, created_at, usuario_id, forma_pago (CHECK), divisa_tipo, monto_divisa, tasa_cambio, comprador_nombre, autorizado_por, descripcion, completacion_efectivo. **NO hay columna estado/pagado/cobrado.** Model: models/venta.ts:1-16.
- **Versión de migración: 16** — db-migrations.spec.ts:73-79 assert v1..v16; patrón runner en db-migrations.ts:36-103 (`if (currentVersion < N) migrationVN(exec)`); ALTERs con try/catch idempotente (v16 line 544-553); cambios de CHECK usan table-recreate + PRAGMA foreign_keys=OFF (v15, line 516-542). Tests con FakeExecutor (db-migrations.spec.ts:8-55).
- **Persistencia de venta**: venta.service.ts — `registrar()` (ts:37-62) → `_ejecutar` (ts:77-236): BEGIN, validar stock (ts:64-75), INSERT ventas con columnas condicionales (ts:105-161), INSERT detalle_ventas en batch de 25 (ts:164-188), `efectivoEnCaja` solo efectivo/divisas (ts:190-197), UPDATE jornadas `total_ventas += total, saldo_esperado += efectivoEnCaja` (ts:199-206), salida FIFO por ítem vía `StockMovimientoService.registrarSalida` + insert `venta_lotes` (ts:208-228), COMMIT/ROLLBACK.
- **Stock**: stock-movimiento.service.ts:179-218 `registrarSalida` → `_consumirFIFO` (ts:29-114) consume los lotes_stock más antiguos en ubicacion 'shop', decrementa lote, sincroniza productos.stock_shop con la suma de lotes. Para venta pendiente el stock se consume AL MOMENTO DE LA VENTA.
- **Caja/jornada**: jornada.service.ts — `totalEnCaja` signal computado desde ventas (efectivo completo, divisas neto de vuelto) + movimientos (ts:163-190). `saldo_real` al cierre = monto_inicial + totalVentasEfectivo + total_movimientos (ts:411-425); pendientes excluidos de saldo_real por diseño. Totales divisa total_usd/total_eur desde ventas.divisa_tipo + movimientos compra_divisa (ts:427-441). Movimientos CHECK solo ('gasto','ingreso_extra','compra_divisa') (db-migrations.ts:524).
- **Excel**: excel.service.ts — Resumen excluye pendientes de "Total ventas + ingresos extra" (ts:67-74), muestra "Pendientes del día" (ts:104-106,154), hoja ventas agrega columna "Comprador" cuando hay pendientes (ts:224-229), footer "Total esperado" = caja+divisas+pendientes+transferencia (ts:338-341).
- **Historial**: historial.page.ts preview itera venta.detalles (ts:76-101) — una venta sin detalles no aparecería en la tabla de productos.
- **Patrones UI**: modales standalone renderizados condicionalmente con `@if (showModal())` en el padre (pos.page.html:127-137), inputs/outputs + signals, backdrop click + Escape (checkout-modal.component.ts:123-133), botones Tailwind rounded-lg con azul activo / verde confirm. POS: búsqueda+grilla a la izquierda, panel carrito a la derecha con botón "Cobrar" dentro de `@if (cart.items().length > 0)` (pos.page.html:91-114), deshabilitado con `sinJornada`.
- **Tests**: prefijos RED/GREEN en español con numeración; `createMockDb()` = { sql: vi.fn().mockResolvedValue([]), initialize: vi.fn() } + token DATABASE (venta.service.spec.ts:34-39); `mockResolvedValueOnce` secuencias por cada SQL (venta.service.spec.ts:74-104); componentes con fixture.componentRef.setInput (checkout-modal.component.spec.ts:33-35); pos.page.spec.ts:210-232 cubre routing formaPago=pendiente.

## Gap analysis

1. **Storage al vender** — YA EXISTE (v6+). Requisito 2 satisfecho; solo falta el marcador de cobro.
2. **Lista de pendientes** — FALTA. No hay query que devuelva pendientes sin cobrar; no hay UI.
3. **Flujo de cobro** — FALTA. Sin método de servicio, sin modal, sin camino cash que evite doble-contar stock/detalles/total_ventas, sin forma de marcar cobrado.
4. **Opciones de pago deshabilitadas en el cobro** — FALTA. El checkout-modal actual no tiene estados disabled.
5. **Entidad cliente** — NO EXISTE (solo comprador_nombre texto libre). OK para esta feature.

## Implicaciones de schema (migración v17 — próximo número libre)

- `ALTER TABLE ventas ADD COLUMN cobro_de_venta_id INTEGER REFERENCES ventas(id)` (nullable; try/catch idempotente, patrón de v16). La venta cobro referencia al pendiente original → su existencia ES el estado "cobrado"; no hace falta cambiar el CHECK (el set de forma_pago sigue válido).
- Opcional (recomendado): `ALTER TABLE ventas ADD COLUMN pagado_en TEXT` (timestamp) para queries baratas: `WHERE forma_pago='pendiente' AND pagado_en IS NULL`.
- Índice parcial opcional `CREATE INDEX idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente'`.
- Actualizar db-migrations.spec.ts (v1..v17). APP_VERSION (version.ts, generado por scripts/sync-version.mjs) actualmente 0.1.12-beta; bump según convención del repo.

## Puntos de integración

- **pos.page.html**: botón "Cobrar Pendiente" FUERA del bloque `cart.items().length > 0` (hoy el único CTA está dentro, pos.page.html:91); habilitado con `!sinJornada`. Abre `@if (showPendienteModal()) <app-cobro-pendiente-modal ...>` siguiendo el patrón checkout-modal (pos.page.html:127-137).
- **Nuevo modal** (cobro-pendiente-modal): paso 1 = lista de pendientes (comprador, fecha, monto); paso 2 = opciones de pago con SOLO Efectivo/Transferencia/Divisas (Cuenta Casas y Pendiente deshabilitadas) + sub-form divisa reusado de checkout-modal (tasa/billete/completacion con guard de vuelto saldoEnCaja); confirma vía output.
- **Servicio** (CobroPendienteService): `listarPendientes()` → `SELECT ... WHERE forma_pago='pendiente' AND pagado_en IS NULL` y `registrarCobroPendiente({ventaId, jornadaId, usuarioId, formaPago, divisaTipo, billeteRecibido, tasaCambio, completacionEfectivo})` — BEGIN, re-check pagado_en in-txn, INSERT venta (forma_pago efectivo/transferencia/divisas + cobro_de_venta_id + campos divisa, SIN detalle_ventas, SIN stock, SIN venta_lotes), UPDATE original SET pagado_en, UPDATE jornada total_ventas += monto / saldo_esperado += netCash (espeja registrar ts:190-206), COMMIT.
- **Excel**: `_agregarVentas` (excel.service.ts:221-341) debe renderear filas de cobro sin detalles como "Cobrar Pendiente #id" e incluirlas en totalCaja; Resumen ya las cuenta vía venta.total (ts:71-73,90-97).
- **JornadaService**: SIN cambios — totalEnCaja, cierre saldo_real, total_usd/eur iteran ventas y capturan el cobro automáticamente.

## Riesgos

- **Doble conteo**: usar VentaService.registrar para un cobro re-valida+consume stock, inserta detalles y re-suma total — DEBE ser un path dedicado.
- **Integridad de jornadas cerradas**: nunca UPDATE in-place de la forma_pago del pendiente original — el saldo_real/Excel de la jornada cerrada están congelados; mutar la fila desincroniza el registro.
- **Doble cobro concurrente**: guardar con el check de pagado_en/cobro_de_venta_id DENTRO de la transacción.
- **Seguridad de migración (instalador Windows, DB viva)**: v17 debe ser ALTER aditivo (columna nullable); NO recrear ventas (FKs desde detalle_ventas/venta_lotes); try/catch idempotente. Pendientes existentes con cobro_de_venta_id NULL = cobrables retroactivamente.
- **Reconciliación Excel**: sin el special case de fila sin detalles, un cobro es invisible en el footer de la hoja Ventas mientras cuenta en totales de caja → el Excel de fin de día no reconcilia. Si en cambio se copian detalles del original, el fallback de costo del cierre (jornada.service.ts:493-502, solo cuando no hay venta_lotes, datos legacy) inflaría el costo en días con solo cobros.
- **Semántica**: el cobro incrementa el total_ventas de HOY (plata recibida hoy) — aceptable y consistente con cómo se calcula la caja.

## Enfoques

1. **Cobro como venta nueva + marcador `cobro_de_venta_id` (RECOMENDADO)** — ALTER v17; registrarCobroPendiente dedicado (sin stock/detalles); lista = pendiente AND no cobrado. Pros: cero cambios a la matemática caja/cierre/divisa/Excel-Resumen; divisa manejada por columnas existentes incl. total_usd/eur; delta de schema mínimo; retroactivo. Cons: el cobro aparece en historial/Excel como venta (necesita label por marcador); la hoja Ventas de Excel necesita el special case de fila sin detalles.
2. **Tabla dedicada `cobros_pendientes` + enseñarle a cada agregación de caja** — nueva tabla + ventas.pagado_en; el cobro inserta fila y acredita saldo_esperado. Pros: separación semántica. Cons: ALTO riesgo de regresión — totalEnCaja, _ejecutarCierre, autoCerrarSiOtroUsuario, Excel Resumen, Excel Ventas, total_usd/eur necesitan cambios cobro-aware (6+ touchpoints en la ruta crítica del dinero).
3. **UPDATE del pendiente original in-place (forma_pago → efectivo)** — solo viable para pendientes de la misma jornada; corrompe jornadas cerradas y sus Excel congelados para el caso cross-day (el escenario real de la feature). RECHAZADO.

## Recomendación

Enfoque 1: migración aditiva v17 (`cobro_de_venta_id` + `pagado_en`), nuevo `CobroPendienteService` con `listarPendientes`/`registrarCobroPendiente` (sin stock, sin detalles, marcador, guard in-txn), modal `cobro-pendiente-modal` reusando patrones de checkout-modal con Cuenta Casas/Pendiente deshabilitadas, botón en pos.page (visible sin carrito, deshabilitado sin jornada), y un special case puntual en Excel `_agregarVentas`. JornadaService intacto.

## Listo para propuesta

Sí. Avisar al usuario: las ventas pendientes ya se guardan con datos del comprador y el stock ya se consume al vender; la feature solo agrega lista + cobro. El cobro acredita la caja de hoy como venta cash vinculada al original. NOTA: el usuario decidió que los pendientes del MISMO DÍA también aparezcan en la lista (dos operaciones separadas) — ver spec FR-2.
