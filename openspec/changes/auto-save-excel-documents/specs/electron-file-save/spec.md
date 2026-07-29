# Electron File Save Specification

## Purpose

Auto-save generated Excel files to the user's `Documents/Tienda IPVE/` directory when running in a packaged Electron EXE, without showing a "Save As" dialog. In dev mode (`ng serve`), fall back to browser download (current behavior). DB storage of reports (`jornada_reportes`) is unaffected.

## Requirements

### REQ-01: Environment Detection

The system MUST detect whether it is running in a packaged Electron environment (`app.isPackaged === true`) and expose this to the renderer via `window.electronAPI.isPackaged`.

#### Scenario: Packaged EXE detected

- GIVEN the app is running as a packaged Electron EXE
- WHEN the renderer reads `window.electronAPI.isPackaged`
- THEN it returns `true`

#### Scenario: Dev mode detected

- GIVEN the app is running via `ng serve`
- WHEN the renderer reads `window.electronAPI.isPackaged`
- THEN it returns `false`

#### Scenario: No Electron runtime

- GIVEN the app is running in a regular browser (no Electron)
- WHEN the renderer tries to read `window.electronAPI`
- THEN `window.electronAPI` is `undefined`

### REQ-02: Individual Close Auto-Save

When a jornada is closed (auto-close on login, manual close via app-nav, or cerrarYGuardar), the system MUST save the Excel to `Documents/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx` without showing a dialog.

#### Scenario: Different user logs in → auto-close saves Excel

- GIVEN there is an open jornada from another user
- WHEN the new user logs in and auto-close triggers
- THEN the Excel is saved to `Documents/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx`
- AND no browser download dialog appears

#### Scenario: Admin closes jornada manually

- GIVEN an admin has an open jornada with sales, movements, and arqueo
- WHEN the admin confirms closure via app-nav modal
- THEN the Excel is saved to `Documents/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx`
- AND no browser download dialog appears

#### Scenario: cerrarYGuardar on login

- GIVEN a user is on the login page and chooses "Cerrar y guardar"
- WHEN the jornada closes successfully
- THEN the Excel is saved to `Documents/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx`

### REQ-03: Monthly Export Auto-Save

When exporting a month from historial, the system MUST save the Excel to `Documents/Tienda IPVE/Jornada Completa Mes {MonthName}.xlsx`.

#### Scenario: Export month

- GIVEN the historial page shows jornadas for a specific month
- WHEN the user clicks "Exportar mes"
- THEN the Excel is saved to `Documents/Tienda IPVE/Jornada Completa Mes {MonthName}.xlsx`

### REQ-04: Range Export Auto-Save

When exporting a date range from historial, the system MUST save the Excel to `Documents/Tienda IPVE/Jornada completa {dd/mm - YYYY} -- {dd/mm - YYYY}.xlsx`.

#### Scenario: Export range

- GIVEN the historial page has a date range selected
- WHEN the user clicks "Exportar"
- THEN the Excel is saved to `Documents/Tienda IPVE/Jornada completa {dd/mm - YYYY} -- {dd/mm - YYYY}.xlsx`

### REQ-05: Dev Mode Fallback

In dev mode (`ng serve`), the system MUST use browser download (Blob URL + `<a>` click) for all Excel exports, identical to current behavior. Auto-save MUST NOT be attempted.

#### Scenario: Dev mode fallback

- GIVEN `window.electronAPI.isPackaged` is `false`
- WHEN any Excel export is triggered
- THEN the browser download method (Blob + `<a>`) is used

### REQ-06: Non-Electron Guard

When `window.electronAPI` is `undefined` (plain browser), the system MUST use browser download and MUST NOT attempt IPC calls.

#### Scenario: Plain browser fallback

- GIVEN `window.electronAPI` is `undefined`
- WHEN any Excel export is triggered
- THEN the browser download method is used
- AND no IPC call is attempted

### REQ-07: DB Persistence Unchanged

Excel files MUST still be stored as `jornada_reportes` in the database as before. Auto-save to the filesystem is an ADDITIONAL persistence layer.

#### Scenario: DB storage preserved

- GIVEN a jornada is closed in a packaged Electron environment
- WHEN the Excel is auto-saved to Documents
- THEN the `jornada_reportes` table still contains the same base64 content as before

## TDD Columns

| Req | Test | RED | GREEN | TRIANGULATE |
|-----|------|-----|-------|-------------|
| REQ-01 | `electronAPI.isPackaged` from preload | ✓ | ✓ | ✓ |
| REQ-01 | `electronAPI` undefined in browser | ✓ | ✓ | — |
| REQ-02 | IPC `file:saveExcel` writes to correct individual path | ✓ | ✓ | — |
| REQ-02 | Directory `{YYYY}/{MM - MonthName}/` created recursively | ✓ | ✓ | ✓ |
| REQ-03 | IPC `file:saveExcel` writes monthly export path | ✓ | ✓ | — |
| REQ-04 | IPC `file:saveExcel` writes range export path | ✓ | ✓ | — |
| REQ-05 | Dev mode uses Blob download, not IPC | ✓ | ✓ | ✓ |
| REQ-06 | No Electron → Blob download, no error | ✓ | ✓ | — |
| REQ-07 | `jornada_reportes` still has base64 after close | ✓ | ✓ | — |
