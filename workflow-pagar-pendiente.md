# Workflow — Cambio SDD: `pagar-pendiente`

> Documento de retomada. Si este cambio queda a medio hacer, leé este archivo y continuá por el próximo paso indicado en [Cómo retomar](#cómo-retomar). Los artefactos completos viven en **Engram** (topic keys abajo) **y en el repo** (`docs/sdd/pagar-pendiente/` — fuente limpia autoritativa).

## 1. Objetivo

Feature **"Cobrar Pendiente"** en el POS: cobrar pagos registrados como *pendiente* (del mismo día o de días anteriores).

- Botón **Cobrar Pendiente** → lista de pendientes sin cobrar → selección → cobro (efectivo/transferencia/divisas).
- Botón **Ver Pendientes** → misma lista pero solo-lectura (sin cobro).
- El Excel diario del cierre incluye una hoja **"Pendientes Acumulados"** con TODOS los pendientes sin cobrar de todos los días (comprador, fecha original, monto, antigüedad).

## 2. Estado del flujo SDD

| Fase | Estado | Artefacto (Engram topic key / repo) |
|---|---|---|
| Init | ✅ | `sdd-init/mipime-cuentas` |
| Explore | ✅ | `sdd/pagar-pendiente/explore` · `docs/sdd/pagar-pendiente/01-explore.md` |
| Propose | ✅ | `sdd/pagar-pendiente/proposal` + `proposal-amendments` · `docs/sdd/pagar-pendiente/02-proposal.md` |
| Spec | ✅ | `sdd/pagar-pendiente/spec` · `docs/sdd/pagar-pendiente/03-spec.md` |
| Design | ✅ | `sdd/pagar-pendiente/design` · `docs/sdd/pagar-pendiente/04-design.md` |
| Tasks | ✅ | `sdd/pagar-pendiente/tasks` (corrupto en engram) · `docs/sdd/pagar-pendiente/05-tasks.md` ← usar ESTE |
| Apply PR 1 | ✅ **COMPLETO** | `sdd/pagar-pendiente/apply-progress` (#507) · commits `2548776` + `22fbd63` |
| Verify PR 1 | ✅ **PASS** | `sdd/pagar-pendiente/verify-report` (#509) · 0 CRITICAL, 0 WARNING, 5 SUGGESTIONS |
| Apply PR 2 | 🔲 **PRÓXIMO PASO** | tareas 3.1–3.4 (modal + botones POS) |
| Verify PR 2 | 🔲 pendiente | `sdd/pagar-pendiente/verify-report` |
| Apply PR 3 | 🔲 pendiente | tareas 4.1–4.5 + 5.1 (OBSOLETA) |
| Verify PR 3 | 🔲 pendiente | `sdd/pagar-pendiente/verify-report` |
| Archive | 🔲 pendiente | `sdd/pagar-pendiente/archive-report` |

**Branch:** `deudas-features` (desde `main`). **Modo sesión:** interactive · **Artifact store:** engram · **Delivery:** ask-on-risk → **PRs encadenados** · **Chain strategy:** `feature-branch-chain` (ELEGIDA y lockeada el 2026-08-05).

> **2026-08-05 (post-rebase):** `deudas-features` fue rebaseada sobre `origin/main` (`d8abed2`). Trajo el seed real (74 productos), el bump a **0.1.13-beta** y el patrón de tests TestBed+token. Implicaciones: la tarea 5.1 (bump) quedó OBSOLETA; el PR 3 debe usar el patrón de test nuevo. Stash de tooling dropeado (main ya trae el skill-registry regenerado).

## 3. Decisiones cerradas (NO reabrir)

1. **Sin cobro parcial** — cada pendiente se cobra completo.
2. **Modelo de dos operaciones**: la venta pendiente original (descuenta stock, suma a `total_ventas`, sin plata) + el cobro (venta NUEVA solo-dinero: sin stock, sin detalles, sin lotes, sin costo).
3. **Sin cambios a ganancia bruta / costo** — se mantiene el comportamiento actual del código (el día del pendiente resta su costo; el día del cobro suma la plata sin costo). Aceptado por el usuario.
4. Etiqueta **"Cobrar Pendiente"** en historial y Excel; la venta sigue como "Venta (pendiente)".
5. En el modal de cobro: **Efectivo, Transferencia y Divisas habilitadas**; **Cuenta Casas y Pendiente deshabilitadas**.
6. **Pendientes del mismo día incluidos** en la lista.
7. **Migración v17 aditiva** (nullable, try/catch idempotente): `cobro_de_venta_id INTEGER REFERENCES ventas(id)` + `pagado_en TEXT` + índice parcial `idx_ventas_pendientes`.
8. La fila pendiente original NUNCA se muta en dinero — solo marcadores `pagado_en` + `cobro_de_venta_id`.
9. Fuera de scope: anular/editar pendientes, recordatorios por antigüedad, entidad cliente, cobro parcial.

## 4. Requisitos (spec) — resumen

FR-1 botón Cobrar Pendiente · FR-2 lista (`forma_pago='pendiente' AND pagado_en IS NULL`) · FR-3 selección muestra monto total · FR-4 txn de cobro (guard anti-doble-cobro IN-TXN, netCash espeja `VentaService._ejecutar`) · FR-5 restricción de métodos de pago · FR-6 migración v17 · FR-7 render "Cobrar Pendiente #id" en Excel/historial · FR-8 botón Ver Pendientes (solo-lectura) · FR-9 hoja "Pendientes Acumulados" en Excel diario. AC1..AC11.

## 5. Diseño — decisiones clave

- **AD-1** `CobroPendienteService` dedicado (depende solo de DATABASE). NUNCA `VentaService.registrar` (re-consume stock).
- **AD-2** `cobro_de_venta_id` rol doble: cobro→pendiente al insertar; pendiente→cobro vía `RETURNING *`.
- **AD-3** Índice parcial en v17.
- **AD-4** Cuenta Casas + Pendiente deshabilitadas (visibles, apagadas).
- **AD-5** Fila detalle-especial en Excel/historial (no copiar detalles).
- **AD-7** UN modal `CobroPendienteModal` con input `soloLectura` (modo cobrar vs ver).
- **AD-8** FR-9 reusa `listarPendientes()` (query global) → `pendientesAcumulados?` en `JornadaReportData` → hoja nueva en Excel; cableado en `_ejecutarCierre` Y `autoCerrarSiOtroUsuario`.

Transacción cobro: `BEGIN → guard pagado_en IS NULL → netCash (efectivo=total; divisas=completacionEfectivo−vuelto; transferencia=0 cash) → INSERT venta cobro RETURNING * → UPDATE original (marcadores) → UPDATE jornada (total_ventas += total, saldo_esperado += netCash) → COMMIT; catch → ROLLBACK`.

## 6. Tareas (20, 5 fases) — detalle completo en `sdd/pagar-pendiente/tasks`

| Fase | Contenido | Commit sugerido |
|---|---|---|
| **1. Migración** | 1.1 `migrationV17()` + registro `if(currentVersion<17)` · 1.2 `db-migrations.spec` v1..v17 + idempotencia | `feat(db): v17 add cobro_de_venta_id + pagado_en with partial index` |
| **2. Datos** | 2.1 `models/venta.ts` + campos · 2.2 `cobro-pendiente.service.ts` (listarPendientes + registrarCobroPendiente txn) · 2.3 spec RED/GREEN | `feat(cobro): CobroPendienteService listar + registrar cobro en txn` |
| **3. UI** | 3.1 modal (lista + pago + divisa + `soloLectura`) · 3.2 spec modal · 3.3 pos.page dos botones + signal `modoPendientes` · 3.4 spec pos | `feat(ui): modal Cobrar/Ver Pendientes + botones POS` |
| **4. Reports** | 4.1 excel.service (fila especial + `PendienteAcumulado` + hoja) · 4.2 spec excel · 4.3 jornada.service wiring (2 paths) · 4.4 spec jornada · 4.5 historial preview guard | `feat(report): hoja Pendientes Acumulados + fila especial Cobrar Pendiente en Excel/prevista` |
| **5. Versión** | 5.1 sync-version → 0.1.13-beta + fix assert app.spec | `chore(version): bump to 0.1.13-beta` |

Tests: RED/GREEN en español, spec co-locado. Deps: 1→2→3; 4.3/4.4 después de 2.2; 4.5 independiente; 5 al final.

## 7. Plan de entrega — 3 PRs encadenados

**Estrategia ELEGIDA: `feature-branch-chain`** (lockeada). `deudas-features` es el tracker que acumula la integración final; solo el tracker mergea a main. PR1 base = `deudas-features`; PR2 base = branch PR1; PR3 base = branch PR2. NO mezclar estrategias. Cada PR: tests incluidos con su código, commit por unidad de trabajo, rollback solo de código (v17 queda inerte).

| PR | Base | Contenido | Líneas aprox. |
|---|---|---|---|
| PR 1 | tracker `deudas-features` | Fase 1 + 2 (migración + data layer) | ~264 |
| PR 2 | PR 1 | Fase 3 (UI modal + botones POS) | ~490 |
| PR 3 | PR 2 | Fase 4 + 5 (reports + versión) | ~282 |

Cada PR: tests incluidos con su código, commit por unidad de trabajo, rollback solo de código (v17 queda inerte).

## 8. Riesgos clave

1. **Doble cobro** — guard `pagado_en IS NULL` DENTRO de la transacción + submit deshabilitado.
2. **Migración en DBs vivas** (instalador Windows) — solo ALTER aditivos, idempotentes, sin recreate.
3. **Fila sin detalles en Excel/historial** — special case obligatorio en `_agregarVentas` (si no, el cobro no suma a `totalCaja` ni se muestra).
4. **Cierre cost fallback** — verificado seguro: cobro aporta costo 0 (correcto por decisión 3).
5. **DI edge** — `JornadaService` inyecta `CobroPendienteService` (sin ciclo; ambos dependen solo de DATABASE). Actualizar mocks.

## 9. Cómo retomar (estado: PR 1 completado y verificado)

> Estado a 2026-08-05: **PR 1 (migración v17 + data layer) COMPLETO y VERIFIED PASS**. Los commits `2548776` + `22fbd63` están en `deudas-features` (pusheada a origin). Próximo paso: **PR 2 (Fase 3 UI)**.

1. `git checkout deudas-features && git pull` — el doc de retomada es ESTE archivo. La rama ya está pusheada a `origin` (tracker del feature-branch-chain).
2. **Chain strategy YA elegida y lockeada**: `feature-branch-chain` (ver §2). NO re-preguntar.
3. Leer `docs/sdd/pagar-pendiente/05-tasks.md` (fuente autoritativa de tareas) — las tareas 1.1–2.3 están marcadas `[x]`.
4. `/sdd-continue pagar-pendiente` → fase **apply PR 2**: tareas **3.1, 3.2, 3.3, 3.4** (modal `CobroPendienteModal` + botones POS + specs). Usar `apply-progress` de engram si existe (MERGEAR, no sobrescribir).
5. Verificar que `CobroPendienteService` (ya existente, PR 1) se consume correctamente: `listarPendientes()` para la lista, `registrarCobroPendiente()` para el cobro.
6. Al terminar PR 2: `/sdd-verify`. Después PR 3 (Fase 4 reports + Fase 5, tarea 5.1 OBSOLETA).
7. Al final de todo: `/sdd-archive`.

**PR 1 ya NO se toca** — si una sesión sin contexto intenta "aplicar PR 1", ya está hecho y verificado.

Strict TDD activo: `ng test` (Vitest, jsdom, 715 tests verdes al cierre del PR 1). **No escribir código productivo antes de un test RED.** Usar el patrón de tests TestBed+token del repo actual (backup.service.spec.ts como referencia); `CobroPendienteService` sigue el patrón `createMockDb()` + token DATABASE de venta.service.spec.ts.
