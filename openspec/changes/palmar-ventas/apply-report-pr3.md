# Apply Report — palmar-ventas PR3 (Pana B)

**Change**: palmar-ventas — PR3: canales IPC `file:savePalmar` / `file:listPalmar` / `file:readPalmar`
**Branch**: `feat/palmar-pr3-ipc` (based on `feat/palmar-pr2-excel`, que contiene PR1 + PR2)
**Date**: 2026-08-09
**Mode**: Strict TDD (vitest electron config; `ng test` para no-regresión Angular)

## Qué se implementó

Tres canales IPC en el proceso main de Electron para jornadas Palmar, con
**CERO escrituras a DB** (solo filesystem). El main es dueño del filesystem
y del sufijo: el renderer nunca decide rutas finales.

| Canal | Payload | Resultado |
|---|---|---|
| `file:savePalmar` | `{ baseName, base64, json? }` | `{ ok, xlsxPath?, jsonPath?, error? }` |
| `file:listPalmar` | — | `{ ok, records?: PalmarHistoryEntry[], error? }` |
| `file:readPalmar` | `{ fileName }` (basename `.json`) | `{ ok, record?: PalmarRecord, error? }` |

Reglas implementadas:

- **Validación en main (IPC = no confiable, T7)**: `baseName` debe matchear
  `/^\d{2}-\d{2}-\d{4}$/`; `fileName` debe ser basename puro terminado en
  `.json` sin `/`, `\` ni `..` (S1, rechazo de path traversal).
- **Sufijo en main (regla de negocio)**: cuando `{base}.xlsx` O `{base}.json`
  existe, se usa `-2`, `-3`... — nunca sobrescribir. Devuelve ambos paths.
- **Handlers NUNCA lanzan (M1)**: todo en try/catch → `{ ok: false, error }`.
- Carpeta destino: `Documents/Tienda - App/Palmar/` (convención de la app:
  `app.getPath('documents')` + `'Tienda - App'`, con espacios — patrón
  existente de `rodantePathFor`).
- `file:listPalmar` filtra solo `.json`, mapea a `PalmarHistoryEntry`
  (fileName, createdAt, totalVentas, totalArqueo, totalRecibido, usuario)
  y ordena por `createdAt` descendente. Error si la carpeta no existe.
- `file:readPalmar` lee el `.json` y devuelve el `PalmarRecord` parseado.

## Tipos

`electron/types.d.ts` (convención existente de la DB nativa): el proceso
main no importa desde `src/` (rootDir de `electron/tsconfig.json`), así que
se declaran las formas globales del contrato: `PalmarSavePayload/Result`,
`PalmarListResult`, `PalmarReadPayload/Result` + espejos globales de
`PalmarRecord`, `PalmarHistoryEntry`, `PalmarProductoEntry`, `PalmarDivisa`,
`PalmarArqueoCajaEntry` (espejo de `ArqueoCajaEntry`). Reconciliar con
`src/app/models/palmar-jornada.ts` (PR1) si cambian en el merge.

## Archivos cambiados

| Archivo | Acción | Detalle |
|---------|--------|---------|
| `electron/types.d.ts` | Modificado | +94: contrato IPC Palmar (payloads, resultados, espejos de modelos) |
| `electron/preload.ts` | Modificado | +4: 3 canales en `VALID_INVOKE_CHANNELS` |
| `electron/preload.spec.ts` | Modificado | +34: 3 tests RED/GREEN (canales expuestos y cableados) |
| `electron/main.ts` | Modificado | +130: `palmarDirFor()` + 3 handlers IPC |
| `electron/main.spec.ts` | Modificado | +447/-1: mock fs con `readdirSync`/`readFileSync` hoisted + 19 tests RED/GREEN |

## Resultados de tests

- `bunx vitest run --config vitest.electron.config.ts`: **164 passed** (142
  baseline + 22 nuevos: 19 main + 3 preload) / **1 fallo pre-existente**
  (ver Riesgos).
- TDD: RED confirmado (23 fallos: 22 nuevos por canales inexistentes + 1
  pre-existente) → GREEN (22/22 verdes). Triangulación: sufijos -2/-3,
  reprint sin json, base.json ocupado, xlsx no listado, malformed json,
  path traversal (5 variantes).
- `ng test` (suite completa): **791/791 passed** (47 test files) — sin
  regresión (types.d.ts se ve desde Angular vía triple-slash reference).
- `ng lint`: **120 problems — idéntico al baseline pre-existente** (0
  nuevos; los matches "electron" son la triple-slash reference legacy de
  `src/app/services/electron-file.service.ts`, pre-existente).

## Commits

| Hash | Mensaje |
|------|---------|
| `a54d18e` | `feat(electron): exponer canales IPC Palmar en preload y tipar contrato` |
| `b964eeb` | `feat(electron): implementar canales IPC savePalmar/listPalmar/readPalmar` |

## Desviaciones / riesgos

- **Fallo pre-existente en la suite electron (NO tocado)**: el test
  `INTEGRATION: real runMigrations ... V1→V16` espera `schema_version` 16
  pero `db-migrations.ts` ya llega a v17. Falla desde la base de este PR
  (confirmado en el baseline inicial, antes de tocar nada). Ajeno al
  alcance palmar; requiere un fix de test en otro work unit.
- **Formato**: los archivos electron originales NO son prettier-clean
  (baseline). Se formateó a mano SOLO el código nuevo (single quotes,
  2-space, ≤100 chars) para no meter churn de líneas preexistentes en el
  diff. `prettier --check` global da warn en electron/* por ese baseline.
- `file:listPalmar` ordena por `createdAt` descendente (decisión de
  implementación; el contrato solo exige el tipo `PalmarHistoryEntry[]`).
