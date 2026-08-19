# Exploración de Código — Issues Preexistentes

> **Fecha**: 2026-08-18
> **Branch**: `main` (sincronizado con `origin/main`)
> **Metodología**: Exploración exhaustiva automatizada (10 categorías, 51 archivos .ts, 47 spec files)
> **Stack**: Angular 21 (standalone) + Tailwind 4 + SQLocal (SQLite WASM) + Signals + Vitest

---

## Resumen Ejecutivo

| Severidad | Count | Temas clave |
|-----------|-------|-------------|
| **S1 Crítico** | 4 | Password hashing débil, credenciales hardcodeadas, errores tragados en DB |
| **S2 Alto** | 9 | Subscriptions sin cleanup, sin OnPush, race conditions, SQL raw en pages |
| **S3 Medio** | 14 | Copy-paste, archivos god-object (640-1030 líneas), DOM en services |
| **S4 Bajo** | 8 | Magic numbers, naming inconsistente, tests faltantes |

**Total: 35 issues encontrados**

---

## S1 — Crítico (data loss, seguridad, corrupción)

### S1-1: Password hashing usa SHA-256 + salt (single iteration)
- **Archivo**: `src/app/services/hash-password.ts`
- **Problema**: SHA-256 es un hash rápido diseñado para integridad, no para almacenamiento de passwords. Un single-iteration SHA-256+salt es trivialmente brute-forceable con GPUs modernas. El estándar actual es bcrypt/scrypt/argon2id.
- **Riesgo**: Si la SQLite DB es exfiltrada, las passwords se crackean en segundos.
- **Fix sugerido**: Reemplazar con bcrypt o argon2id.

### S1-2: Credenciales admin hardcodeadas en environment files
- **Archivo**: `src/app/environments/environment.prod.ts` (`adminPassword: 'softwarez'`)
- **Archivo**: `src/app/environments/environment.ts` (`adminPassword: 'admin123'`)
- **Problema**: passwords de admin backdoor están committeadas en source. Cualquiera con acceso al repo puede impersonar admin.
- **Fix sugerido**: Inyectar en deploy time o detrás de un setup flow, nunca en source.

### S1-3: ROLLBACK error tragado en native-sqlite
- **Archivo**: `src/app/services/native-sqlite.service.ts:83`
- **Código**: `await this.sql('ROLLBACK').catch(() => undefined);`
- **Problema**: Si ROLLBACK falla (I/O error, DB corruption), el failure se traga silenciosamente. El caller no sabe que el estado de la transacción es inconsistente.
- **Fix sugerido**: Loguear el error al mínimo, idealmente trigger reconexión o estado fatal.

### S1-4: File deletion error tragado en excel.service
- **Archivo**: `src/app/services/excel.service.ts:116`
- **Código**: `.catch(() => undefined)`
- **Problema**: Archivos temporales de Excel se borran con supresión de errores. En Electron, esto puede filtrar disco silenciosamente o dejar temp files con datos financieros sensibles.
- **Fix sugerido**: Loguear el error; en Electron, programar limpieza retry.

---

## S2 — Alto (confiabilidad, correctitud, integridad de datos)

### S2-1: 30 llamadas a setTimeout, solo 8 tienen clearTimeout match
- **Archivos**: `pos.page.ts` (3 uncleaned), `app-nav.component.ts` (3 uncleaned), `quantity-input.component.ts` (2 uncleaned), `cobro-pendiente-modal.component.ts` (1 uncleaned), `historial.page.ts` (1 uncleaned), `jornada.page.ts` (1 uncleaned)
- **Problema**: La mayoría de componentes NO implementan `OnDestroy` ni usan `DestroyRef`. Timers como `setTimeout(() => this.soloNumeros.set(false), 1800)` disparan después de destrucción del componente.
- **Fix sugerido**: Agregar `DestroyRef` + cleanup en todos los componentes con timers.

### S2-2: Zero componentes usan ChangeDetectionStrategy.OnPush
- **Archivos**: Todos los 23 componentes.
- **Problema**: Cada componente ejecuta change detection en cada browser event (clicks, keystrokes, scroll, timer). Con signals, OnPush daría boost significativo, especialmente en POS (product grid + cart + search + keyboard navigation).
- **Fix sugerido**: Agregar `changeDetection: ChangeDetectionStrategy.OnPush` progresivamente.

### S2-3: jornada.page.ts bypassa la service layer con SQL raw
- **Archivo**: `src/app/pages/jornada/jornada.page.ts:86-117`
- **Problema**: La page inyecta `DATABASE` directamente y corre SQL queries raw (`SELECT * FROM ventas WHERE jornada_id = ?`). Esto bypassa `VentaService`, `StockMovimientoService`, etc.
- **Fix sugerido**: Crear un método en el servicio dedicado en vez de SQL directo.

### S2-4: Race condition en pos.page.ts `_buscar()` — sin request cancellation
- **Archivo**: `src/app/pages/pos/pos.page.ts:283-307`
- **Problema**: Keystrokes rápidos disparan múltiples llamadas `_buscar()`. Hay debounce de 200ms pero sin cancellation de Observable. Si un request lento resuelve después de uno nuevo, `this.resultados.set(productos)` sobreescribe resultados nuevos con datos stale.
- **Fix sugerido**: Usar `switchMap` o `unsubscribe` previo.

### S2-5: producto.page.ts subscribe sin cleanup
- **Archivo**: `src/app/pages/productos/producto.page.ts:113, 137, 152, 156`
- **Problema**: Cuatro llamadas `subscribe()` sin `takeUntilDestroyed()` ni `DestroyRef`. Si se navega away mientras requests están in-flight, los callbacks disparan en componente destruido.
- **Fix sugerido**: `takeUntilDestroyed()` en cada subscription.

### S2-6: historial.page.ts subscribe sin cleanup
- **Archivo**: `src/app/pages/historial/historial.page.ts:249, 262, 351`
- **Problema**: Tres subscriptions sin cleanup de lifecycle. `verPreview()` subscribe a `obtenerDatosJornada` y el callback setea signals en componente potencialmente destruido.
- **Fix sugerido**: `takeUntilDestroyed()` en cada subscription.

### S2-7: app-nav.component.ts subscribe sin cleanup
- **Archivo**: `src/app/components/layout/app-nav.component.ts:116, 173, 224`
- **Problema**: `confirmarApertura()`, `confirmarCierre()`, y `_descargarExcel()` subscribe sin cleanup. El nav es long-lived (presente en cada page) así que el riesgo es menor, pero no es ideal.
- **Fix sugerido**: `takeUntilDestroyed()` por consistencia.

### S2-8: 2 componentes sin spec files
- **Archivos**: `loading-spinner.component.ts`, `quantity-input.component.ts` — sin spec.
- **Problema**: 15 componentes, solo 13 tienen spec files. 2 sin tests.
- **Fix sugerido**: Agregar specs básicas.

### S2-9: inject(DATABASE) en jornada.page.ts rompe DI testability
- **Archivo**: `src/app/pages/jornada/jornada.page.ts:25`
- **Problema**: Inyección directa del token `DATABASE` en un page component rompe la abstracción de service layer.
- **Fix sugerido**: Mover a un servicio dedicado.

---

## S3 — Medio (code smells, tech debt, mantenibilidad)

### S3-1: Tres implementaciones casi idénticas de `filtrarTecla()`
- **Archivos**: `app-nav.component.ts:199`, `jornada.page.ts:145`, `quantity-input.component.ts:47`
- **Problema**: Copy-paste de filter de teclado numérico. Debería ser una directiva compartida o función utilitaria.

### S3-2: Tres patrones casi idénticos de debounce `soloNumeros`
- **Archivos**: Los mismos tres archivos.
- **Problema**: `setTimeout(() => this.soloNumeros.set(false), 1800)` duplicado tres veces con el mismo magic number `1800`.

### S3-3: Lógica divisa/vuelto duplicada entre checkout-modal y cobro-pendiente-modal
- **Archivos**: `checkout-modal.component.ts:54-104`, `cobro-pendiente-modal.component.ts:88-147`
- **Problema**: `vuelto`, `falta`, `pagoSuficiente`, `errorCompletacion`, `estimadoDivisa`, `saldoInsuficienteVuelto`, `formularioValidoConSaldo` son computed properties esencialmente idénticas copy-pasteadas.
- **Fix sugerido**: Extraer a un computed factory o clase base compartida.

### S3-4: excel.service.ts tiene 1030 líneas
- **Archivo**: `src/app/services/excel.service.ts`
- **Problema**: Archivo más grande del codebase. Contiene lazy-loaded xlsx, report generation, workbook building, file cleanup.
- **Fix sugerido**: Dividir en report-generation, workbook-builder, y export-service.

### S3-5: jornada.service.ts tiene 878 líneas
- **Archivo**: `src/app/services/jornada.service.ts`
- **Problema**: Segundo más grande. Combina state management, CRUD, report generation, y export logic.

### S3-6: stock-movimiento.service.ts tiene 809 líneas
- **Archivo**: `src/app/services/stock-movimiento.service.ts`
- **Problema**: Tercero más grande. FIFO stock management complejo pero en un solo servicio.

### S3-7: db-migrations.ts tiene 697 líneas y crece
- **Archivo**: `src/app/services/db-migrations.ts`
- **Problema**: Todas las migraciones en un archivo. A medida que la app crece, se vuelve ingobernable.
- **Fix sugerido**: Migrar a un framework de migraciones o al menos archivos separados por migración.

### S3-8: inventario.page.ts tiene 640 líneas — "God component"
- **Archivo**: `src/app/pages/inventario/inventario.page.ts`
- **Problema**: Maneja CRUD de productos, stock movements (entrada/salida/ajuste/traslado/editar), history toggle, lot management, y delete confirmation — todo en un componente.
- **Fix sugerido**: Descomponer en sub-componentes.

### S3-9: Non-null assertions (`!`) en todo el codebase
- **Archivos**: `inventario.page.ts:535,539,551-553`, `pos.page.ts`, `producto.page.ts:190`, y muchos otros.
- **Problema**: Aunque el código valida antes de assert, `!` es un hazard de mantenimiento. Si la lógica de validación cambia, el assertion se convierte en mentira silenciosa.

### S3-10: @ts-ignore / eslint-disable para triple-slash reference
- **Archivo**: `src/app/services/electron-file.service.ts:1`
- **Problema**: Usa `// @ts-ignore` para `/// <reference types="electron" />`. Debería usar type import proper o declaration merging.

### S3-11: `any` types en spec files (6 ocurrencias en `src/app`)
- **Archivos**: Varios `.spec.ts`
- **Problema**: Aunque la lint rule es `error` para producción, 6 spec files aún usan `any`. Baja prioridad pero señal de calidad de tests.
- **Nota**: Solapa parcialmente con BACKLOG-11 (lint errors).

### S3-12: `document.createElement('a')` para file download
- **Archivos**: `backup.service.ts:~65`, `electron-file.service.ts:~98`
- **Problema**: Manipulación manual de DOM para triggers de download. Debería usar un approach más portátil o extraer a utilidad compartida.

### S3-13: `DOMContentLoaded` y DOM queries directas en services
- **Archivos**: `backup.service.ts`, `electron-file.service.ts`, `theme.service.ts`
- **Problema**: Services consultando DOM directamente (`document.documentElement.classList`, `document.createElement`). Los services deberían ser platform-agnostic; el DOM work pertenece a components o utility services dedicados.

### S3-14: `main.ts` usa `innerHTML` para bootstrap error
- **Archivo**: `src/main.ts:18`
- **Problema**: `document.body.innerHTML = ...` es un vector de XSS si el error message alguna vez incluye datos controlados por el usuario. Actualmente seguro (string estático), pero frágil.

---

## S4 — Bajo (estilo, mejoras menores, sugerencias)

### S4-1: 47 spec files existen pero la calidad de tests es desconocida
- **Problema**: El count de specs es alto (47 archivos), lo cual es positivo. Sin embargo, muchos probablemente contienen tests boilerplate `should create`. No se encontraron tests saltados (`xit`, `xdescribe`) — lo cual es bueno.

### S4-2: Sin issues de `trackBy`
- **Problema**: Todos los loops `@for` usan la syntax Angular 17+ `track` correctamente. No se encontraron issues.

### S4-3: Sin comentarios TODO/FIXME/HACK/WORKAROUND
- **Problema**: Cero instancias de estos markers en código de producción. O el equipo no los usa, o el codebase está bien mantenido en este aspecto.

### S4-4: Accesibilidad HTML es decente pero incompleta
- **Hallazgos**: 16 atributos `aria-label`/`aria-labelledby`/`role` encontrados en templates. Dialogs tienen `role="dialog"`. Botones de cart item tienen `aria-label`. Sin embargo, muchos botones en templates (especialmente inventario, historial, productos) probablemente carecen de labels accesibles.

### S4-5: `elegirLoteInicialEdicion` está exportado desde un page component file
- **Archivo**: `src/app/pages/inventario/inventario.page.ts:629`
- **Problema**: Una función pura utilitaria está definida y exportada al final de un archivo de componente. Debería estar en una utilidad compartida.

### S4-6: Magic numbers
- **Archivos**: Múltiples — `150` (loading delay en pos), `200` (debounce en pos), `300` (debounce en productos), `1800` (soloNumeros timeout, 3 lugares), `2000` (success toast), `2500` (toast), `4000` (error auto-dismiss), `200 * (intento + 1)` (retry backoff).
- **Problema**: Todos hardcodeados. Deberían ser named constants.

### S4-7: `Procesando` vs `registrando` vs `loading` — naming inconsistente
- **Archivos**: `inventario.page.ts` usa `procesando` y `procesandoMovimiento`; `jornada.page.ts` usa `registrando`; `historial.page.ts` usa `loading`; `pos.page.ts` usa `buscando`.
- **Problema**: El mismo concepto (flag de async-in-progress) tiene cinco nombres diferentes. Debería estandarizarse.

### S4-8: Sin `provideAnimations()` visible
- **Archivo**: `src/app/app.config.ts`
- **Problema**: Angular 19+ standalone apps necesitan `provideAnimations()` para animations. Si no se usan animations, esto está bien.

---

## Top 5 Acciones Recomendadas (Prioridad)

1. **Reemplazar SHA-256 con bcrypt/argon2 para passwords** (S1-1) — seguridad crítica
2. **Remover credenciales admin hardcodeadas de source** (S1-2) — seguridad crítica
3. **Agregar `DestroyRef` / `takeUntilDestroyed` a todos los componentes con subscriptions** (S2-1, S2-5, S2-6, S2-7) — memory leaks
4. **Extraer lógica divisa/vuelto duplicada a utilidad compartida** (S3-3) — DRY
5. **Descomponer `inventario.page.ts` (640 líneas) en sub-componentes** (S3-8) — mantenibilidad

---

## Notas Metodológicas

- Exploración realizada con `explore` agent en modo "very thorough"
- Categorías: Type Safety, Error Handling, Code Smells, Performance, Security, Angular Anti-patterns, Testing Gaps, Build & Config, Missing Features, UX/Accessibility
- Se descartaron positivos: todos los `@for` usan `track`, sin TODO/FIXME, sin skipped tests
- Archivos de referencia: `todo-mipime.md` (backlog existente), `docs/Fix-Inventario-Bugs.md`, `docs/investigacion-edicion-producto.md`
