# Tasks: fix-cuenta-casas-feedback

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380-450 across 7 files |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR, work-unit commits |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units (all land in PR 1)

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| U1 | Service batch+list (T1-T3) | `bunx vitest run src/app/services/cuenta-cosa.service.spec.ts` | N/A — pure DB unit scope, no UI | Revert T2-T3, restore original registrar() |
| U2 | POS wiring (T4-T5) | `bunx vitest run src/app/pages/pos/pos.page.spec.ts` | N/A — component unit, Electron manual smoke later | Revert T5 only; service stays |
| U3 | Jornada feedback (T6-T8) | `bunx vitest run src/app/pages/jornada/jornada.page.spec.ts` | N/A — template covered by specs | Revert T7-T8; drop signal+block |

## Tasks (strict TDD: RED test task precedes GREEN task)

| ID | Task | Deps | TDD | AC | Commit |
|----|------|------|-----|----|--------|
| T1 | **RED** `src/app/services/cuenta-cosa.service.spec.ts`: registrarLote success (2 rows+2 salidas, no UPDATE jornadas), pre-validation stock fail → reject 'Stock insuficiente' (zero BEGIN/INSERT/salida), single insufficient, empty array → zero sql, mid-txn salida reject → ROLLBACK/no COMMIT/rethrow; listarPorJornada (FROM cuenta_cosas, ORDER BY created_at, params, rows as-is, empty → []); registrar delegation (mock `stock_shop: 100`). Why: prove batch semantics first | — | RED → fail (methods missing) | New tests fail | n/a (RED) |
| T2 | **GREEN** `src/app/services/cuenta-cosa.service.ts`: add `CuentaCosaItem{productoId,cantidad}` + `registrarLote(jId,items,desc,autorizado)` (empty→resolve; `_validarStock` all pre-BEGIN via `stock_shop`, throw 'Stock insuficiente'; BEGIN; per item INSERT + `registrarSalida`; COMMIT; catch→ROLLBACK+rethrow) + `_validarStock`; `registrar` delegates. Why: all-or-nothing writes | T1 | GREEN | T1 green | fix(services): transactional registrarLote batch |
| T3 | **GREEN** `src/app/services/cuenta-cosa.service.ts`: `listarPorJornada(jId)` → `SELECT * FROM cuenta_cosas WHERE jornada_id=? ORDER BY created_at ASC, id ASC`. Why: jornada feedback data | T1 | GREEN | T1 list specs green | feat(services): listarPorJornada query |
| T4 | **RED** `src/app/pages/pos/pos.page.spec.ts` 2.11 rewrite: mock `registrarLote: vi.fn()` + productoB id:2; multi A×2+B×3 → `(1,[{productoId:1,cantidad:2},{productoId:2,cantidad:3}],'Retiro familiar','María')`, registrar/ventaService NOT called; single → batch of 1; empty cart → no service call; metadata pass-through. Why: prove no collapse | T2 | RED → fail (no registrarLote call) | New tests fail | n/a (RED) |
| T5 | **GREEN** `src/app/pages/pos/pos.page.ts` confirmarVenta branch (231-243): `if (items.length===0) return;` then `registrarLote(jId, items.map(i=>({productoId:i.producto.id,cantidad:i.cantidad})), payload.descripcion, payload.autorizadoPor)`; drop `items[0]` collapse. Why: per-product rows + empty guard | T4 | GREEN | T4 green | fix(pos): per-product registrarLote + empty-cart guard |
| T6 | **RED** `src/app/pages/jornada/jornada.page.spec.ts`: new describe — rows → 4th block renders 5 columns chronological + name via productosMap; no rows → hidden; `!j`/catch → `cuentasCosasDelDia()` empty. Fix mockResolvedValueOnce order: 1 ventas, 2 movimientos, 3 mermas, 4 productos, 5 listarPorJornada, 6 detalle_ventas (only if ventas non-empty). Why: query-order drift protection | T3 | RED → fail (signal/block missing) | New tests fail | n/a (RED) |
| T7 | **GREEN** `src/app/pages/jornada/jornada.page.ts`: inject CuentaCosasService; `cuentasCosasDelDia = signal<CuentaCosa[]>([])`; 5th query `listarPorJornada(j.id)` in Promise.all; set on success; clear in `!j` + catch. Why: daily feedback signal | T6 | GREEN | T6 green | feat(jornada): cuentasCosasDelDia signal + 5th query |
| T8 | **GREEN** `src/app/pages/jornada/jornada.page.html`: line-19 condition `+ cuentasCosasDelDia().length > 0`; Mermas `border-b`; 4th `@if` block after Mermas: table Producto (`productosMap().get(c.producto_id) ?? '#'+id`), Cantidad, Descripción, Autorizado por, Hora (`created_at | date:'short'`). Why: visible feedback | T7 | GREEN | T6 template specs green | feat(jornada): render Cuenta Casas del día block |
| T9 | **Verify**: `bunx vitest run` the 3 touched specs green; `bun run lint` clean. Why: regression gate | T2,T3,T5,T7,T8 | — | All green, lint clean | n/a (verify gate) |
