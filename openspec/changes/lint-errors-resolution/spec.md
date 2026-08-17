# Spec: lint-corrections — Eliminar deuda de lint (BACKLOG-11)

## About this spec

Delta spec de refactor puro: la propuesta declara **cero New/Modified Capabilities**. No hay cambios de comportamiento observable. Los únicos cambios que afectan DOM son atributos a11y (`for`/`id`, `tabindex`, `(keydown)`, `role`/`aria`) — la suite de tests NO los detecta: se verifican visualmente (AC4).

## Behavior Preservation Guarantee

- NO hay cambios de runtime behavior: cero ediciones de control-flow, datos o lógica de negocio.
- Los únicos cambios DOM son atributos a11y aditivos.
- `eqeqeq` (`!=` → `!==`): semántica verificada en exploración (`vuelto()` es `computed<number|null>`, `precio_costo` es `number|null` → equivalentes).

## Requirements

### FR-1: Cero errores de lint

`bun run lint` DEBE reportar **0 errores / 0 warnings** en `src/**` (TS + templates HTML).

#### Scenario: Lint limpio

- GIVEN la rama `lint-corrections` con todos los fixes aplicados
- WHEN se ejecuta `bun run lint`
- THEN exit code 0
- AND 0 problemas reportados (0 errors, 0 warnings)

### FR-2: Tipar en lugar de suprimir

Los 53 `no-explicit-any` DEBEN eliminarse tipando con modelos existentes (`Venta`, `VentaConDetalles`, `ProductoInfo`, `ActivatedRouteSnapshot`/`RouterStateSnapshot`, `as unknown as T` para acceso privado en tests). NO DEBEN agregarse comentarios `eslint-disable` nuevos, con UNA excepción verificada: `electron-file.service.ts:1` (`triple-slash-reference`).

#### Scenario: La excepción triple-slash está justificada

- GIVEN `electron-file.service.ts` con la referencia triple-slash
- WHEN se intenta el reemplazo `import '../../../electron/types'` (verificado en spec phase)
- THEN `bun run build` falla ("Could not resolve `../../../electron/types`", esbuild no resuelve .d.ts aislado)
- AND `bun run electron:ts` pasa (no compila `src/`)
- AND sin referencia alguna el build falla con TS2339 (`window.electronAPI`) + TS2304 (tipos `Db*`)
- THEREFORE el triple-slash es load-bearing → se conserva con un único `eslint-disable-next-line @typescript-eslint/triple-slash-reference`

#### Scenario: Sin disables nuevos salvo la excepción

- GIVEN el diff completo del cambio
- WHEN se buscan comentarios `eslint-disable`
- THEN como máximo 1 (electron-file.service.ts:1)
- AND los restantes 120 errores se resuelven con tipos/atributos reales

### FR-3: Tests verdes

La suite completa DEBE seguir verde tras el refactor. Baseline registrado en esta rama (main `981be23`): **783 passed / 783, 45 archivos** (`bun run test -- --watch=false`). El conteo exacto final se registra en verify.

#### Scenario: Suite completa verde

- GIVEN los fixes aplicados
- WHEN se ejecuta la suite completa
- THEN 0 fallos (≥ 783 tests, sin tests nuevos ni modificados)

### FR-4: Sin scope creep

Corregir `no-unused-vars` NO DEBE agregar assertions faltantes ni cambiar semántica de tests. Si un unused var revela una assertion genuinamente faltante → marcar WARN-1, NO agregar el comportamiento.

#### Scenario: Unused removido sin cambio de semántica

- GIVEN un spec con import/var muerta
- WHEN se elimina el binding muerto
- THEN el diff solo remueve declaraciones
- AND no se agregan ni modifican assertions

### FR-5: a11y

- Todo fix `label-has-associated-control` DEBE asociar label→control vía `for`+`id` (o anidamiento). En `@for`, los ids DEBEN ser únicos por iteración usando `[attr.id]` con el id del item.
- Todo handler `(click)` DEBE tener equivalente de teclado (`(keydown)`) + focusabilidad (`tabindex`), replicando el patrón in-repo `checkout-modal` (`role="dialog"` + `tabindex` + `(keydown)`).
- Aplica a: inventario, checkout-modal, cobro-pendiente-modal, producto, quantity-input, app-nav.

#### Scenario: Label asociado (estático)

- GIVEN un `<label>` sin `for`
- WHEN se agrega `for` + `id`
- THEN el label queda asociado a su control

#### Scenario: Ids únicos en @for

- GIVEN form dentro de `@for` (inventario edit-form, producto merma)
- WHEN se agregan ids dinámicos
- THEN cada iteración tiene id único basado en el item id

#### Scenario: Click con equivalente de teclado

- GIVEN un elemento interactivo con `(click)` (quantity-input backdrop, modal inventario, fila cobro-pendiente)
- WHEN se agrega `tabindex` + `(keydown)`
- THEN el elemento es focusable y operable por teclado

## Acceptance Criteria

- [ ] AC1: `bun run lint` → 0 errores / 0 warnings (exit 0)
- [ ] AC2: `bun run test -- --watch=false` → suite completa verde (baseline 783/783)
- [ ] AC3: 0 `eslint-disable` nuevos salvo la única excepción permitida (electron-file.service.ts:1)
- [ ] AC4: Smoke visual: checkout-modal, inventario, producto, cobro-pendiente-modal, quantity-input, app-nav — labels asociados, ids únicos, modales/filas focusables y operables por teclado
- [ ] AC5: `bun run build` (web) OK
- [ ] AC6: `bun run electron:ts` OK
- [ ] AC7: Sin cambios en `eslint.config.js` ni `angular.json`
- [ ] AC8: Sin assertions agregadas/modificadas ni semántica de tests alterada

## Warnings

- **WARN-1**: Si un `no-unused-vars` destapa una assertion faltante real → PARAR y reportar; NO agregar la assertion. Verificado hoy: ninguno (login ya tiene assertion, pos ya limpio).
- **WARN-2**: `electron-file.service.spec.ts:147` — el spy `createElement` es load-bearing para el mock; no eliminar la línea, solo quitar el binding `const` muerto.
- **WARN-3**: El build web emite warning de bundle budget (702 kB > 500 kB, BACKLOG-8) — preexistente y fuera de alcance; no confundir con fallo.

## Baseline (registrado en esta rama = main `981be23`)

| Check | Resultado |
|-------|-----------|
| `bun run lint` | 121 errores / 0 warnings (21 archivos, 3 auto-fixables) |
| `bun run test -- --watch=false` | 783 passed / 783 (45 archivos) |
| `bun run build` | GREEN (702 kB initial — warning budget BACKLOG-8) |
| `bun run electron:ts` | GREEN |
