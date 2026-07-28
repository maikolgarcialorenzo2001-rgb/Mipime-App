# Proposal: Arqueo de Caja

## Intent

At jornada close, the user physically counts bills and enters quantities per denomination. The system computes `total_en_caja`, compares it against `saldo_esperado`, and surfaces surpluses/shortages in the Excel report. Currently the close modal just shows `saldo_esperado` and auto-calculates `saldo_real` — there is no physical count step.

## Scope

### In Scope

- New `arqueo_caja` DB table (migration v13) with 12 denomination count columns + `jornada_id` FK
- New `ArqueoCaja` model interface
- Bill counting form inside the close-jornada modal: numeric inputs for each denomination (5000→1), ordered largest→smallest
- Optional denominations ($1, $3) with checkbox toggle — unchecked denominations stored as NULL
- Computed `total_en_caja` signal in real-time as user types
- Display of `saldo_esperado` target in modal
- Sobrante/Faltante indicator when `total_en_caja !== saldo_esperado`
- Persist `arqueo_caja` row at jornada close alongside `saldo_real = total_en_caja`
- Excel update: new "Arqueo" section in Resumen sheet showing denomination breakdown, total en caja, sobrante or faltante
- `_ejecutarCierre` signature change: accept `arqueoCaja` data and use `total_en_caja` as `saldo_real` (fix current bug where `saldoReal` param is ignored)
- Regenerate Excel: `_recolectarDatosJornada` must fetch arqueo data for monthly/range exports

### Out of Scope

- Currency coin denominations (only bills)
- Multi-currency arqueo
- Editing arqueo after jornada is closed
- Arqueo comparison dashboard / history view
- Auto-suggestion of bill counts based on transactions

## Capabilities

### New Capabilities

- `arqueo-caja`: Bill counting form, denomination persistence, sobrante/faltante calculation, and Excel arqueo section

### Modified Capabilities

- `jornada-lifecycle`: Jornada closure now requires arqueo data; `saldo_real` derives from physical count instead of auto-calculation
- `excel-reportes`: Resumen sheet gains denomination breakdown table + sobrante/faltante section; `JornadaReportData` gains `arqueoCaja` field

## Approach

**DB: Separate `arqueo_caja` table** (not columns on `jornadas`). Rationale:
- 1:1 with jornada but conceptually distinct data (physical count vs financial state)
- Clean regeneration path: `_recolectarDatosJornada` does a single JOIN query
- No ALTER TABLE on a heavily-used `jornadas` table
- Nullable columns for optional denominations ($1, $3) — clean semantics

**Flow change in `_ejecutarCierre`**: Fix the current bug where `saldoReal` parameter is ignored. The method will use the passed `total_en_caja` as `saldo_real` in the UPDATE statement, replacing the internal auto-calculation.

**UI**: Extend the existing close modal with a scrollable denomination grid. Two signals: `arqueoCantidades` (Map<denomination, number>) and `arqueoHabilitado` (Map<denomination, boolean>). A computed signal `totalEnCaja` sums enabled denominations.

**Denominations constant**: Single source of truth array `DENOMINACIONES = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 3, 1]` exported from the model.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/models/arqueo-caja.ts` | New | `ArqueoCaja` interface + `DENOMINACIONES` constant |
| `src/app/services/sqlite.service.ts` | Modified | Migration v13: create `arqueo_caja` table |
| `src/app/services/jornada.service.ts` | Modified | `_ejecutarCierre` accepts arqueo data, saves row, uses `total_en_caja` as `saldo_real`; `_recolectarDatosJornada` fetches arqueo; `cerrar()` signature changes |
| `src/app/services/excel.service.ts` | Modified | `JornadaReportData` gains `arqueoCaja?`; `_agregarResumen` + `_agregarJornadaSheet` add arqueo section |
| `src/app/pages/jornada/jornada.page.ts` | Modified | Arqueo signals, computed total, `confirmarCierre` passes arqueo data |
| `src/app/pages/jornada/jornada.page.html` | Modified | Modal: denomination form, total display, sobrante/faltante indicator |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backward compat: old jornadas without arqueo_caja row | High | All arqueo fields nullable; Excel checks `arqueoCaja ?? null` before rendering section; old reports unaffected |
| Migration v13 failure on existing DB | Low | Simple CREATE TABLE IF NOT EXISTS — no ALTER, no data migration |
| User enters 0 for all denominations | Medium | Form requires at least one non-zero count; disable "Cerrar" button until `total_en_caja > 0` |
| `_ejecutarCierre` signature change breaks callers | Low | Only called from `_cerrarAsync`; monthly/range exports use `_recolectarDatosJornada` (no closure involved) |

## Rollback Plan

1. Revert migration: drop `arqueo_caja` table (data only affects closed jornadas)
2. Revert `_ejecutarCierre` to auto-calc behavior (restore `saldoRealCalculado` logic)
3. Revert modal to original simple confirm dialog
4. All existing jornadas and Excel reports remain intact — arqueo is additive

## Dependencies

- None. Pure additive feature with no external library changes.

## Success Criteria

- [ ] User can enter bill quantities for all 12 denominations in the close modal
- [ ] Optional denominations ($1, $3) can be toggled on/off
- [ ] `total_en_caja` updates in real-time as quantities change
- [ ] Modal displays `saldo_esperado` and sobrante/faltante difference
- [ ] On close, `arqueo_caja` row is persisted with correct `jornada_id`
- [ ] `saldo_real` in jornadas equals `total_en_caja` (not auto-calculated)
- [ ] Excel Resumen shows denomination breakdown table
- [ ] Excel Resumen shows sobrante or faltante section with amount
- [ ] Monthly/range Excel exports include arqueo data for each jornada
- [ ] Jornadas without arqueo data (pre-migration) render Excel correctly without arqueo section
- [ ] All existing 392 tests pass; new tests cover arqueo calculation, persistence, and Excel rendering
