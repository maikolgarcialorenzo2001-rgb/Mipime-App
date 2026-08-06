# SDD — Tasks: `pagar-pendiente`

> Artefacto de tareas (2026-08-05). Guardado también en Engram (`sdd/pagar-pendiente/tasks`).
> NOTA: este archivo es la versión LIMPIA; el artefacto en engram quedó con corrupción de encoding — usar ESTE archivo como fuente.

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas estimadas | **~780–1050** (High, >400) |
| Riesgo de presupuesto 400 líneas | **Alto** |
| PRs encadenados recomendados | **Sí** |
| Decisión necesaria antes de apply | **Sí** → se eligió PRs encadenados + `feature-branch-chain` |

### Work units sugeridas

| PR | Goal | Líneas aprox. | Base |
|---|---|---|---|
| PR 1 | Migración v17 + Data layer (T1.x + T2.x) | ~264 | tracker `deudas-features` |
| PR 2 | UI (T3.x) | ~490 | branch PR 1 |
| PR 3 | Reports + Version (T4.x + T5.x) | ~282 | branch PR 2 |

## Fase 1: Migración v17

- [ ] 1.1 `db-migrations.ts`: `migrationV17()` con 2 ALTERs try/catch (`cobro_de_venta_id INTEGER REFERENCES ventas(id)`, `pagado_en TEXT`) + índice parcial + `INSERT INTO schema_version (version) VALUES (17)`; registrar `if(currentVersion<17)` [FR-6/AC7]
- [ ] 1.2 `db-migrations.spec.ts`: arrays v1..v17 + caso de idempotencia (17 en DB ya versionada); DB legacy sigue cobrable [FR-6/AC7]
- commit: `feat(db): v17 add cobro_de_venta_id + pagado_en with partial index`

## Fase 2: Data layer

- [ ] 2.1 `models/venta.ts`: agregar `cobro_de_venta_id?: number` + `pagado_en?: string` [FR-2/FR-4/AC2]
- [ ] 2.2 NUEVO `services/cobro-pendiente.service.ts`: DTO `PendienteItem` + `listarPendientes()` (query global, sin filtro de jornada) [FR-2/AC2]; `registrarCobroPendiente()` txn (guard pagado_en, netCash efectivo/divisas/transferencia, guard saldo vuelto, INSERT RETURNING sin detalles/lotes, UPDATE marcador, UPDATE jornada, COMMIT/ROLLBACK) [FR-3/4/5/AC3-6]
- [ ] 2.3 `cobro-pendiente.service.spec.ts`: RED/GREEN — lista incl. mismo día / excluye cobrados / vacío / fallback; txn happy path (3 forma_pago), doble-cobro throw, saldo insuficiente [FR-2-5/AC2-6]
- commit: `feat(cobro): CobroPendienteService listar + registrar cobro en txn`

## Fase 3: UI

- [ ] 3.1 Crear `components/cobro-pendiente-modal/` (ts/html/css): paso lista, paso pago, computeds de divisa reusados, Cuenta Casas+Pendiente deshabilitados, input `soloLectura` con selección no-op, outputs `cobroCompletado`/`cancelar` [FR-1/3/4/5/8/AC1/3/4/10]
- [ ] 3.2 `cobro-pendiente-modal.spec.ts`: RED/GREEN cobro + read-only sin pago + estado vacío [FR-5/8/AC1/4/10]
- [ ] 3.3 `pos.page.ts/.html`: signal `modoPendientes`, `abrirCobroPendiente()` + `abrirVerPendientes()`, dos botones fuera del `@if` del carrito, ambos `[disabled]="sinJornada"`, mount único `[soloLectura]` [FR-1/8/AC1/10]
- [ ] 3.4 `pos.page.spec.ts` extender: botones visibles/deshabilitados + abrir modal vs read-only [FR-1/8/AC1/10]
- commit: `feat(ui): modal Cobrar/Ver Pendientes + botones POS`

## Fase 4: Reports

- [ ] 4.1 `excel.service.ts`: special case `_agregarVentas` fila sin detalles "Cobrar Pendiente #id" + cuenta en totalCaja; exportar `PendienteAcumulado`; `JornadaReportData += pendientesAcumulados?`; `_agregarPendientesAcumulados` (header Comprador/Fecha original/Monto/Antigüedad + Total, omitir si vacío) llamado después de `_agregarVentas` [FR-7/9/AC8/11]
- [ ] 4.2 `excel.service.spec.ts` extender: fila cobro + totales; hoja acumulada cross-day/mixto/cero [FR-7/9/AC8/11]
- [ ] 4.3 `jornada.service.ts`: inyectar `CobroPendienteService`; `_obtenerPendientesAcumulados()`; wiring en `_ejecutarCierre` Y `autoCerrarSiOtroUsuario`; pasar al tipo datos de `_generarYGuardarExcel` [FR-9/AC11]
- [ ] 4.4 `jornada.service.spec.ts` extender: `cerrar()` + auto-close pasan `pendientesAcumulados` capturado [FR-9/AC11]
- [ ] 4.5 `historial.page.ts`: guard render de fila sin detalles como "Cobrar Pendiente #id" en preview [FR-7/AC8]
- commit: `feat(report): hoja Pendientes Acumulados + fila especial Cobrar Pendiente en Excel/prevista`

## Fase 5: Version / integración

- [ ] ~~5.1 `scripts/sync-version` → 0.1.13-beta; fix assert de versión (app.spec)~~ — **OBSOLETA**: origin/main ya está en 0.1.13-beta (rebase 2026-08-05). Evaluar bump a 0.1.14-beta si el repo lo pide, o marcar done sin cambios [AC9]
- commit: `chore(version): bump to 0.1.14-beta` (solo si aplica)

## Dependencias

1.1→1.2; P1→2.1-2.2 (model antes de service); 2.2→2.3; toda UI (3.x) después de 2.2 (necesita el service); 4.3/4.4 después de 2.2 (reusa `listarPendientes`); 4.1→4.2→4.3→4.4; 4.5 independiente del wiring; 5.1 último.

## Notas de riesgo (para el aplicador)

1. **Spec v11 vs v17**: la spec fue corregida a v17 (versión actual 16). No usar v11.
2. **Special case obligatorio** en `_agregarVentas` (4.1): sin él, el cobro no se muestra NI suma a totalCaja — se rompen los totales.
3. **Sin cambios a la matemática de dinero**: solo labels/listados aditivos.
4. **DI edge**: `JornadaService` inyecta `CobroPendienteService` — actualizar mocks en jornada.service.spec.
5. Strict TDD: `ng test`, tests en español con prefijos RED/GREEN; NO escribir código productivo antes de un RED fallando.
6. **Patrón de tests ACTUALIZADO (post-rebase)**: `ng test` ya funciona (b21ff36) y el repo migró specs a **TestBed + tokens** (backup.service.spec como referencia) — `vi.mock` de imports relativos está restringido por el unit-test runner. `CobroPendienteService` inyecta `DATABASE` (no `SQLOCAL_CLIENT`), así que sigue el patrón `createMockDb()` + token DATABASE de venta.service.spec — pero verificar si el runner exige TestBed y ajustar.
