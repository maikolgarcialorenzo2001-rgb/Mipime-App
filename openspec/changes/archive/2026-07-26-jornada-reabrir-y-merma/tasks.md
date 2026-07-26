# Tasks: Reabrir Jornada + Merma

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR#1 (reopen) → PR#2 (merma) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migration v9 + Jornada reopen (model, service, modal) | PR#1 | Base: main. ~150 lines. |
| 2 | Merma (model, service, UI, Excel, table) | PR#2 | Base: main after PR#1 merges. ~200 lines. |

---

## Phase 1: Infrastructure (PR#1)

- [x] 1.1 Migration v9 in `sqlite.service.ts`: ALTER TABLE jornadas ADD COLUMN user_apertura_id, ALTER TABLE stock_movimientos ADD COLUMN costo_total, ALTER TABLE jornadas ADD COLUMN total_merma
- [x] 1.2 Update `src/app/models/jornada.ts`: add `user_apertura_id: number | null` and `total_merma: number`
- [x] 1.3 Update `src/app/models/stock-movimiento.ts`: add `costo_total: number` and extend tipo to include `'merma'`

## Phase 2: Reabrir Jornada — Service (PR#1)

- [x] 2.1 `jornada.service.ts`: modify `abrir()` to accept optional `userId` param, store in user_apertura_id
- [x] 2.2 `jornada.service.ts`: add `autoCerrarSiOtroUsuario(usuario: UsuarioPublico): Promise<Jornada | null>` — queries open jornada, compares user_apertura_id, auto-closes if different
- [x] 2.3 `jornada.service.ts`: update `obtenerAbierta()` SELECT to include user_apertura_id

## Phase 3: Reabrir Jornada — Login Flow (PR#1)

- [x] 3.1 `login.page.ts`: after successful login + navigation to /pos, call `autoCerrarSiOtroUsuario()` — if returns null (auto-closed), show toast "Jornada anterior cerrada automáticamente"
- [x] 3.2 `jornada.page.ts`: add reopen modal signals (`showReopenModal`, `reopening`) and methods (`abrirModalReapertura`, `reabrirJornada`, `cerrarYGuardar`)
- [x] 3.3 `jornada.page.html`: add reopen modal UI (similar to close modal) with "Reabrir jornada" (green) and "Cerrar y guardar" (red) buttons
- [x] 3.4 `jornada.page.ts`: in reopen flow, detect same-user-same-day open jornada and trigger modal

## Phase 4: Reabrir Jornada — Tests (PR#1)

- [x] 4.1 `jornada.service.spec.ts`: test `autoCerrarSiOtroUsuario` — different user auto-closes, same user returns jornada, no open jornada returns null
- [x] 4.2 `jornada.page.spec.ts`: test reopen modal — same user shows modal, confirm reopens, decline closes
- [x] 4.3 `login.page.spec.ts`: test post-login flow — different user triggers auto-close, same user triggers reopen prompt

## Phase 5: Merma — Service (PR#2)

- [x] 5.1 `stock-movimiento.service.ts`: add `registrarMerma(productoId, cantidad, motivo?, jornadaId?)` — consumes FIFO, sums costo_total, inserts with tipo='merma', updates stock
- [x] 5.2 `jornada.service.ts`: add `calcularTotalMerma(jornadaId): number` — SUM(costo_total) WHERE tipo='merma'
- [x] 5.3 `jornada.service.ts`: update `refreshJornadaAbierta()` to include total_merma in jornada data
- [x] 5.4 `jornada.service.ts`: update saldo_esperado formula: `monto_inicial + total_ventas - total_gastos - total_merma`

## Phase 6: Merma — InventarioPage (PR#2)

- [x] 6.1 `inventario.page.html`: add "Merma" button (red) next to Ajustar button
- [x] 6.2 `inventario.page.ts`: add merma form signals and `onSubmitMerma()` method
- [x] 6.3 `inventario.page.html`: add merma inline form (cantidad, motivo, Guardar/Cancelar)

## Phase 7: Merma — JornadaPage (PR#2)

- [x] 7.1 `jornada.page.ts`: add computed signals for ventas, movimientos, mermas of the day
- [x] 7.2 `jornada.page.html`: add daily table section below summary card with 3 subsections (Ventas, Movimientos, Mermas)
- [x] 7.3 `jornada-summary-card.component.html`: add "Mermas" field showing total_merma (red)

## Phase 8: Merma — Excel (PR#2)

- [x] 8.1 `excel.service.ts`: update `generarExcelJornada()` to include merma data (product, qty, cost) in report
- [x] 8.2 `jornada.service.ts`: update `_ejecutarCierre()` to pass merma data to Excel service

## Phase 9: Merma — Tests (PR#2)

- [x] 9.1 `stock-movimiento.service.spec.ts`: test `registrarMerma` — FIFO consumption, cost calculation, stock update
- [x] 9.2 `inventario.page.spec.ts`: test merma button visible, form submits, error on insufficient stock
- [x] 9.3 `jornada.page.spec.ts`: test merma entries display in daily table, total_merma shown in summary
- [x] 9.4 `jornada.service.spec.ts`: test saldo_esperado with merma, calcularTotalMerma

## Summary

| Phase | Tasks | PR |
|-------|-------|----|
| Phase 1: Infrastructure | 3 | PR#1 |
| Phase 2: Service (reopen) | 3 | PR#1 |
| Phase 3: Login Flow | 4 | PR#1 |
| Phase 4: Tests (reopen) | 3 | PR#1 |
| Phase 5: Service (merma) | 4 | PR#2 |
| Phase 6: InventarioPage | 3 | PR#2 |
| Phase 7: JornadaPage | 3 | PR#2 |
| Phase 8: Excel | 2 | PR#2 |
| Phase 9: Tests (merma) | 4 | PR#2 |
| **Total** | **29** | |

**PR#1 (Phases 1-4):** ~150 lines, 13 tasks
**PR#2 (Phases 5-9):** ~200 lines, 16 tasks
