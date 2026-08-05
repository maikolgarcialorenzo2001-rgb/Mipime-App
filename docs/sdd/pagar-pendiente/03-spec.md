# SDD — Spec (delta): `pagar-pendiente`

> Artefacto de spec (2026-08-05). Guardado también en Engram (`sdd/pagar-pendiente/spec`).
> Versión CORREGIDA: v17 (no v11). La versión de migración actual es 16.

## FR-1 — Botón Cobrar Pendiente (POS)

La página POS DEBE mostrar un botón **"Cobrar Pendiente"** SIEMPRE (independiente del carrito), deshabilitado cuando no hay jornada abierta (`sinJornada`). Cuando está habilitado y se clickea DEBE abrir el modal de lista de pendientes.

- **Escenario jornada abierta, carrito vacío**: DADO usuario en POS con jornada abierta y carrito vacío; CUANDO clickea "Cobrar Pendiente"; ENTONCES el modal de lista se abre (botón habilitado, `sinJornada` false).
- **Escenario sin jornada**: DADO usuario en POS sin jornada abierta; CUANDO inspecciona el botón; ENTONCES el botón DEBE estar deshabilitado y NO abrir el modal.

## FR-2 — Query y display de la lista de pendientes

El modal DEBE listar cada pendiente sin cobrar de `ventas` donde `forma_pago='pendiente' AND pagado_en IS NULL`, INCLUYENDO filas del mismo día. Cada fila DEBE mostrar comprador (o fallback `Pendiente #id`), fecha y monto (total). Las filas cobradas (pagado_en no-NULL) DEBEN excluirse. Una lista vacía DEBE mostrar estado vacío.

- **Escenario mismo día + días previos**: DADO dos pendientes sin cobrar (uno de la jornada abierta de hoy, otro de una jornada anterior); CUANDO carga la lista; ENTONCES ambos aparecen con comprador, fecha, monto.
- **Escenario lista vacía**: DADO que no existen filas `forma_pago='pendiente' AND pagado_en IS NULL`; CUANDO carga la lista; ENTONCES se muestra estado vacío y no se puede seleccionar.
- **Escenario pendiente legacy sin comprador**: DADO una fila pendiente con `comprador_nombre` NULL; CUANDO se renderiza; ENTONCES se muestra el fallback (`Pendiente #id`) y la fila no crashea.

## FR-3 — Selección y monto

Seleccionar un pendiente DEBE mostrar cuánto cobrar (el `total` del pendiente, completo; SIN montos parciales).

- **Escenario seleccionar deuda**: DADO el usuario selecciona un pendiente con total X; CUANDO el modal muestra el paso de cobro; ENTONCES muestra el monto completo X a cobrar y no hay control de pago parcial (decisión cerrada: sin cobro parcial).

## FR-4 — Transacción de cobro

Cobrar DEBE insertar una fila NUEVA en `ventas` (forma_pago IN 'efectivo','transferencia','divisas') con total = total del pendiente, SIN `detalle_ventas`, SIN `venta_lotes`, SIN movimiento de stock, SIN costo. La fila nueva DEBE setear `cobro_de_venta_id` = id del pendiente original. La fila original NO DEBE mutarse en dinero; solo marcadores `pagado_en` (timestamp) y `cobro_de_venta_id`. El guard DEBE re-chequear `pagado_en IS NULL` DENTRO de la transacción BEGIN...COMMIT (protección anti-doble-cobro). El UPDATE de jornada DEBE espejar `VentaService._ejecutar` (ts:199-206): `total_ventas += monto`, `saldo_esperado += netCash` (efectivo: total; divisas: `completacionEfectivo - max(0,vuelto)`; transferencia: 0 cash, el total igual cuenta). DEBE ser un método de servicio dedicado (`CobroPendienteService`), NUNCA `VentaService.registrar`.

- **Escenario happy path — mismo día**: DADO jornada abierta y un pendiente del mismo día sin cobrar con total X (forma_pago efectivo); CUANDO el usuario confirma el cobro; ENTONCES se inserta fila efectivo nueva (total X, cobro_de_venta_id = id pendiente, sin detalles/lotes); el original recibe pagado_en + cobro_de_venta_id; jornada `total_ventas` += X y `saldo_esperado` += X; COMMIT exitoso.
- **Escenario happy path — cross-day**: DADO un pendiente de jornada cerrada de un día previo; CUANDO se cobra hoy; ENTONCES se inserta una venta cash en la jornada abierta de hoy y el original queda marcado, dejando la jornada cerrada previa intacta.
- **Escenario doble cobro intentado**: DADO dos intentos de cobro sobre el mismo pendiente; CUANDO ambos llegan al guard de la transacción; ENTONCES el guard detecta `pagado_en` no-NULL y el segundo hace ROLLBACK / es rechazado; existe exactamente una fila de cobro.

## FR-5 — Opciones de pago en el cobro

El modal de cobro DEBE habilitar Efectivo, Transferencia y Divisas; DEBE DESHABILITAR Cuenta Casas y Pendiente (no se puede vender a crédito al cobrar una deuda). El sub-form de Divisas (tasa/billete/completacion + guard de vuelto saldoEnCaja) DEBE reusarse de checkout-modal.

- **Escenario divisas con vuelto > saldo**: DADO un cobro en divisas cuyo vuelto excede saldoEnCaja; ENTONCES el guard de vuelto bloquea la confirmación (igual que el sub-form de divisas de checkout-modal).

## FR-6 — Migración v17

La migración v17 DEBE agregar columnas nullable a `ventas`: `cobro_de_venta_id INTEGER` (puede referenciar ventas.id) y `pagado_en TEXT`. Cada ALTER DEBE ir en try/catch por idempotencia (patrón v16) y DEBE ser solo-aditivo (sin table recreate / sin cambio de CHECK). Los pendientes existentes mantienen marcadores NULL = cobrables retroactivamente. `db-migrations.spec` debe assert v1..v17 y versión 17.

- **Escenario migración en DB viva**: DADO una DB en versión 16 con filas pendientes existentes; CUANDO migrationV17 corre y re-corre; ENTONCES las columnas existen una vez (sin error de columna duplicada), los pendientes existentes siguen cobrables (pagado_en IS NULL).

## FR-7 — Render como "Cobrar Pendiente", totales incluidos

La fila de cobro DEBE reportarse como **"Cobrar Pendiente"** en historial (preview) y en la hoja Excel Ventas, y DEBE incluirse en los totales del día del cobro exactamente como cualquier otra venta. Las filas sin detalles DEBEN renderear sin crashear (special case). Las filas de venta pendiente mantienen el label actual "Venta (pendiente)". Sin cambios a la matemática de las agregaciones (jornada `totalEnCaja`, `saldo_real`, total_usd/eur, Excel Resumen ya iteran ventas, matemática intacta).

- **Escenario fila de cobro en Excel Ventas + totales**: DADO un día de cobro con un cobro; ENTONCES Excel Ventas muestra una fila única "Cobrar Pendiente #id", y totalCaja (y Resumen "Total ventas") incluye el total del cobro.

## FR-8 — Botón "Ver Pendientes" (lista solo-lectura)

La página POS DEBE mostrar un botón **"Ver Pendientes"** AL LADO de "Cobrar Pendiente", siempre visible, DESHABILITADO cuando no hay jornada abierta (consistente con Cobrar Pendiente). Clickearlo cuando está habilitado DEBE abrir una vista SOLO-LECTURA listando cada pendiente sin cobrar (`forma_pago='pendiente' AND pagado_en IS NULL`, incluyendo mismo día) mostrando comprador (o fallback), fecha y monto. La vista NO DEBE ofrecer flujo de cobro, opciones de pago ni selección-para-pagar. Una lista vacía DEBE mostrar estado vacío.

- **Escenario lista solo-lectura, sin cobro**: DADO jornada abierta con pendientes sin cobrar y la vista solo-lectura abierta; CUANDO el usuario ve una fila; ENTONCES comprador/fecha/monto se muestran y no hay select-to-pay ni control de pago.
- **Escenario lista vacía**: DADO no existen pendientes sin cobrar y el usuario abre "Ver Pendientes"; ENTONCES se muestra estado vacío.
- **Escenario sin jornada**: DADO usuario en POS sin jornada abierta; CUANDO inspecciona el botón; ENTONCES DEBE estar deshabilitado y NO abrir la vista.

## FR-9 — Pendientes acumulados en el Excel diario

El export diario de jornada generado en `_ejecutarCierre` DEBE incluir, en una NUEVA sección/hoja, la lista acumulada de TODOS los pendientes sin cobrar (pagado_en IS NULL) de TODAS las jornadas (no solo la de hoy). La sección DEBE listar cada pendiente sin cobrar con comprador (o fallback), fecha de venta original y monto. La línea existente "Pendientes del día" del Resumen DEBE quedar sin cambios. Una query sobre todos los pendientes sin cobrar (`pagado_en IS NULL`) de todas las jornadas DEBE alimentar el generador de Excel.

- **Escenario acumulación cross-day**: DADO pendientes sin cobrar en múltiples jornadas previas; CUANDO se genera el Excel diario en el cierre; ENTONCES la nueva sección lista cada pendiente sin cobrar con fecha original, comprador, monto y antigüedad (días desde la venta original).
- **Escenario mixto mismo día + previos**: DADO algunos pendientes creados hoy y otros en días previos; CUANDO se genera el export; ENTONCES todos aparecen una vez, cada uno con su fecha original; los del mismo día muestran antigüedad 0.
- **Escenario cero pendientes**: DADO no existe ningún pendiente `pagado_en IS NULL` al cierre; CUANDO se genera el export; ENTONCES la nueva sección está vacía (estado vacío u omitida) y el Resumen "Pendientes del día" no se ve afectado.

## Requisitos no funcionales

- TDD estricto RED/GREEN en español (`ng test`): unit tests de servicio + migración (FakeExecutor), component tests del modal; sin código productivo antes de un RED fallando.
- La migración DEBE ser solo ALTERs aditivos nullable (sin recrear tabla) para ser segura en instaladores Windows/DBs vivas (ventas tiene FKs que referencian desde detalle_ventas/venta_lotes).
- NO DEBE alterar la matemática crítica de dinero existente (jornada, cierre, excel: solo labels/listados aditivos vía marcador en filas sin detalles).
- Rendimiento de la query de lista: índice parcial `CREATE INDEX idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente'` (agregado en v17).

## Cambios de datos (v17, solo aditivo)

```sql
-- dentro de migrationV17, cada ALTER try/catch idempotente
ALTER TABLE ventas ADD COLUMN cobro_de_venta_id INTEGER REFERENCES ventas(id);      -- nullable
ALTER TABLE ventas ADD COLUMN pagado_en TEXT;                                       -- nullable
-- opcional
CREATE INDEX IF NOT EXISTS idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente';
INSERT INTO schema_version (version) VALUES (17);
```

Semántica: `cobro_de_venta_id` no-NULL ⇒ existe un cobro; `pagado_en` IS NULL ⇒ sin cobrar / pendiente; no-NULL ⇒ cobrado.

## Criterios de aceptación

- [AC1→FR1] botón visible/deshabilitado correctamente; abre modal/vista solo cuando hay jornada abierta
- [AC2→FR2] la lista muestra sin cobrar incl. mismo día; cobrados excluidos; fallback para comprador_nombre ausente
- [AC3→FR3] el cobro muestra el monto completo, sin control de parcial
- [AC4→FR5] el guard de vuelto de divisas bloquea vuelto excesivo
- [AC5→FR4] doble cobro bloqueado (guard in-txn); el reintento falla, existe una sola fila de cobro
- [AC6→FR4] jornada `total_ventas` / `saldo_esperado` espejados desde `VentaService._ejecutar`
- [AC7→FR6] migración v17 idempotente; `db-migrations.spec` v1..v17 green; pendientes legacy siguen cobrables
- [AC8→FR7] historial + Excel renderizan "Cobrar Pendiente" sin crashes en filas sin detalles; los totales incluyen el cobro
- [AC9] todos los tests RED/GREEN en español green; sin cambios a la matemática de dinero existente
- [AC10→FR8] botón "Ver Pendientes" deshabilitado sin jornada abierta; la lista solo-lectura muestra comprador/fecha/monto, SIN cobro/pago/selección; estado vacío mostrado
- [AC11→FR9] el Excel diario incluye la nueva lista de pendientes (todos los sin cobrar de todas las jornadas) con comprador + fecha original + monto + antigüedad; Resumen "Pendientes del día" sin cambios; el caso cero pendientes no corrompe el reporte

## Fuera de scope

Cobro parcial; recordatorios/antigüedad; entidad cliente; editar/anular pendientes; cualquier cambio al stock/FIFO de `VentaService.registrar`; rework de la matemática de caja/cierre existente más allá de listados/agregación aditiva; nuevos métodos de pago.
