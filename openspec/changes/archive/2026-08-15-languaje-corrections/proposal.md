# Proposal: languaje-corrections — Lenguaje neutro hispano

## Intent

La app aspira a español neutro para cualquier hispanohablante. Hoy tiene ~85 rastros de lenguaje argentino: 11 strings voseo, capa de moneda con ARS/CUP/«pesos cubanos», y 2 errores («La acceso», «Error al registro»).

## Scope

### In Scope
- 11 strings voseo en UI (checkout, cobro-pendiente, historial, inventario, pos, db-error, main.ts).
- 2 errores: «La acceso»→«El acceso»; «Error al registro»→«Error al registrar».
- Moneda: pipe único `pesos` + `MONEDA_LOCAL`; reemplaza 46 `currency:'ARS'` en 9 templates.
- CUP/«pesos cubanos» visibles en excel.service.ts.
- 8 specs unit RED→GREEN + deltas openspec.
- Docs con argentinismos: según decisión 1.

### Out of Scope
- Valores de dominio: enum `forma_pago='divisas'`, nombres de variables/columnas.
- Denominaciones $1/$3 del arqueo (serie CUP): requieren configuración.
- Formatos de fecha (`es-AR` ya es panhispánico).
- Refactor ajeno a lenguaje.

## Capabilities

### New Capabilities
- `local-currency`: regla «moneda local = pesos genérico»; contrato del pipe `pesos` + `MONEDA_LOCAL` (sin ARS/CUP visible).

### Modified Capabilities
- `checkout`: textos del sub-form divisas y vuelto a neutro.
- `excel-reportes`: labels «Total CUP»/«pesos cubanos» a «pesos».

## Approach

1. **Moneda (decisión central): pipe único `pesos`** en `src/app/pipes/pesos.pipe.ts`, envuelve `currency` con `MONEDA_LOCAL` (constante en `core/constants.ts`, símbolo `$`). Una constante TS no se referencia en templates Angular; dejar ARS de facto mantiene la referencia argentina en 46 puntos.
2. **Voseo**: reemplazo string→string con imperativos neutros («Completá»→«Complete», «Seleccioná»→«Seleccione»).
3. **Excel**: «Total CUP»→«Total en pesos», «pesos cubanos»→«pesos»; sin tocar cálculo.
4. **Specs**: RED en 8 unit; GREEN con reemplazos.

## Affected Areas

- `pipes/pesos.pipe.ts`, `core/constants.ts` (New): pipe `pesos`, `MONEDA_LOCAL`.
- 9 templates `*.html` (Mod): 46 `currency:'ARS'` → `pesos`.
- Modales checkout/cobro-pendiente, pages inventario/historial/pos/jornada, ttl-expired, db-error, `main.ts` (Mod): voseo, «La acceso», «Contactá», «Error al registro».
- `services/excel.service.ts` (Mod): labels CUP/pesos.
- 8 specs `*.spec.ts` (Mod): assert de strings.
- Specs openspec checkout/excel-reportes + `local-currency` (Mod/New): deltas.

## Risks

- Specs de formato `currency` rompen tras el pipe (High) → pipe reutiliza locale/dígitos; suite completa.
- Labels Excel rompen consumo downstream (Low) → solo strings; valores intactos.
- Voseo fuera del inventario (Med) → grep de cierre de imperativos.
- Confundir enum `divisas` (DB) con UI (Med) → out-of-scope explícito.

## Rollback Plan

- Commits work-unit por área → revert independiente.
- Pipe aditivo: quitarlo y restaurar `currency:'ARS'` devuelve formato previo.
- Strings: git revert puntual; sin migración de datos.

## Dependencies

- Ninguna externa. Base: branch `languaje-corrections` sobre `main` (d2d60e2).

## Success Criteria

- [ ] 0 voseo rioplatense en `src/` (grep de cierre).
- [ ] 0 `currency:'ARS'` en templates.
- [ ] 0 CUP/«pesos cubanos» visibles.
- [ ] `bunx vitest run` en verde.

## Decisiones abiertas

1. **Docs** argentinismos: ¿scope o no-goal? Default: no-goal.
2. **`es-AR`** en fechas: mantener vs migrar a `es`. Default: mantener.
3. **`MONEDA_LOCAL`**: constante vs `environment`. Default: constante.
