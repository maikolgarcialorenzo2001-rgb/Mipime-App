# SDD — Design: `pagar-pendiente`

> Artefacto de diseño (2026-08-05). Guardado también en Engram (`sdd/pagar-pendiente/design`).
> Incluye la enmienda FR-8/FR-9 (AD-7, AD-8).

## Enfoque técnico

Nuevo `CobroPendienteService` (listarPendientes/registrarCobroPendiente) + `CobroPendienteModal` + botón "Cobrar Pendiente" en POS + migración v17 (2 columnas nullable + índice parcial opcional). Modelo de dos filas: el pendiente original mantiene el dinero intacto (solo marcadores: `pagado_en`, `cobro_de_venta_id`); el cobro es una venta cash NUEVA (sin stock/detalles/venta_lotes). Matemática de JornadaService/cierre/Excel-Resumen intacta — todo itera `ventas`.

## AD-1: Servicio dedicado, sin helper compartido

Elección: `CobroPendienteService` standalone, inyecta solo `DATABASE`. Espeja la semántica de netCash/jornadas de `VentaService._ejecutar` (ts:190-206) inline.
Alternativas: extraer helper de txn compartido; reusar `registrar`. Rechazadas — registrar re-valida/doble-consume stock (spec FR-4); extraer helper toca la ruta crítica del dinero sin payoff de reuso (2 call-sites).

## AD-2: Vínculo vía cobro_de_venta_id dual (sin self-ref)

Cada fila declara la OTRA: la fila cobro setea `cobro_de_venta_id` = id del pendiente original (conocido antes del INSERT); el UPDATE del original setea `cobro_de_venta_id` = id del cobro nuevo (desde INSERT RETURNING *). Sin `last_insert_rowid`; `RETURNING *` ya se usa (venta.service:159).
Alternativa: self-ref UPDATE post-INSERT = segunda escritura redundante.

## AD-3: listarPendientes

`SELECT id, comprador_nombre, fecha_hora, total, jornada_id FROM ventas WHERE forma_pago='pendiente' AND pagado_en IS NULL ORDER BY fecha_hora DESC`. Mismo día incluido (decisión 1). Índice parcial `CREATE INDEX IF NOT EXISTS idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente'` — en v17, idempotente vía IF NOT EXISTS. DTO PendienteItem = { id, compradorNombre?, fechaHora, total, jornadaId }. NOTA: la query NO tiene filtro de jornada — GLOBAL entre todas las jornadas (reusada por FR-9, ver AD-8).

## AD-4: Secuencia de txn registrarCobroPendiente

1. BEGIN
2. Guard: `SELECT * FROM ventas WHERE id=? AND pagado_en IS NULL` → throw "Pendiente ya cobrado" si vacío (lock anti-doble-cobro in-txn, spec AC4)
3. netCash = efectivo? total : divisas? (completacionEfectivo - max(0,vuelto)) : transferencia? 0 (espeja venta.service:190-206)
4. Si divisas && vuelto>0: guard de saldo (`SELECT saldo_esperado FROM jornadas WHERE id=?`), throw si saldo<vuelto (espeja ts:91-104)
5. `INSERT INTO ventas (jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago, cobro_de_venta_id [,divisa_tipo,monto_divisa,tasa_cambio,completacion_efectivo]) VALUES (...) RETURNING *` — SIN detalle_ventas, SIN stock, SIN venta_lotes
6. `UPDATE ventas SET pagado_en=?, cobro_de_venta_id=? WHERE id=?` (original; solo marcadores, sin mutación de dinero)
7. `UPDATE jornadas SET total_ventas=total_ventas+?, saldo_esperado=saldo_esperado+?, updated_at=? WHERE id=?` (netCash)
8. COMMIT; catch → ROLLBACK; throw.

Errores: sin jornada abierta (guard lanzado pre-call en POS), ya cobrado (paso 2), no encontrado (paso 2 vacío O id inválido → throw), fallo mid-txn (ROLLBACK+rethrow).

## AD-5: CobroPendienteModal

Standalone, checklist desde checkout-modal. Inputs: `open` y `saldoEnCaja`, `cobroPendiente` signal (lista). Estado: pendientes(), selectedId, formaPago signal (default 'efectivo'), signals de divisa (tasaCambio/billeteRecibido/completacionEfectivo), loading, error. Reusado-vs-reimplementado: copiar el sub-form de divisa + computeds de vuelto/falta/pagoSuficiente/errorCompletacion/saldoInsuficienteVuelto/formularioValidoConSaldo de checkout-modal (componente single-purpose, sin reuso limpio — solo patrón). Botones deshabilitados: Cuenta Casas + Pendiente (`[disabled]="true"` + clases muted); POST deshabilitado cuando selectedId==null o !formularioValidoConSaldo. Botones: Efectivo/Transferencia/Divisas habilitados. Outputs: `cobroCompletado`(jornada); `cancelar`. Deshabilitar submit mientras `cargando`.

## AD-6: Integración POS

Botón FUERA de `@if(cart.items().length>0)` (pos.page.html:91), debajo del carrito, `[disabled]="sinJornada"`, abre vía `@if (showPendienteModal())` (igual que checkout `@if(showModal())`). `abrirCobroPendiente()` limpia error + setea true; `cobroCompletado`→ cierra modal, `refreshJornadaAbierta()`, recarga lista de pendientes.

## DELTA — FR-8 "Ver Pendientes" read-only + FR-9 Excel acumulado (enmienda a AD-6; AD-1..AD-5, migración, lockeados)

### AD-7: "Ver Pendientes" read-only reusa CobroPendienteModal vía input `soloLectura`

Elección: UN componente, agregar `soloLectura = input(false)`. Alternativa: componente `VerPendientesModal` separado — rechazada. Racional: idéntico data source (listarPendientes), idéntico markup de lista, estado vacío, loading/error y fallback `Pendiente #id`; el read-only ES el paso de lista del flujo de cobro menos el paso de pago. Un segundo componente forkearía lógica de empty-state/fallback + specs sin payoff. AC10 aplicado ESTRUCTURALMENTE en template: el panel de pago, las opciones de pago y el confirm viven dentro de `@if (!soloLectura() && selectedId())`; en read-only las filas se renderizan no-interactivas (sin (click), sin highlight de selección); `seleccionar()` no-op cuando soloLectura; `cobroCompletado` NUNCA se emite en read-only.

Contrato del componente (extiende AD-5): inputs `open`, `saldoEnCaja`, `cobroPendiente`, `soloLectura = input(false)`; outputs `cobroCompletado` (solo cobrar), `cancelar`. Read-only renderiza: filas de lista (fallback comprador `Pendiente #id`, fecha, monto) + estado vacío; cerrar = cancelar.

Integración POS (modifica AD-6, que no está lockeado): mantener el MOUNT ÚNICO `@if (showPendienteModal())`; agregar `modoPendientes = signal<'cobrar' | 'ver'>('cobrar')`. `abrirCobroPendiente()` → modo 'cobrar'; nueva `abrirVerPendientes()` → modo 'ver' (ambas llaman `cargarPendientes()` y luego setean flag true). Template: `[soloLectura]="modoPendientes()==='ver'"`. Dos botones lado a lado FUERA del `@if` del carrito, ambos `[disabled]="sinJornada"` (FR-8 deshabilitado sin jornada, consistente AC1/AC10). Mount único evita estado de doble modal.
Decisión (per spec): un flag + signal de modo, NO dos flags — sin posible estado double-open, reusa el nombre `showPendienteModal()` (AD-6).

### AD-8: FR-9 pendientes acumulados — reusar listarPendientes (ya global), alimentado por JornadaService

Elección: reusar `CobroPendienteService.listarPendientes()` (query AD-3 SIN filtro de jornada → exactamente "todos los sin cobrar de TODAS las jornadas"). `JornadaService` inyecta `CobroPendienteService` — seguro: depende solo de `DATABASE` (AD-1), sin ciclo DI. Alternativas: (b) query inline en jornada.service — duplica SQL, riesgo de drift FR-2/8/9; (c) función SQL compartida extraída — over-engineering para una forma de query. Rechazadas.

Data flow (ambos paths del Excel diario): helper privado `_obtenerPendientesAcumulados()` mapea PendienteItem → PendienteAcumulado (fallback comprador + antigüedad). Llamado en `_ejecutarCierre` (paso 12, antes de `_generarYGuardarExcel`) Y `autoCerrarSiOtroUsuario` (line 246-260, mismo patrón de objeto `datos`) — ambos callers pasan datos, así `_generarYGuardarExcel` sigue libre de DB (contrato docstring preservado). `JornadaReportData` gana `pendientesAcumulados?: PendienteAcumulado[]` OPCIONAL — los flujos preview/monthly (`_recolectarDatosJornada`, `generarExcelMensual`) compilan sin cambios y omiten la hoja. Dato de reporte solo-lectura, cero mutación. El export mensual NO se extiende (FR-9 es solo el cierre diario).

Excel: nueva hoja dedicada **"Pendientes Acumulados"** agregada en `generarExcelJornada` DESPUÉS de `_agregarVentas(wb, data)` (line 55). `_agregarPendientesAcumulados` patrón aoa_to_sheet: header `[Comprador, Fecha original, Monto, Antigüedad (días)]`, una fila por pendiente, fila Total (suma montos). CERO pendientes → early-return, hoja omitida — coincide con la convención de `_agregarArqueo` (excel.service:675-676) y satisface AC11 ("estado vacío u omitida"). La línea "Pendientes del día" del Resumen (excel.service:154) intacta — sigue derivando de `data.ventas` forma_pago='pendiente'.

## Cambios de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `src/app/services/cobro-pendiente.service.ts` | Crear | `listarPendientes()` + `registrarCobroPendiente()` txn |
| `src/app/components/cobro-pendiente-modal/` (.ts/.html/.css/.spec) | Crear | Modal 2 pasos: lista → pago + sub-form divisa; `soloLectura` |
| `src/app/pages/pos/pos.page.ts/.html/.spec` | Modificar | Dos botones fuera del carrito; `modoPendientes` signal; mount único `[soloLectura]` |
| `src/app/services/db-migrations.ts` | Modificar | `if (currentVersion<17) migrationV17(exec)` + `migrationV17` |
| `src/app/services/db-migrations.spec.ts` | Modificar | arrays v1..v17 ×2; "already 16"→17 |
| `src/app/services/excel.service.ts` | Modificar | `_agregarVentas` special case; `PendienteAcumulado`; `JornadaReportData += pendientesAcumulados?`; `_agregarPendientesAcumulados` |
| `src/app/services/excel.service.spec.ts` | Extender | Fila cobro + totales; hoja acumulada |
| `src/app/services/jornada.service.ts` | Modificar | Inyectar CobroPendienteService; `_obtenerPendientesAcumulados()`; wiring en `_ejecutarCierre` + `autoCerrarSiOtroUsuario` |
| `src/app/services/jornada.service.spec.ts` | Extender | Data flow FR-9 |
| `src/app/pages/historial/historial.page.ts/.spec` | Modificar | Guard preview filas sin detalles |
| `src/app/models/venta.ts` | Modificar | Venta + `cobro_de_venta_id?: number`, `pagado_en?: string` |
| `src/app/version.ts` | Regenerar | `npm run sync:version` (0.1.13-beta) |

## Migración v17 (solo-aditiva)

```ts
if (currentVersion < 17) await migrationV17(exec);

async function migrationV17(exec: MigrationExecutor): Promise<void> {
  try { await exec.sql('ALTER TABLE ventas ADD COLUMN cobro_de_venta_id INTEGER REFERENCES ventas(id)'); } catch { /* ya existe */ }
  try { await exec.sql('ALTER TABLE ventas ADD COLUMN pagado_en TEXT'); } catch { /* ya existe */ }
  await exec.sql("CREATE INDEX IF NOT EXISTS idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente'");
  await exec.sql('INSERT INTO schema_version (version) VALUES (17)');
}
```

Solo aditivo nullable (sin recreate — FKs desde detalle_ventas/venta_lotes). Marcadores NULL = legacy retroactivamente cobrable.

## Interfaces

```ts
// cobro-pendiente.service.ts
interface PendienteItem { id: number; compradorNombre?: string | null; fechaHora: string; total: number; jornadaId: number; }
interface CobroOpciones {
  jornadaId: number; usuarioId: number;
  formaPago: 'efectivo' | 'transferencia' | 'divisas';
  divisaTipo?: 'EUR' | 'USD'; billeteRecibido?: number; tasaCambio?: number; completacionEfectivo?: number;
}

// excel.service.ts
export interface PendienteAcumulado {
  id: number;             // ventas.id original
  comprador: string;      // comprador_nombre ?? `Pendiente #${id}`
  fechaOriginal: string;  // fecha_hora ISO (Excel muestra la fecha)
  monto: number;          // total
  antiguedadDias: number; // date-only floor((hoy - fecha)/86400000), Math.max(0,..) → mismo día 0
}
// JornadaReportData += pendientesAcumulados?: PendienteAcumulado[];
```

## Plan de testing (RED/GREEN en español, `ng test`)

| Spec file | Casos (→ AC) |
|---|---|
| `cobro-pendiente.service.spec.ts` (nuevo) | lista incl. mismo día / excluye cobrados / vacío / fallback → FR2/AC2; txn happy path (efectivo, divisas, transferencia); doble-cobro 2º ROLLBACK → AC5; vuelto>saldo bloquea → FR5/AC4; pendiente no encontrado / fallo mid-txn → ROLLBACK; netCash jornada espejado → AC6 |
| `cobro-pendiente-modal.spec.ts` | renderiza lista; estado vacío; Cuenta Casas+Pendiente deshabilitados / otros habilitados → FR5/AC6; guard de vuelto divisa bloquea confirm → FR5/AC4; emite cobroCompletado; submit deshabilitado sin selección; read-only renderiza filas (fallback, fecha, monto) SIN pago/selección/confirm → AC10; read-only estado vacío → AC10; filas no-interactivas (click no-op); cancelar cierra |
| `pos.page.spec.ts` | botón siempre visible; deshabilitado con `sinJornada`; click abre modal cobrar vs ver (soloLectura true, modo 'ver') → FR1/FR8/AC1/AC10; refreshJornadaAbierta on cobroCompletado |
| `db-migrations.spec.ts` | v1..v17 fresh; version=17 skip; re-run idempotente → FR6/AC7 |
| `excel.service.spec.ts` | fila cobro "Cobrar Pendiente #id" + totalCaja incluye → FR7/AC8; hoja "Pendientes Acumulados" existe con columnas correctas; cross-day (2 jornadas) cada uno con comprador/fecha/monto/antigüedad; mixto mismo día → antigüedad 0; cero → hoja omitida + Resumen "Pendientes del día" intacto → AC11 |
| `jornada.service.spec.ts` | `cerrar()` llama listarPendientes y pasa pendientesAcumulados al ExcelService capturado (antigüedad date-only); path auto-close cableado → AC11/FR9 |
| `historial.page.spec.ts` | fila cobro sin detalles visible, sin crash → FR7/AC8 |

## Rollback

FR-8/FR-9 revert = quitar botón/modo + hoja + wiring de JornadaService (solo código). Las columnas v17 quedan nullable/inertes. Sin reescritura de datos. Seguro de publicar como release propio.

## Preguntas abiertas del diseño (resueltas)

1. Antigüedad usa diff date-only (mismo día = 0, per AC11) — confirmado; se ignora la hora para evitar flakiness.
2. Fallo de query FR-9 al cierre: lanza como los otros pasos de recolección del cierre (consistente) — sin degradar silenciosamente.
3. Exports mensual/rango excluyen intencionalmente la hoja acumulada (FR-9 scoped al cierre diario) — confirmado fuera de scope.
4. Etiqueta: `Cobrar Pendiente #<id>` usa el id del pendiente ORIGINAL (`cobro_de_venta_id`) — confirmar wording final en apply.
