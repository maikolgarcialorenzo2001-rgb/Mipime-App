# Plan de PRs — palmar-ventas

Registro de jornadas de la tienda externa **"Palmar"** (solo registro, cero escrituras en la base de datos).

- **Rama de trabajo**: `palmar-feature`
- **Estrategia de entrega**: `stacked-to-main` — cada PR mergea a `main` en orden (1 → 8)
- **Equipo**: Pana A (dueño) / Pana B
- **Estado**: planificado — esperando inicio de PR1 (A) y PR2 (B)

## Contexto de negocio (resumen)

La tienda externa "Palmar" vende productos del catálogo por su cuenta. La app solo **registra** lo que hizo Palmar cada jornada: cantidades vendidas por producto + conteo de billetes (arqueo) + divisa (USD/EUR) + transferencias. **NO se escribe nada en la base de datos** — la única consulta SQL es la lectura fresca de productos (`ProductoService.listar()`) al abrir el modal.

Cada jornada genera:
- **Excel de 3 hojas** (Resumen / Arqueo / Ventas)
- **JSON** (fuente de verdad, para historial y reimpresión)

Ubicación: `Documents/Tienda - App/Palmar/{dd-mm-yyyy}[{-n}].xlsx|.json`

### Reglas de negocio aprobadas (NO cambiar sin hablar con el dueño)

| Regla | Detalle |
|---|---|
| Cero DB writes | Solo lectura de `productos`; test-enforced |
| Carpeta | `Documents/Tienda - App/Palmar/` (con espacios, convención de la app) |
| JSON + Excel | Directo en la carpeta Palmar (sin subcarpeta `registros`) |
| Sufijo | Mismo día: `-2`, `-3` … cuando `{base}.xlsx` O `{base}.json` exista (nunca sobreescribir) |
| Volver a imprimir | Siempre archivo NUEVO con la regla de sufijo; no modifica el JSON |
| Fase 1 | Todos los productos pre-rellenados con 0; Excel muestra solo cantidad > 0 |
| Validación | ≥1 producto con cantidad > 0 Y ≥1 denominación > 0; la diferencia NO bloquea |
| Arqueo | Componente compartido `arqueo-billetes-form` (extraído de `app-nav`) |
| Admin only | Ruta `canActivate: [authGuard, adminGuard]`; links nav bajo `auth.hasRole('admin')` |
| Semana | Lunes a domingo (la de la fecha de la jornada); resumen semanal recalculado fresco en reprint |

### Fase 3 del modal (cálculos)

| Campo | Cálculo |
|---|---|
| Total ventas | Σ cantidad × `precio_venta` |
| Efectivo (arqueo) | Σ denominación × cantidad |
| Divisas → CUP | `usd × tasa_usd + eur × tasa_eur` (tasa manual, equivalente CUP en vivo) |
| Transferencia | monto en CUP (manual) |
| **Total recibido** | efectivo + divisa CUP + transferencia |
| Invertido | Σ cantidad × `precio_costo` |
| Ganancia | total recibido − invertido |

En fase 3 se comparan **Total ventas vs Total recibido** (la diferencia se muestra, no bloquea).

## Excel — 3 hojas

1. **Resumen**: dinero total registrado en la semana (desglosado: efectivo / divisa USD+EUR+CUP / transferencia), dinero invertido (semanal), ganancia (semanal)
2. **Arqueo**: denominaciones (patrón existente)
3. **Ventas**: producto, cantidad, precio venta, subtotal, costo, invertido

---

## PRs (orden de merge 1 → 8)

| # | PR | Contenido | Archivos | Dueño | Depende |
|---|---|---|---|---|---|
| 1 | Modelo + arqueo compartido | Modelo `PalmarRecord` (con divisa, transferencia, invertido, ganancia) + `arqueo-billetes-form` extraído de app-nav + refactor app-nav | `models/palmar-jornada.ts`, `models/index.ts`, `components/arqueo-billetes-form/*`, `components/layout/app-nav.component.{ts,html,spec.ts}` | **A** | — |
| 2 | Excel 3 hojas | `generarExcelPalmar(record, resumenSemana)` | `services/excel.service.ts`, `services/excel.service.spec.ts` | **B** | — |
| 3 | IPC electron | Canales `file:savePalmar` / `file:listPalmar` / `file:readPalmar` (validación + sufijo en main) | `electron/main.ts`, `electron/main.spec.ts`, `electron/preload.ts`, `electron/preload.spec.ts`, `electron/types.d.ts` | **B** | PR1 (tipos del modelo) |
| 4 | ElectronFileService | `savePalmar` / `listPalmar` / `readPalmar` gated por presencia de `electronAPI` + Blob fallback | `services/electron-file.service.ts`, `services/electron-file.service.spec.ts` | **B** | PR3 |
| 5 | Page base + historial | Ruta `/palmar` + links nav + botón "Registrar jornada palmar" + lista de jornadas previas (vacía hasta PR6) | `pages/palmar/*`, `app.routes.ts`, `components/layout/app-nav.component.html` | **A** | PR1 |
| 6 | PalmarService | Build de record (divisa CUP, total recibido, invertido, ganancia), historial/detalle/reimprimir, **acumulado semanal** | `services/palmar.service.ts`, `services/palmar.service.spec.ts` | **B** | PR2 + PR4 |
| 7 | Modal 3 fases | State machine, fase 1 productos, fase 2 arqueo (componente compartido), fase 3 confirmación con USD/EUR/tasas/transferencia | `components/palmar-jornada-modal/*` | **A** | PR5 |
| 8 | Integración E2E | page ↔ modal ↔ service: confirm → save → refresh; ver detalle; reimprimir | `pages/palmar/*` (integración) | **A** | PR6 + PR7 |

## Secuencia de trabajo por persona

**Pana A**: PR1 → PR5 → PR7 → PR8
**Pana B**: PR2 → PR3 → PR4 → PR6

- A arranca PR1; B arranca PR2 (independientes).
- B basa su rama de PR3 en la rama de PR1 apenas exista (necesita los tipos del modelo).
- A implementa PR5 contra la **firma** de `listPalmar` (mock en spec) — no espera el cuerpo.
- PR8 (integración) es el único punto de juntada de ambas cadenas.

## Contratos entre A y B (firmas estables — definir PRIMERO)

Trabajás contra la firma del otro, no contra su código. Cada spec mockea el servicio ajeno.

```ts
// B define (PR4, sobre PR3): ElectronFileService
listPalmar(): Promise<PalmarHistoryEntry[]>
readPalmar(fileName: string): Promise<ReadPalmarResult>
savePalmar(baseName: string, base64: string, json?: PalmarRecord): Promise<SavePalmarResult>

// B define (PR2): ExcelService
generarExcelPalmar(record: PalmarRecord, resumenSemana: PalmarSemanaResumen): string // base64

// A define (PR1): models
interface PalmarProductoEntry { nombre: string; cantidad: number; precio_venta: number; precio_costo: number; subtotal: number; costo_subtotal: number; }
interface PalmarDivisa { usd: number; eur: number; tasa_usd: number; tasa_eur: number; usd_cup: number; eur_cup: number; divisa_cup: number; }
interface PalmarRecord {
  version: 1; id: string; fecha: string; created_at: string; usuario: string | null;
  productos: PalmarProductoEntry[]; arqueo: ArqueoCajaEntry[];
  divisa: PalmarDivisa; transferencia: number;
  total_ventas: number; total_arqueo: number; total_recibido: number; invertido: number; ganancia: number; diferencia: number;
}
interface PalmarSemanaResumen { semanaInicio: string; semanaFin: string; totalRecibido: number; efectivo: number; divisaCup: number; transferencia: number; invertido: number; ganancia: number; }

// B define (PR6): PalmarService
cargarHistorial(): Promise<PalmarHistoryEntry[]>
verDetalle(fileName: string): Promise<PalmarRecord>
volverAImprimir(fileName: string): Promise<SavePalmarResult>
cargarResumenSemanal(fecha: string): Promise<PalmarSemanaResumen>
```

## IPC (PR3)

| Canal | Payload | Resultado |
|---|---|---|
| `file:savePalmar` | `{ baseName: 'dd-mm-yyyy', base64, json? }` (json omitido en reprint) | `{ ok, xlsxPath?, jsonPath?, error? }` |
| `file:listPalmar` | — | `{ ok, records?: PalmarHistoryEntry[], error? }` |
| `file:readPalmar` | `{ fileName }` (basename, termina en `.json`) | `{ ok, record?: PalmarRecord, error? }` |

- Main valida payloads (IPC = no confiable): `baseName` con `/^\d{2}-\d{2}-\d{4}$/`, `fileName` basename puro (sin path traversal).
- Main es dueño del filesystem y del sufijo (el renderer nunca decide rutas finales).
- Handlers nunca lanzan excepción: errores como `{ ok: false, error }`.
- Registrar en `VALID_INVOKE_CHANNELS` + tipar en `electron/types.d.ts`.

## Definición de done por PR

- [ ] Tests verdes (`ng test` para Angular, `bunx vitest run --config vitest.electron.config.ts` para electron)
- [ ] Lint limpio (`ng lint`)
- [ ] Sin regresión: PR1 mantiene verde `app-nav.component.spec.ts` (arqueo del cierre de jornada)
- [ ] PR6: test de cero-DB-writes (spy sobre `DATABASE`: exactamente UNA llamada SQL = `listar()`, sin INSERT/UPDATE/DELETE)
- [ ] Commit por unidad de trabajo (tests con el código que verifican)

## Fuera de scope (para futuras iteraciones)

- Configuración del layout del Excel (hojas fijas por ahora)
- Descuentos / conciliación de diferencias
- Editar / borrar registros
- Reportes o agregaciones fuera del resumen semanal

## Estado de avance

| PR | Dueño | Estado |
|---|---|---|
| 1 | A | ⬜ Sin empezar |
| 2 | B | ⬜ Sin empezar |
| 3 | B | ⬜ Sin empezar |
| 4 | B | ⬜ Sin empezar |
| 5 | A | ⬜ Sin empezar |
| 6 | B | ⬜ Sin empezar |
| 7 | A | ⬜ Sin empezar |
| 8 | A | ⬜ Sin empezar |
