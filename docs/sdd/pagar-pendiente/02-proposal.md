# SDD — Proposal: `pagar-pendiente`

> Artefacto de propuesta (2026-08-05). Guardado también en Engram (`sdd/pagar-pendiente/proposal` + `proposal-amendments`).

## Intent

El POS ya vende a crédito ("Pendiente") end-to-end desde la migración v6 (datos del comprador, stock consumido al vender, total sumado a `jornadas.total_ventas` pero sin plata). Falta el lado del COBRO: no hay lista de pendientes sin pagar, no hay UI, no hay camino de efectivo que acredite la caja de hoy. Este cambio entrega el flujo "Cobrar Pendiente" end-to-end sin tocar la matemática crítica de caja/cierre.

## Scope

### In Scope
- Botón "Cobrar Pendiente" en el POS (visible sin carrito, deshabilitado sin jornada abierta) + modal de lista de pendientes (comprador, fecha, monto) vía patrón `@if (showPendienteModal())`
- La lista incluye pendientes del MISMO DÍA (decisión 1); venta + cobro son DOS filas separadas en `ventas`
- `CobroPendienteService.listarPendientes` / `registrarCobroPendiente` dedicado (NO `VentaService.registrar`): venta solo-dinero, sin stock, sin detalle_ventas, sin venta_lotes
- Migración v17: columnas aditivas nullable `cobro_de_venta_id` + `pagado_en` (ALTER try/catch idempotente); update db-migrations.spec (v1..v17); bump APP_VERSION
- La fila pendiente original NUNCA se muta en dinero — solo marcadores `pagado_en` + `cobro_de_venta_id` (decisión 4)
- Etiqueta **"Cobrar Pendiente"** en historial y Excel; la venta sigue como "Venta (pendiente)" (decisión 2)
- Modal de cobro deshabilita "Cuenta Casas" y "Pendiente"; Efectivo, Transferencia y Divisas habilitadas (decisión 3); sub-form divisa + guard de vuelto reusados de checkout-modal
- Excel `_agregarVentas` special case para filas de cobro sin detalles (fila única "Cobrar Pendiente #id", incluida en totalCaja); guard de preview en historial para filas sin detalles
- Tests RED/GREEN en español (`ng test`), TDD
- FR-8: botón **"Ver Pendientes"** (solo-lectura) al lado del de cobro — mismo modal con input `soloLectura`
- FR-9: hoja **"Pendientes Acumulados"** en el Excel diario del cierre — todos los pendientes sin cobrar de todas las jornadas (comprador, fecha original, monto, antigüedad)

### Out of Scope
- Cobro parcial (cerrado: NO — cada pendiente se cobra completo)
- Editar/anular pendientes
- Gestión de clientes (no hay entidad cliente; comprador_nombre texto libre)
- Recordatorios/reglas de antigüedad
- Export mensual de pendientes acumulados (FR-9 es solo el cierre diario)

## Contexto / Estado actual

(from exploration `sdd/pagar-pendiente/explore`)
- Schema `ventas` (migración v16): forma_pago CHECK ('efectivo','transferencia','divisas','pendiente'); comprador_nombre/autorizado_por/descripcion (v6); completacion_efectivo (v16). Sin columna estado/pagado. Model models/venta.ts.
- La venta pendiente ya: consume stock vía FIFO (stock-movimiento `_consumirFIFO`), suma a `jornadas.total_ventas`, NO a `saldo_esperado`. Excel Resumen ya muestra "Pendientes del día".
- Todas las agregaciones de caja/cierre/divisa (jornada.service `totalEnCaja`, cierre `saldo_real`, total_usd/eur; excel.service Resumen) iteran `ventas` → una venta cash nueva se captura con CERO cambios. JornadaService intacto.
- Runner de migraciones: `if (currentVersion < N) migrationVN(exec)`, ALTER try/catch idempotente (patrón v16); cambios de CHECK usan table-recreate (v15) — evitar para aditivo.
- Tests: FakeExecutor en db-migrations.spec; createMockDb + token DATABASE; secuencias mockResolvedValueOnce (venta.service.spec).

## Enfoque

Modelo de dos operaciones (decisión 1): la venta pendiente queda como está (producto + total_ventas, sin plata). El cobro inserta una venta cash NUEVA (efectivo/transferencia/divisas) con `cobro_de_venta_id` → id del pendiente original; sin stock/detalles/lotes. Txn de cobro: BEGIN → re-check `pagado_en IS NULL` (guard anti-doble-cobro DENTRO de la txn) → INSERT venta → UPDATE original SET `pagado_en`, `cobro_de_venta_id` → UPDATE jornada `total_ventas += monto`, `saldo_esperado += netCash` (espeja registrar ts:190-206) → COMMIT. Query de lista: `forma_pago='pendiente' AND pagado_en IS NULL`. Retroactivo: los pendientes existentes tienen marcadores NULL = siguen cobrables.

## Decisiones clave

| Decisión | Racional | Alternativas rechazadas |
|---|---|---|
| Cobro = venta cash nueva + marcadores cobro_de_venta_id/pagado_en | Cero cambios a la matemática caja/cierre/divisa/Excel-Resumen; retroactivo; delta de schema mínimo | Tabla dedicada cobros_pendientes (6+ touchpoints críticos, alto riesgo); UPDATE in-place del pendiente (corrompe jornadas cerradas) |
| Método de servicio dedicado, NO VentaService.registrar | registrar re-valida + doble-consume stock, inserta detalles, re-suma total | Reusar registrar (corrupción stock/FIFO) |
| La fila original nunca se muta en dinero, solo marcadores | saldo_real/Excel de jornada cerrada congelados | UPDATE forma_pago in-place (rechazado) |
| Pendientes del mismo día incluidos; dos filas en ventas | Decisión de usuario: cobrar deudas del mismo día es el escenario central | Exclusión de mismo día (superseded por decisión 1) |
| Cuenta Casas + Pendiente deshabilitadas en el cobro | No se puede vender a crédito mientras se cobra una deuda | — (decisión de usuario 3) |
| Etiqueta "Cobrar Pendiente" en historial/Excel; la venta sigue "Venta (pendiente)" | Decisión de usuario 2; la fila sin detalles necesita label por marcador | Labels "Cobro"/venta-producto (rechazados) |
| v17 solo ALTERs aditivos | Instalador Windows + DBs vivas; ventas tiene FKs desde detalle_ventas/venta_lotes | Table-recreate patrón v15 (rechazado para columnas aditivas) |
| UN modal con input `soloLectura` (cobrar/ver) | Mismo data source, mismo markup de lista; evita fork de empty-state/fallback | Componente separado VerPendientesModal (rechazado) |
| FR-9 reusa listarPendientes() (query global) | La query no filtra jornada → exactamente "todos los pendientes sin cobrar" | Query inline en jornada.service (drift SQL); función compartida extraída (over-engineering) |

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Doble cobro (taps concurrentes/DBs) | Media | Re-check `pagado_en` DENTRO de BEGIN; botón deshabilitado al submit |
| Migración en DBs vivas de instalador | Media | Solo ALTER aditivos nullable, try/catch idempotente, sin recreate; NULL = cobrable retroactivo |
| Excel/cierre con filas de cobro sin detalles | Media | `_agregarVentas` special case renderiza "Cobrar Pendiente #id" + totalCaja; Resumen ya suma venta.total; verificar fallback de costo del cierre (jornada.service:493-502) no inflado por filas de cobro |
| total_ventas doble conteo mismo día | Media | Intencional (decisión 1): venta + cobro son dos filas, ambas cuentan; el cobro = plata recibida hoy. El guard es contra doble COBRO, no contra el par venta+cobro |
| Preview de historial itera venta.detalles | Media | Guard para filas sin detalles: renderear label "Cobrar Pendiente", sin crash |

## Plan de rollback

Revert solo de código (botón/modal/servicio/special case Excel). Las columnas v17 quedan — nullable, inertes sin el código de cobro; sin reescritura de datos; los pendientes previos no se ven afectados. Seguro de publicar como release propio.

## Dependencias

- Ninguna externa. Internas: db-migrations (v17), token DATABASE / SqliteService, reuso del sub-form divisa de checkout-modal.

## Criterios de éxito

- [ ] La lista de pendientes muestra sin cobrar incl. mismo día (comprador, fecha, monto); los cobrados desaparecen
- [ ] El cobro acredita la caja de hoy (total_ventas + saldo_esperado) y aparece en cierre/Excel como "Cobrar Pendiente"
- [ ] Sin movimiento de stock, sin filas detalle_ventas/venta_lotes al cobrar
- [ ] La fila original intacta salvo `pagado_en` + `cobro_de_venta_id`
- [ ] Cuenta Casas + Pendiente deshabilitadas en el modal de cobro; Efectivo/Transferencia/Divisas funcionan incl. guard de vuelto
- [ ] Doble cobro bloqueado (guard in-txn); el mismo pendiente no se cobra dos veces
- [ ] Migración v17 idempotente en DBs existentes (FakeExecutor spec green); todos los tests RED/GREEN green
- [ ] Botón "Ver Pendientes" solo-lectura: muestra lista sin flujo de cobro (AC10)
- [ ] Hoja "Pendientes Acumulados" en Excel diario con todos los pendientes sin cobrar (AC11)

## Preguntas abiertas (RESUELTAS)

1. **Cobro parcial** → **NO** (decisión de usuario 2026-08-05): cada pendiente se cobra completo.
2. ¿Se puede anular/editar un pendiente? → fuera de scope.
3. **Transferencia en el cobro** → **habilitada** (dinero que entra, no crédito; el usuario solo deshabilitó Cuenta Casas y Pendiente).
4. ¿Recordatorios por antigüedad? → fuera de scope.
5. Etiqueta "Cobrar Pendiente" → **confirmada** por el usuario.
