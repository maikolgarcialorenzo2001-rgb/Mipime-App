# Design: Auto-Save Excel Documents

## Technical Approach

Add a `file:saveFile(base64, filePath)` IPC channel that writes directly to the user's `Documents/Tienda IPVE/` directory without a dialog. A new `ElectronFileService` in the Angular layer detects environment (`window.electronAPI?.isPackaged`), constructs the correct file path per document type, and calls IPC — or falls back to browser Blob download for dev/plain-browser mode.

The spec's REQ-01 (environment detection) is handled via a new `app:isPackaged` IPC channel exposed as `window.electronAPI.isPackaged` using `ipcRenderer.sendSync` (runs once at preload, synchronous for the renderer).

## Architecture Decisions

### Decision: IPC channel design

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `file:saveFile(base64, path)` direct write | No dialog, silent failure on error | ✅ **Chosen** |
| Reuse `dialog:saveFile` with forced path | Shows dialog, breaks UX REQ | ❌ Rejected |
| Pass through existing `send` channel | One-way, no error feedback | ❌ Rejected |

### Decision: `_generarYGuardarExcel` return value

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **(a)** Return base64 from method | Clean data flow, minimal change | ✅ **Chosen** |
| (b) Observer/callback | Adds coupling, harder to test | ❌ Rejected |
| (c) Read base64 back from DB | Extra DB query, redundant I/O | ❌ Rejected |

### Decision: `isPackaged` as synchronous property

`ipcRenderer.sendSync('app:isPackaged')` + `ipcMain.on('app:isPackaged')` gives a synchronous boolean on `window.electronAPI.isPackaged` without requiring an async IPC call. This matches the spec's REQ-01 requirement.

## Data Flow

```
Electron main                     Preload                     Angular renderer
┌──────────────┐                ┌────────────────┐          ┌──────────────────┐
│ ipcMain.on    │                │ contextBridge   │          │ ElectronFileService│
│  'app:isPackaged'│◄──sendSync──┤ isPackaged      │──────────► isPackaged        │
│              │                │                │          │  (cached)         │
│ ipcMain.handle│                │ VALID_INVOKE    │          │                  │
│  'file:saveFile'│◄──invoke─────┤ file:saveFile   │◄─────────┤ saveIndividual() │
│              │                │                │          │ saveMonthly()    │
│ fs.mkdirSync  │                │                │          │ saveRange()      │
│ fs.writeFile  │                │                │          │                  │
└──────────────┘                └────────────────┘          └──────────────────┘

jornada.service.ts                  Components
┌─────────────────────┐            ┌────────────────┐
│ _generarYGuardarExcel│──base64──►│ autoCerrar...   │
│  (returns base64)   │            │ _ejecutarCierre│
│  INSERT reporte     │            │ └─► ElectronFileService
└─────────────────────┘            │ login.page     │
                                   │ app-nav        │
                                   │ historial.page  │
                                   └────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `electron/types.d.ts` | Create | `ElectronAPI` interface + `Window` augmentation |
| `electron/main.ts` | Modify | Add `app:isPackaged` sync handler + `file:saveFile` IPC handler (mkdir + write) |
| `electron/preload.ts` | Modify | Add `'file:saveFile'` to `VALID_INVOKE_CHANNELS`, add `isPackaged` property via `sendSync` |
| `electron/main.spec.ts` | Modify | Test new IPC handlers |
| `electron/preload.spec.ts` | Modify | Test new channel + isPackaged |
| `src/app/services/electron-file.service.ts` | Create | Angular service wrapping IPC + browser fallback |
| `src/app/services/electron-file.service.spec.ts` | Create | Test environment detection, path building, IPC calls |
| `src/app/services/jornada.service.ts` | Modify | `_generarYGuardarExcel` returns `Promise<string>`; callers pass base64 to ElectronFileService |
| `src/app/services/jornada.service.spec.ts` | Modify | Assert ElectronFileService.saveIndividual is called after close |
| `src/app/pages/login/login.page.ts` | Modify | Replace `_descargarExcel` with ElectronFileService |
| `src/app/pages/login/login.page.spec.ts` | Modify | New tests |
| `src/app/components/layout/app-nav.component.ts` | Modify | Replace `_descargarExcel` with ElectronFileService |
| `src/app/components/layout/app-nav.component.spec.ts` | Modify | New tests |
| `src/app/pages/historial/historial.page.ts` | Modify | Replace `_descargarBase64`/`_descargarBase64Rango` with ElectronFileService |
| `src/app/pages/historial/historial.page.spec.ts` | Modify | New tests |

## Interfaces / Contracts

### `electron/types.d.ts`

```ts
export interface ElectronAPI {
  platform: string;
  isPackaged: boolean;
  send(channel: string, ...args: unknown[]): void;
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, callback: (...args: unknown[]) => void): void;
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
```

### `ElectronFileService` methods

```ts
class ElectronFileService {
  // returns true if running in a packaged Electron EXE
  get isElectronPackaged(): boolean;

  // saves individual jornada close Excel
  saveIndividual(base64: string, jornada: Jornada): Promise<void>;

  // saves monthly export Excel
  saveMonthly(base64: string, year: number, month: number): Promise<void>;

  // saves range export Excel
  saveRange(base64: string, desde: string, hasta: string): Promise<void>;
}
```

### IPC contracts

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `app:isPackaged` | renderer → main (sync) | — | `boolean` |
| `file:saveFile` | renderer → main (invoke) | `{ base64: string, filePath: string }` | `void` (rejects on error) |

### File path construction

- **Individual**: `{documents}/Tienda IPVE/{YYYY}/{MM - MonthName}/jornada_{YYYY-MM-DD}_{id}.xlsx`
- **Monthly**: `{documents}/Tienda IPVE/Jornada Completa Mes {MonthName}.xlsx`
- **Range**: `{documents}/Tienda IPVE/Jornada completa {dd/mm - YYYY} -- {dd/mm - YYYY}.xlsx`

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | IPC handler `file:saveFile` | Mock `fs`, `app.getPath('documents')`, assert mkdir before write |
| Unit | Preload channel validation | Test `'file:saveFile'` invoke succeeds, reject unknown channels |
| Unit | `ElectronFileService` mock IPC | Mock `window.electronAPI`, test all 3 path builders, test browser fallback |
| Unit | `jornada.service.ts` | Mock `ElectronFileService`, assert `saveIndividual` called after cierre |
| Unit | Component download methods | Mock `ElectronFileService`, assert correct method called |

## Integration Points (Detailed)

### `jornada.service.ts` — `_generarYGuardarExcel`

- Change return type from `Promise<void>` to `Promise<string>` (the base64)
- After the existing DB INSERT, `return base64`
- In both callers (`autoCerrarSiOtroUsuario`, `_ejecutarCierre`), after `await _generarYGuardarExcel(...)`:
  ```ts
  const base64 = await this._generarYGuardarExcel(jornada, datos);
  if (this._electronFileService.isElectronPackaged) {
    await this._electronFileService.saveIndividual(base64, jornada);
  }
  ```

### `login.page.ts` — `_descargarExcel`

- Replace entire method body: call `electronFileService.saveIndividual(reporte.content_base64, abierta)` in Electron, fall back to Blob download

### `app-nav.component.ts` — `_descargarExcel`

- Same pattern as login.page.ts

### `historial.page.ts` — `_descargarBase64`, `_descargarBase64Rango`, `descargarExcel`

- `descargarExcel(j)` → `electronFileService.saveIndividual(reporte.content_base64, j)` in Electron
- `_descargarBase64` (monthly) → `electronFileService.saveMonthly(base64, year, month)` in Electron
- `_descargarBase64Rango` → `electronFileService.saveRange(base64, desde, hasta)` in Electron

## Migration / Rollout

No migration required. Existing `jornada_reportes` DB records are untouched. The auto-save is additive — only activated when `window.electronAPI.isPackaged === true`.

## Open Questions

None. Design is complete.
