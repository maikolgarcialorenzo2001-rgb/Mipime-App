# Spec: login-page-cierre-bug — Eliminar parámetro muerto `saldoReal`

## About this spec
Refactor puro — sin cambios de comportamiento. Se elimina el parámetro `saldoReal` de `jornadaService.cerrar()` porque `_ejecutarCierre()` lo recalcula desde datos fuente y lo ignora por completo.

## Functional Requirements

### FR-1: Firma sin `saldoReal`

`jornadaService.cerrar()` DEBE cambiar su firma de `cerrar(id: number, saldoReal: number, userId: number, arqueo?: ArqueoCaja)` a `cerrar(id: number, userId: number, arqueo?: ArqueoCaja)`. `_cerrarAsync()` y `_ejecutarCierre()` DEBEN propagar el cambio.

#### Scenario: Cierre sin arqueo
- GIVEN una jornada abierta con id=1
- WHEN se llama `jornadaService.cerrar(1, uid)` sin arqueo
- THEN el cierre se ejecuta sin error y `saldo_real` se calcula internamente

#### Scenario: Cierre con arqueo
- GIVEN una jornada abierta con id=2
- WHEN se llama `jornadaService.cerrar(2, uid, arqueoData)`
- THEN el cierre incluye el arqueo y `saldo_real` se calcula internamente

### FR-2: login.page.ts actualizado

`login.page.ts` DEBE llamar `jornadaService.cerrar(j.id, uid)` eliminando el tercer argumento `saldo_esperado`.

#### Scenario: Login cierra jornada
- GIVEN el login detecta una jornada abierta de otro usuario
- WHEN se ejecuta el auto-cierre
- THEN `cerrar(j.id, uid)` se invoca sin `saldo_esperado`
- AND el cierre completa exitosamente

### FR-3: app-nav.component.ts actualizado

`app-nav.component.ts` DEBE llamar `jornadaService.cerrar(j.id, uid, entries)` eliminando `arqueoTotal` del segundo parámetro.

#### Scenario: App-nav cierra con arqueo
- GIVEN el usuario cierra jornada desde app-nav con arqueo cargado
- WHEN se confirma el cierre
- THEN `cerrar(j.id, uid, entries)` se invoca sin `arqueoTotal`
- AND el cierre incluye el arqueo correctamente

### FR-4: Tests actualizados

Todos los tests que llaman a `jornadaService.cerrar()` DEBEN usar la nueva firma sin `saldoReal`.

#### Scenario: Test unitario sin arqueo
- GIVEN un test que llama a `cerrar()` sin arqueo
- WHEN compila
- THEN no hay error de tipo por argumentos faltantes

#### Scenario: Test unitario con arqueo
- GIVEN un test que llama a `cerrar()` con arqueo mockeado
- WHEN compila
- THEN no hay error de tipo por argumentos faltantes

## Non-Functional Requirements

### NFR-1: Zero impacto en Excel y reportes
El Excel exportado NO DEBE verse afectado porque `_ejecutarCierre()` ya recalcula `saldoRealCalculado` sin usar el parámetro eliminado.

### NFR-2: Zero cambios en schema DB
La columna `jornadas.saldo_real` NO DEBE modificarse. Solo cambia la interfaz TypeScript.

## Regression Scenarios

| Escenario | Resultado esperado |
|-----------|--------------------|
| Cierre manual desde JornadaPage | Mismo comportamiento que antes |
| Auto-cierre al loguear otro usuario | Mismo comportamiento que antes |
| Cierre con arqueo desde app-nav | Mismo comportamiento que antes |
| Exportar Excel post-cierre | Mismos valores que antes |
