# SDD — Tasks: `fix-reanudar-jornada-acceso`

> Artefacto de tareas (2026-08-08). Guardado también en Engram (`sdd/fix-reanudar-jornada-acceso/tasks`).
> Basado en: proposal (#488), spec (#489), design (#490). Deltas openspec ya creados en spec phase (no re-crear).

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas estimadas (adds+dels) | **~1200–1500** (est: service ~100, login ~80, excel ~35, specs ~1000+, purga auto-cierre ~-540) |
| Archivos tocados (sin docs) | **8** (4 prod + 4 spec) |
| Riesgo de presupuesto 400 líneas | **Alto** |
| PRs encadenados recomendados | **Sí** → 4 work units |
| Estrategia de entrega | `ask-on-risk` |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

### Work units sugeridas

| WU | Goal | Tareas | Líneas aprox. | Base sugerida |
|---|---|---|---|---|
| PR 1 | Query `obtenerAbierta()` sin fecha + regresión POS | 1.1–1.3 | ~140 | main / tracker |
| PR 2 | Login: modal para CUALQUIER usuario + `user_cierre` autenticado + fecha real | 2.1–2.3 | ~250 | branch PR 1 |
| PR 3 | Eliminar `autoCerrarSiOtroUsuario()` (purga método + bloque spec) | 3.1 | ~610 (mayoría deletions) | branch PR 2 |
| PR 4 | Excel "Abierta por / Cerrada por" + resolución en data layer | 4.1–4.4 | ~280 | branch PR 3 |

## Fase 1: Detección de jornada abierta (service) — FR-1, AC1, AC7

- [x] **1.1 (RED)** `jornada.service.spec.ts` — reescribir describe `obtenerAbierta` (L119+): assert query params `['abierta']` (1 solo, SIN fecha) y `ORDER BY fecha DESC, id DESC LIMIT 1`; casos: jornada de ayer → devuelve; múltiples huérfanas (07-08 vs 31-07) → la más reciente; sin abierta → `null`; error DB.
  - Verif RED fallando: `npx vitest run src/app/services/jornada.service.spec.ts` (asserts de query/params rojos).
- [x] **1.2 (GREEN)** `jornada.service.ts` — `obtenerAbierta()` L845-854: SQL `SELECT * FROM jornadas WHERE estado = ? ORDER BY fecha DESC, id DESC LIMIT 1` con `['abierta']` (firma intacta).
  - Verif: tests de 1.1 verdes. `grep "fecha = \?"` en method → sin match.
- [x] **1.3 (GREEN regresión)** `pos.page.spec.ts` — NUEVO: mock `obtenerAbierta()` → jornada con `fecha` previa (`2026-08-07`); expect `sinJornada=false` y pendientes habilitados. SIN tocar `pos.page.ts` (NFR spec).
  - Verif: spec verde; `pos.page.ts` sin diff.
- commit propuesto PR1: `fix(jornada): detectar jornada abierta previa sin filtro de fecha`

## Fase 2: Login — modal para cualquier usuario + cierre autenticado — FR-2/3/4

- [x] **2.1 (RED)** `login.page.spec.ts` — REESCRIBIR bloque actual (L216-341): (a) otras-session con mock `usuario` A → `showReopenModal()===true`; NUNCA llama `autoCerrarSiOtroUsuario`; sin toast "cerrada automáticamente"; sin `navigate`; (b) `cerrarYGuardar` llama `cerrar(j.id, mockUsuario.id)` (mock admin id=1), nunca `user_apertura_id`; legacy apertura NULL → uid autenticado; `auth.usuario()` null → NO llama `cerrar` (sin crash); (c) modal-fecha: jornada `fecha:'2026-08-07'` → título "Reanudar jornada del 07-08", copy "Hay una jornada sin cerrar", NUNCA "de hoy".
  - Verif RED: 7 fallos / 14 pasan — `autoCerrarSiOtroUsuario` llamado, `cerrar` con `user_apertura_id`, modal con copy "de hoy".
- [x] **2.2 (GREEN)** `login.page.ts` — D6: `_jornadaPendiente` → `readonly jornadaPendiente = signal<Jornada \| null>(null)`; `onSubmit()`: `abierta` → `jornadaPendiente.set(abierta)` + `showReopenModal.set(true)`, sin `autoCerrarSi`; `cerrarYGuardar()`: `const uid = this.auth.usuario()?.id; if (uid===undefined) return;` y `cerrar(j.id, uid)`; helper `formatearFecha(fecha): string` → `DD-MM` desde ISO.
  - Verif: 21/21 verdes en login.page.spec.ts; `tsc --noEmit` limpio.
- [x] **2.3 (GREEN)** `login.page.html` — modal L62+: `@if (jornadaPendiente(); as j)` con título `Reanudar jornada del {{ formatearFecha(j.fecha) }}`; copy `Hay una jornada sin cerrar. ¿Qué deseas hacer?`; reemplazar texto "de hoy".
  - Verif: modal-fecha tests verdes (fechas 07-08 y 08-08); suite completa 45 files / 767 tests.
- commit propuesto PR 2: `fix(login): modal de reanudar para cualquier usuario con user_cierre autenticado`

## Fase 3: Purga auto-cierre — FR-2, spec "Auto-Close REMOVED"

- [x] **3.1 (purge)** `jornada.service.ts` — ELIMINAR `autoCerrarSiOtroUsuario()` L201-273 (+ docblock) ya sin callers; `jornada.service.spec.ts` — borrar bloque `describe autoCerrarSiOtroUsuario` L1410-1953 completo. (IMPLEMENTADO PR 3, rama `pr3-purga-auto-cierre` — ver apply-progress rev 3)
  - Verif: `grep -rn autoCerrarSi` → solo en guard del mock de login (asserts NUNCA llamado) y openspec deltas (REMOVED); suite completa 45 files / 756 tests verdes (767 − 11); `tsc --noEmit` limpio. UI no puede llamar a un método inexistente.
  - Bonus: purgado `successMessage` muerto en login (señal + template + aserción spec → DOM real). Commits: `a8ec000` + `060509b`.
- Commit: `refactor(jornada): eliminar auto-cierre por otro usuario` (delete-heavy, sin lógica nueva)

## Fase 4: Excel "Abierta por / Cerrada por" — FR-6, AC6

- [x] **4.1 (RED)** `jornada.service.spec.ts` — NUEVO: `_ejecutarCierre` y `_recolectarDatosJornada` resuelven `userAperturaNombre` ('Ana' cuando `user_apertura_id`→Ana; `null` si id inexistente o NULL), propagado a `JornadaReportData` en `_generarYGuardarExcel`/`-exportaciones`; actualizar mocks existentes de `cerrar`/`_ejecutarCierre` agregando 1 mock `SELECT nombre` (design Riesgo-2).
  - Verif RED filas fallan. IMPLEMENTADO PR 4 (6 tests nuevos; el test existente de arqueo sumó 1 mock `SELECT nombre` del LEFT JOIN).
- [x] **4.2 (GREEN)** `jornada.service.ts` — en `_ejecutarCierre` (junto L543-548): `SELECT nombre FROM usuarios WHERE id = ?` con `jornada.user_apertura_id`; en `_recolectarDatosJornada` (junto L764-771): `SELECT u.nombre FROM jornadas j LEFT JOIN usuarios u ON u.id = j.user_apertura_id WHERE j.id = ?`; agregar `userAperturaNombre` a los retornos/tipos y a los datos de `_generarYGuardarExcel`/`generarExportacionMensual`/`PorRango`/`obtenerDatosJornada` (L370/389/596/633/664/825/908).
  - Verif: 4.1 verde.
- [x] **4.3 (RED)** `excel.service.spec.ts` — firma: `userAperturaNombre:'Ana'` ≠ `userCierreNombre:'Beto'` → `['Abierta por','Ana']`+`['Cerrada por','Beto']`; iguales → única `['Firmado por','Beto']`; apertura NULL → `Firmado por` (back-compat). En `_agregarResumen` y `_agregarJornadaSheet`.
  - Verif RED fails. (2 failed A≠B; A=B y NULL ya pasaban = back-compat)
- [x] **4.4 (GREEN)** `excel.service.ts` — `JornadaReportData.userAperturaNombre?: string \| null` (JornadaReportData L41); bloques L174-176 y L591-594 pasan a condicional D5 (`if (userApertura && userCierre && distinto) → 2 filas; else if (userCierre) → Firmado por`).
  - Verif: 4.3 verde. Suite completa 45 files / 768 tests verdes; `tsc --noEmit` limpio.
- commit propuesto PR 4: `feat(excel): registrar quien abre y cierra la jornada (Abierta por/Cerrada por)`

## Verificación final / Dependencias / Notas

```
ng test / npx vitest run → 45+ files, suite completa verde
```
Dependencias: 1.1→1.2→1.3; 2.1→2.2→2.3 (t2 requiere auth usados `cerrar` firma intacta); 3.1 DESPUÉS de 2.2 (el caller desaparece); 4.1→4.2→4.3→4.4; PR1→PR2→PR3→PR4 en cadena (cada PR build en verde después de sí mismo).

Notas de riesgo p/ el aplicador:
1. 2.1(c): `título_modal` exige `formatearFecha` expuesto como método público (template binding) — definir en login.page.ts NO como helper privado inline.
2. Al purgar `autoCerrar` (3.1), borrar juntos método + docblock + bloque test; NO dejar imports muertos de `UsuarioPublico`.
3. `userCierreNombre` se mantiene en `_recolectarDatosJornada` actual — NO refactorizar el JOIN de cierre, solo AÑADIR apertura (design D4).
4. Specs openspec deltas ya existen en `openspec/changes/fix-reanudar-jornada-acceso/specs/` — aplicador NO debe reescribirlos (archive se encarga).
5. No usar `autoClose`/`cerrarYGuardar` con `user_apertura_id`: explícitamente `auth.usuario()?.id`.