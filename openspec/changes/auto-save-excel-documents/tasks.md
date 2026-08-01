# Tasks: auto-save-excel-documents

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500-600 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Electron layer → PR 2: ElectronFileService + JornadaService → PR 3: Component integration |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

## Task List

### PR 1: Electron layer (foundation)

- [ ] **1.1** Create `electron/types.d.ts` — `ElectronAPI` interface + `Window` augmentation (isPackaged, invoke, send, on, removeAllListeners). Dep: none. Effort: small.
- [ ] **1.2** Modify `electron/main.ts` — add `ipcMain.on('app:isPackaged')` sync handler returning `app.isPackaged` + `ipcMain.handle('file:saveFile')` that does `fs.mkdirSync({recursive})` + `fs.writeFileSync`. Dep: 1.1. Effort: small.
- [ ] **1.3** Modify `electron/preload.ts` — add `'file:saveFile'` to `VALID_INVOKE_CHANNELS`, expose `isPackaged` via `ipcRenderer.sendSync('app:isPackaged')`. Dep: 1.1, 1.2. Effort: small.
- [ ] **1.4** Tests for main.ts — assert `file:saveFile` writes file at correct path, creates directories, rejects on error. Dep: 1.2. Effort: medium.
- [ ] **1.5** Tests for preload.ts — assert `'file:saveFile'` is valid invoke channel, `isPackaged` exposed boolean. Dep: 1.3. Effort: small.

### PR 2: Core service + JornadaService wiring

- [ ] **2.1** Create `src/app/services/electron-file.service.ts` with `isElectronPackaged` getter + `saveIndividual(base64, jornada)`, `saveMonthly(base64, year, month)`, `saveRange(base64, desde, hasta)` methods. Browser Blob fallback for dev/plain-browser. Dep: none (ElectronAPI types only). Effort: medium.
- [ ] **2.2** Create `src/app/services/electron-file.service.spec.ts` — test all 3 path builders, env detection (packaged/dev/browser), IPC calls and fallback. Dep: 2.1. Effort: medium.
- [ ] **2.3** Modify `src/app/services/jornada.service.ts` — inject `ElectronFileService`, change `_generarYGuardarExcel` return to `Promise<string>`, call `electronFileService.saveIndividual` in both `autoCerrarSiOtroUsuario` and `_ejecutarCierre` after DB INSERT. Dep: 2.1. Effort: medium.
- [ ] **2.4** Modify `src/app/services/jornada.service.spec.ts` — assert `saveIndividual` called after close with correct base64 + jornada. Dep: 2.3. Effort: small.

### PR 3: Component integration

- [ ] **3.1** Modify `login.page.ts` — replace `_descargarExcel` Blob download with `electronFileService.saveIndividual` in Electron, keep Blob fallback. Dep: 2.1. Effort: small.
- [ ] **3.2** Modify `login.page.spec.ts` — assert ElectronFileService called on auto-close and cerrarYGuardar. Dep: 3.1. Effort: small.
- [ ] **3.3** Modify `app-nav.component.ts` — same replacement of `_descargarExcel` with ElectronFileService. Dep: 2.1. Effort: small.
- [ ] **3.4** Modify `app-nav.component.spec.ts` — assert ElectronFileService called after cierre confirm. Dep: 3.3. Effort: small.
- [ ] **3.5** Modify `historial.page.ts` — replace `descargarExcel` (individual), `_descargarBase64` (monthly), `_descargarBase64Rango` (range) with corresponding ElectronFileService methods. Dep: 2.1. Effort: medium.
- [ ] **3.6** Modify `historial.page.spec.ts` — assert all 3 export methods use ElectronFileService in Electron. Dep: 3.5. Effort: small.

## Implementation Order

PR 1 (Electron layer) is fully independent — no Angular dependencies. PR 2 depends on PR 1's types and IPC contract. PR 3 depends on PR 2's service. Each PR is independently verifiable: PR 1 via `vitest run electron/`, PR 2-3 via `ng test`.

## TDD Coverage by Requirement

| Req | Test entry | Task |
|-----|-----------|------|
| REQ-01 isPackaged detects env | `electronAPI.isPackaged` from preload | 1.3, 1.5 |
| REQ-02 Individual close auto-save | IPC writes correct individual path | 1.2, 1.4, 2.3, 2.4 |
| REQ-03 Monthly export auto-save | IPC writes monthly path | 1.2, 1.4, 3.5, 3.6 |
| REQ-04 Range export auto-save | IPC writes range path | 1.2, 1.4, 3.5, 3.6 |
| REQ-05 Dev mode fallback | Blob download used, not IPC | 2.1, 2.2 |
| REQ-06 Non-Electron guard | `electronAPI` undefined → Blob | 2.1, 2.2 |
| REQ-07 DB persistence unchanged | `jornada_reportes` still has base64 | 2.3, 2.4 |
