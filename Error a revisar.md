# Error a revisar — `setup.service.spec.ts`

> Pendiente documentado el 2026-09-03 para resolver en otro momento.
> No es bloqueante: no rompe la compilación del runner, no afecta la app,
> no toca el feature de Linux. Solo deja el suite global de tests sin "verde" total.

## Archivo afectado

- `src/app/services/setup.service.spec.ts`

## Síntoma

El runner global de tests (`bun run test`) lo marca como **Failed Suite (0 test)**, es decir, el archivo entero se descarta antes de correr sus pruebas.

```
Test Files: 51 passed | 1 failed | 1 skipped (53)
```

## Error exacto

```
Error: The "vi.mock" and related methods are not supported for relative imports
with the Angular unit-test system. Please use Angular TestBed for mocking dependencies.
```

## Causa raíz

La línea 19-21 del spec usa `vi.mock()` sobre un import **relativo**:

```ts
vi.mock('./db-migrations', () => ({
  seedProductosSiVacio: vi.fn().mockResolvedValue(undefined),
}));
```

`setup.service.ts` (producción) hace `import { seedProductosSiVacio } from './db-migrations'` (import estático, línea 4)
y la llama con `await seedProductosSiVacio(this._db)` en `createInitialAdmin()` (línea 68).

El sistema unit-test de Angular **bloquea** `vi.mock()` para imports relativos del propio proyecto.
`vi.mock()` solo se soporta para paquetes externos; para dependencias del proyecto hay que usar TestBed.

## Qué hay que arreglar

Reemplazar el mecanismo de mock de `seedProductosSiVacio` por una estrategia compatible
con el runner unit-test de Angular **sin tocar producción** (`setup.service.ts`, `db-migrations.ts`).

Nota técnica: `seedProductosSiVacio` es un import **estático** (no inyectado por DI), por eso el mock
es engorroso. Evaluar alguna de estas opciones (verificando que las aserciones de `sql()` sigan valiendo):

1. Espiar el módulo vía `await import('./db-migrations')` + `vi.spyOn` (⚠️ puede no interceptar el binding estático ya capturado — verificar de verdad).
2. Restructurar el spec para que el test no dependa de controlar `seedProductosSiVacio`.
3. Como último recurso (y solo si no hay alternativa limpia): agregar un test seam mínimo en producción
   (p. ej. parámetro inyectable con default) — **pero preferir siempre la solución test-only**.

## Riesgos al arreglarlo

- **Falso positivo**: si se arregla con `as any` o mocks mal tipeados, el test "pasa" pero deja de validar
  lo que dice. Ya pasó tentación de esto en otros specs (casts en `setup.guard.spec.ts`).
- **Aserciones estrictas**: el spec usa `mockDb.sql.toHaveBeenNthCalledWith(...)` verificando el ORDEN exacto
  de las queries de `createInitialAdmin()`. Si `seedProductosSiVacio` ejecuta queries reales contra el mockDB,
  puede corromper esas aserciones.
- **Cero riesgo de producción si el fix es test-only** (no tocar `setup.service.ts` ni `db-migrations.ts`).

## Tests que cubre el archivo (NO perder al arreglar)

- `countUsers` (2 tests)
- `getConfig` (2 tests)
- `setConfig` (1 test)
- `createInitialAdmin` (3 tests: seed true / seed false / "throws when users exist")

## Referencia: patrón correcto que ya funciona

La referencia de patrón correcto (TestBed + mocks tipados explícitos, sin `vi.mock` de imports
relativos) son los 4 specs que ya se arreglaron en el commit `09a0a0c`:
`setup.guard.spec.ts`, `admin.page.spec.ts`, `setup.page.spec.ts`, `setup.page.integration.spec.ts`.
Usar ese estilo: tipar los mocks con `ReturnType<typeof vi.fn>` y/o cast explícito, y evitar
`vi.mock()` sobre paths relativos.

## Estado

- [ ] Pendiente de arreglar
- [ ] Sin impacto en producción ni en el feature de Linux
