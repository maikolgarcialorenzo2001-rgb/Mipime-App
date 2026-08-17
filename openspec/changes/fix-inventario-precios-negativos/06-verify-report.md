# Verify Report: fix-inventario-precios-negativos

## Status

**SUCCESS** — R1–R7 implementados y verificados. Suite completa verde (865 tests, 46 files). 4 commits en rama `fix-inventario-bugs`.

## Resultado de tests

| Ejecución | Resultado | Notas |
|-----------|-----------|-------|
| Baseline (antes de tocar código) | 141/141 (3 specs tocadas) | 80 stock + 14 producto + 47 inventario |
| `stock-movimiento.service.spec.ts` | 88/88 | +8 tests (R1, R2) |
| `producto.service.spec.ts` | 22/22 | +8 tests (R3) |
| `inventario.page.spec.ts` | 55/55 | +8 tests (R4, R5, R6) |
| **Specs tocadas (conjunto)** | **165/165** | baseline 141 → +24 tests, 0 rotos |
| **Suite completa `npx vitest run`** | **865/865 (46 files)** | sin regresiones fuera de alcance |

Lint: `npx eslint` sobre los 6 archivos tocados → 0 errores nuevos. Error pre-existente no tocado: `Array<T>` en `stock-movimiento.service.ts:717` (existía en baseline línea 692). `ng lint` no ejecutable por Node v24.14.0 < v24.15.0 requerido (quirk de infra conocido, no relacionado al cambio).

## Requisitos verificados

- [x] **R1** `registrarEntrada` rechaza `precioCosto < 0` y NaN ('El costo no puede ser negativo'), tras `_checkAdmin`, sin tocar DB (`sql` no llamado); costo 0 aceptado y persistido.
- [x] **R2** `registrarEditar` rechaza `precioVenta`/`precioCosto` < 0 y NaN (mensajes espejo), sin tocar DB; 0/0 aceptado y persistido.
- [x] **R3** `producto.crear`/`actualizar` rechazan precios < 0 y NaN vía `throwError` antes del INSERT/UPDATE; 0/0 aceptado.
- [x] **R4** `guardarProducto` bloquea costo/pv negativos con `formError` y `return` sin llamar `crear`; 0 procede.
- [x] **R5** case 'editar' bloquea pv/pc negativos con `error` y `return` sin llamar `registrarEditar`; 0 procede.
- [x] **R6** case 'entrada' bloquea costo negativo con `error` y `return` sin llamar `registrarEntrada`; vacío mapea a 0 y procede.
- [x] **R7** `0` y `null` válidos: guards `!(v >= 0)` (NaN-safe; `null >= 0` es true en JS → null pasa); happy paths cubiertos en los 6 flujos.
- [x] Sin tocar: DB CHECK (migración), saneamiento legacy, F1–F3, F5–F9, `registrarSalida/Traslado/Merma/Ajuste`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| T1/T2 (R1+R2 stock) | `stock-movimiento.service.spec.ts` | Unit | ✅ 141/141 | ✅ 6 failed | ✅ 88/88 | ✅ 8 casos (neg ×4, NaN ×4... 8 = 2 neg + 2 NaN entrada; 2 neg + 2 NaN editar + happy 0 ×2) | ➖ None needed |
| T3 (R3 producto) | `producto.service.spec.ts` | Unit | ✅ 88/88 stock | ✅ 6 failed | ✅ 22/22 | ✅ 8 casos (3 neg/NaN crear + happy 0; 3 neg/NaN actualizar + happy 0) | ➖ None needed |
| T4 (R4-R6 UI) | `inventario.page.spec.ts` | Unit | ✅ 165/165 previos | ✅ 5 failed | ✅ 55/55 | ✅ 8 casos (2 entrada + 3 modal + 3 editar, happy 0 incluido) | ➖ None needed |

Corrección de mock en TDD: el happy path de `registrarEditar` exigió mockear la fila del `SELECT SUM` (`[{ total }]`), patrón idéntico a los tests de atomicidad existentes — mock completado ANTES del GREEN.

## Commits

| Commit | Descripción |
|--------|-------------|
| `1f8979e` | test(stock): guards de precio/costo no negativo en entrada y edicion (RED) |
| `4f5147c` | fix(stock): validar precio/costo no negativo en registrarEntrada y registrarEditar |
| `73ac396` | fix(producto): validar precios no negativos en crear y actualizar |
| `bfcd3cb` | fix(inventario): bloquear precios/costos negativos en UI (modal, edicion, entrada) |

## Riesgos / notas

- Error de lint pre-existente no relacionado: `Array<T>` en `stock-movimiento.service.ts:717` (baseline:692).
- `ng lint` bloqueado por Node v24.14.0 (requiere ≥ 24.15.0) — infra, no del cambio.
- Datos legacy negativos NO se sanean (por diseño); la validación fuerza el fix al editar.
