# SDD Proposal: auto-save-excel-documents

## Intent
Auto-guardar los Excel generados (cierre individual, exportación mensual, exportación por rango) en la carpeta `Documents/Tienda IPVE/` del usuario sin mostrar diálogo "Guardar como".

## Scope
- Cierre individual (auto-cierre login + cierre manual jornada + cerrarYGuardar)
- Exportación mensual desde historial
- Exportación por rango desde historial
- Solo en entorno Electron empaquetado (test/prod). Dev mode (`ng serve`) mantiene browser download.

## Non-scope
- No modificar el guardado en DB (`jornada_reportes` se mantiene)
- No afectar la generación del Excel (`excel.service.ts` no cambia)

## File structure

| Type | Path | Filename |
|------|------|----------|
| Individual | `Documents/Tienda IPVE/{aaaa}/{mm - Mes}/` | `jornada_{YYYY-MM-DD}_{id}.xlsx` |
| Mensual | `Documents/Tienda IPVE/` | `Jornada Completa Mes {Mes}.xlsx` |
| Rango | `Documents/Tienda IPVE/` | `Jornada completa {dd/mm - aaaa} -- {dd/mm - aaaa}.xlsx` |

## Files to modify/create

| File | Type | Change |
|------|------|--------|
| `electron/types.d.ts` | Create | `ElectronAPI` interface with `saveExcel` |
| `electron/preload.ts` | Modify | Add `file:saveExcel` channel |
| `electron/main.ts` | Modify | IPC handler: create dirs + write file |
| `src/app/services/electron-file.service.ts` | Create | Wrapper that builds path + calls IPC |
| `src/app/services/jornada.service.ts` | Modify | Call auto-save after INSERT |
| `login.page.ts` | Modify | Replace browser download with auto-save in Electron |
| `app-nav.component.ts` | Modify | Replace browser download with auto-save in Electron |
| `historial.page.ts` (or service) | Modify | Auto-save on month/range export |

## Environments

| Environment | Browser download | Auto-save |
|-------------|:-:|:-:|
| `ng serve` (dev) | ✅ | ❌ |
| Packaged EXE (test/prod) | ❌ | ✅ |

## Risks
- Low: `fs.mkdirSync({recursive})` is safe, does not overwrite existing files
- Low: IPC handler only accepts validated channel calls from preload
