# Apply Report — palmar-ventas PR4 (Pana B)

**Change**: palmar-ventas — PR4: `ElectronFileService` renderer (savePalmar / listPalmar / readPalmar)
**Branch**: `feat/palmar-pr4-fileservice` (based on `feat/palmar-pr3-ipc`, que contiene PR1 + PR2 + PR3)
**Date**: 2026-08-09
**Mode**: Strict TDD (Angular unit-test builder sobre Vitest v4; `ng test` para no-regresión)

## Qué se implementó

Abstracción del renderer sobre los canales IPC de PR3, en el service
existente `ElectronFileService`. **CERO escrituras a DB** — solo IPC o
Blob fallback; el diff no toca ningún service de datos.

| Método | Firma | Comportamiento |
|---|---|---|
| `listPalmar()` | `Promise<PalmarHistoryEntry[]>` | `invoke('file:listPalmar')` → mapea `{ok, records}` → `records[]`; `[]` si `!ok` o sin electronAPI |
| `readPalmar(fileName)` | `Promise<PalmarReadResult>` | `invoke('file:readPalmar', { fileName })` → pasa el resultado; rechaza sin electronAPI |
| `savePalmar(baseName, base64, json?)` | `Promise<PalmarSaveResult>` | `invoke('file:savePalmar', { baseName, base64, json? })`; sin electronAPI → Blob fallback (descarga `{baseName}.xlsx`) → `{ ok: true }` |

Reglas implementadas:

- **Gate por PRESENCIA de `electronAPI`** (no `isPackaged`): en navegador
  plano (`ng serve`) no hay IPC, así que `savePalmar` cae al Blob fallback,
  `listPalmar` devuelve `[]` y `readPalmar` rechaza — igual que pide el plan
  ("gated por presencia de electronAPI + Blob fallback").
- **Reprint**: `savePalmar` omite la key `json` del payload cuando
  `json === undefined` (main interpreta `json !== undefined` como "escribir
  JSON"; reprint = solo xlsx).
- **Validación en main**: `baseName` dd-mm-yyyy y `fileName` basename `.json`
  sin path traversal ya se validan en main (PR3); el renderer pasa por alto.
- **Reuso**: el Blob fallback es el `_blobFallback` existente del service
  (mismo patrón que `saveIndividual`/`saveMonthly`/`saveRange`), incluido el
  revoke diferido de BACKLOG-5.

## Tipos

- Resultados IPC (`PalmarSaveResult`, `PalmarReadResult`, `PalmarListResult`,
  `PalmarHistoryEntry`) → **globales de `electron/types.d.ts`** vía la
  triple-slash reference existente del service (patrón de los otros métodos).
- `PalmarRecord` (json opcional) → importado de `../models/palmar-jornada`
  (fuente única del modelo, PR1). Sin tipos duplicados nuevos.
- **Desviación de nomenclatura del contrato**: el plan firmaba
  `Promise<ReadPalmarResult>` / `Promise<SavePalmarResult>`, pero esos nombres
  NO existen en el codebase — los globales reales de PR3 son
  `PalmarReadResult` / `PalmarSaveResult`. Se usan los nombres reales (los
  tipos del contrato IPC de PR3 son la fuente de verdad; no se crearon tipos
  duplicados).

## Archivos cambiados

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/app/services/electron-file.service.ts` | Modificado | +51: import `PalmarRecord` + 3 métodos públicos (`listPalmar`/`readPalmar`/`savePalmar`) con gate por presencia de electronAPI |
| `src/app/services/electron-file.service.spec.ts` | Modificado | +189: fixture `PALMAR_RECORD_FIXTURE` + 3 describes (`savePalmar` 3 tests, `listPalmar` 3, `readPalmar` 2) = 8 tests RED/GREEN |

## Resultados de tests

- `ng test --include='**/electron-file.service.spec.ts'`: **18/18 passed**
  (10 baseline + 8 nuevos). Safety net: 10/10 antes de tocar nada.
- `ng test` (suite completa): **799/799 passed** (47 files) — 791 baseline
  + 8 nuevos, sin regresión.
- TDD: RED confirmado (8 × TS2339 `savePalmar/listPalmar/readPalmar does not
  exist`) → GREEN (18/18) → triangulación (reprint sin json vía
  `hasOwnProperty`, `!ok` → `[]`, fallback Blob con revoke diferido).
- Nota: el test de fallback Blob expuso un leak de spy pre-existente
  (`downloadBlob` no restaura `URL.createObjectURL`); se añadió
  `vi.restoreAllMocks()` en el `beforeEach` del describe `savePalmar` — sin
  tocar los tests existentes.

## Lint

`ng lint`: **120 problems — idéntico al baseline pre-existente** (0 nuevos).
Los matches en `electron-file.service.ts` (triple-slash reference legacy,
línea 1) y el `createElement` sin usar en el test pre-existente de
`downloadBlob` ya existían antes del PR (solo corrieron de línea).

## Commits

| Hash | Mensaje |
|------|---------|
| `c05d967` | `feat(palmar): abstraer savePalmar/listPalmar/readPalmar en ElectronFileService` |

## Desviaciones / riesgos

- **Nombres de tipos del contrato**: `ReadPalmarResult`/`SavePalmarResult`
  del plan → reales `PalmarReadResult`/`PalmarSaveResult` (ver Tipos).
  Comportamiento idéntico; solo cambia el nombre del tipo de retorno.
- **Formato**: `prettier --check` da warn en ambos archivos por line endings
  CRLF pre-existentes del repo (prettier normaliza a LF). El código NUEVO se
  formateó a mano (single quotes, 2-space, ≤100 chars) para no meter churn.
- Los 3 archivos untracked de reportes PR2/PR3 (`apply-report-pr2.md`,
  `verify-report-pr2.md`, `verify-report-pr3.md`) quedaron sin commitear — no
  son de este work unit; se dejan para quien cierre esos PRs.
