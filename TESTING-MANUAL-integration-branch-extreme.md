# 🧪 Testing Manual — integration-branch-extreme

> **Branch:** `integration-branch-extreme` (languaje + bundle + lint)
> **Fecha:** 2026-08-17 | **Tests auto:** 919 ✅ | **Build:** ✅
> **Instrucciones:** Ejecutar en orden. Si un test CRÍTICO falla, detener y reportar.

---

## 🔴 FASE 1 — CRÍTICO (Lazy-load Excel + Async Exports)

> **Riesgo:** Estos tests validan los cambios más destructivos. Si fallan, la app no puede exportar Excel.
> **DevTools:** Abrir DevTools → Network (para ver carga de chunks) + Console (para ver errores).

---

### TEST 01 — Cold Start: primera exportación después de carga limpia

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | App cerrada o cache limpio |
| **Archivos afectados** | `excel.service.ts` (lazy import), `historial.page.ts` (async export) |
| **Riesgo si falla** | Exportaciones no funcionan |

**Pasos:**
1. Cerrar la app completamente
2. Abrir la app
3. Ir a **Historial**
4. Seleccionar un día con jornada cerrada (ej: junio 2026, día 4)
5. Hacer clic en **Descargar Excel**
6. Abrir DevTools → Network → buscar `chunk-` que contenga xlsx
7. Abrir DevTools → Console → verificar que no hay errores rojos

**Resultado esperado:**
- ✅ El Excel se descarga y se puede abrir
- ✅ En Network aparece un chunk con xlsx (lazy load funcionó)
- ✅ Console limpia, sin errores de `import()` o `xlsx`

**Si falla:**
- Error en Console sobre `Failed to fetch dynamically imported module` → chunk no se encontró
- Error sobre `xlsx is not defined` → lazy load no resolvió

---

### TEST 02 — Preload en idle: chunk precargado después de 3 segundos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | App recién abierta, sin exportar nada |
| **Archivos afectados** | `excel.service.ts` (_precargarXlsxAlIdle) |
| **Riesgo si falla** | Primera exportación lenta |

**Pasos:**
1. Abrir la app (cache limpio)
2. **NO hacer nada** — dejar idle 3+ segundos
3. Abrir DevTools → Network → filtrar por `chunk-`
4. Verificar si apareció un chunk con xlsx
5. Ir a **Historial** → Exportar mes
6. Cronometrar: debería ser rápido (< 2 segundos)

**Resultado esperado:**
- ✅ En Network aparece un chunk con xlsx cargado DESPUÉS del primer paint
- ✅ La exportación es rápida porque el chunk ya está cacheado
- ✅ No hay delay visible al exportar

**Si falla:**
- Chunk no aparece en Network → `requestIdleCallback` no se ejecutó
- Exportación lenta → el preload no funcionó o el cache se perdió

---

### TEST 03 — Exportación mensual: async con botón deshabilitado

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | Mes con jornadas cerradas (ej: junio 2026) |
| **Archivos afectados** | `historial.page.ts` (exportarMes async) |
| **Riesgo si falla** | UI se bloquea o exportación falla silenciosamente |

**Pasos:**
1. Ir a **Historial**
2. Navegar a junio 2026 (mes con 4 jornadas cerradas)
3. Hacer clic en **Exportar mes**
4. **Observar inmediatamente:**
   - ¿El botón cambia de texto?
   - ¿El botón queda deshabilitado?
5. Esperar a que se descargue el Excel
6. **Observar después:**
   - ¿El botón vuelve a su estado normal?
   - ¿Se puede hacer clic de nuevo?

**Resultado esperado:**
- ✅ Botón muestra "Generando..." durante la exportación
- ✅ Botón deshabilitado (no se puede clickear dos veces)
- ✅ Excel descargado con hoja "Resumen del Mes" + hojas por jornada
- ✅ Botón vuelve a habilitarse después de completar

**Si falla:**
- Botón no se deshabilita → la señal `exportando` no se setea
- Botón queda deshabilitado para siempre → el catch/finally no ejecuta
- Excel vacío o incompleto → la función async no resolvió

---

### TEST 04 — Exportación por rango: validación de fechas

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | Al menos 2 jornadas cerradas en fechas distintas |
| **Archivos afectados** | `historial.page.ts` (exportarRango async) |
| **Riesgo si falla** | Exportación parcial o con fechas incorrectas |

**Pasos:**
1. Ir a **Historial**
2. Hacer clic en el botón de rango (picker de fechas)
3. Seleccionar **fecha desde**: 2026-06-01
4. Seleccionar **fecha hasta**: 2026-06-15
5. Hacer clic en **Exportar**
6. Verificar que el Excel contiene solo jornadas en ese rango

**Resultado esperado:**
- ✅ El picker de fechas se abre correctamente
- ✅ Las fechas se seleccionan sin errores
- ✅ El botón muestra estado de carga
- ✅ El Excel descargado tiene las jornadas del rango seleccionado
- ✅ El botón vuelve a habilitarse

**Si falla:**
- Error "Seleccione fecha desde y hasta" → las señales no se setearon
- Excel con todas las jornadas (no filtrado) → el filtro de rango no funcionó

---

### TEST 05 — Error en exportación: manejo de errores

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | Capability de provocar error (ver pasos) |
| **Archivos afectados** | `historial.page.ts` (catch block) |
| **Riesgo si falla** | App se bloquea sin posibilidad de recuperación |

**Pasos:**
1. Ir a **Historial** → seleccionar mes con jornadas
2. **Método A (consola):** En Console ejecutar:
   ```js
   // Detener la DB para forzar error
   indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)))
   ```
3. Hacer clic en **Exportar mes**
4. Observar comportamiento

**Resultado esperado:**
- ✅ Se muestra mensaje de error al usuario (rojo)
- ✅ El botón vuelve a habilitarse después del error
- ✅ La app no se bloquea (se puede navegar)
- ✅ No hay errores no capturados en Console

**Si falla:**
- App se bloquea → el `finally` no se ejecuta
- Error no se muestra → el `catch` no captura el error
- Error no controlado en Console → falta `try/catch`

---

### TEST 06 — Reintento con backoff: 3 intentos antes de fallar

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | DevTools Network access |
| **Archivos afectados** | `excel.service.ts` (_importarXlsxConReintento) |
| **Riesgo si falla** | App se queda colgada o falla en el primer intento |

**Pasos:**
1. Abrir DevTools → Network
2. Buscar el chunk de xlsx (el que apareció en TEST 01/02)
3. **Bloquear ese chunk:** Click derecho → Block request URL
4. Ir a **Historial** → intentar exportar
5. Observar Console: debería ver 3 intentos (logs o timeouts)
6. Esperar a que falle (200ms + 400ms + 600ms = ~1.2 segundos)

**Resultado esperado:**
- ✅ Console muestra 3 intentos (o se ven 3 requests fallidos en Network)
- ✅ Después de 3 fallos, se muestra error al usuario
- ✅ La app no se bloquea (se puede seguir usando)
- ✅ El botón vuelve a habilitarse

**Si falla:**
- Solo 1 intento → el loop no está funcionando
- App se bloquea → el `throw ultimoError` no se captura
- Más de 3 intentos → el contador está mal

---

### TEST 07 — Descarga individual: Excel de una sola jornada

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🔴 CRÍTICO |
| **Precondición** | Al menos 1 jornada cerrada con ventas |
| **Archivos afectados** | `historial.page.ts` (descargarExcel), `excel.service.ts` |
| **Riesgo si falla** | No se pueden descargar reportes individuales |

**Pasos:**
1. Ir a **Historial**
2. Seleccionar un día con jornada cerrada (ej: junio 4)
3. Hacer clic en **Descargar Excel** de la primera jornada
4. Abrir el Excel descargado

**Resultado esperado:**
- ✅ El Excel se descarga con extensión `.xlsx`
- ✅ Contiene hojas: Resumen, Ventas, Movimientos
- ✅ Los datos corresponden a esa jornada específica
- ✅ Los montos están en formato `$` (pesos)

**Si falla:**
- Excel vacío → `obtenerReporte` no devolvió datos
- Error en descarga → `saveIndividual` falló

---

## 🟠 FASE 2 — ALTO (PesosPipe + Moneda Local)

> **Riesgo:** Formato de moneda incorrecto en toda la app. impacto visual alto.

---

### TEST 08 — POS: precios en formato pesos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟠 ALTO |
| **Precondición** | Jornada abierta, al menos 3 productos |
| **Archivos afectados** | `pesos.pipe.ts`, componentes POS |
| **Riesgo si falla** | Precios muestran `ARS` o `US$` en vez de `$` |

**Pasos:**
1. Ir a **POS**
2. Observar precios de los productos en la grilla
3. Agregar un producto al carrito
4. Observar precio unitario y subtotal en el carrito
5. Abrir modal de checkout
6. Observar total y subtotales

**Resultado esperado:**
- ✅ Precios en grilla: `$850`, `$1.100`, `$150` (formato pesos)
- ✅ Precio en carrito: `$850`
- ✅ Subtotal en carrito: `$850`
- ✅ Total en checkout: formato pesos
- ✅ **NO** aparece `ARS`, `US$`, ni `USD` en ningún precio

**Si falla:**
- Muestra `ARS` → `CurrencyPipe` sigue activo en algún componente
- Muestra `US$` → el pipe no se migró correctamente
- Muestra número sin formato → el pipe no se está usando

---

### TEST 09 — Productos: precios costo y venta en formato pesos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟠 ALTO |
| **Precondición** | Al menos 1 producto con precio_costo y precio_venta |
| **Archivos afectados** | `producto.page.html` (pesos pipe) |
| **Riesgo si falla** | Inconsistencia de moneda en gestión de productos |

**Pasos:**
1. Ir a **Productos**
2. Verificar columna "Precio venta"
3. Si eres admin, verificar columna "Precio costo"
4. Verificar "Total invertido" y "Total esperado"

**Resultado esperado:**
- ✅ Precio venta: `$850` (formato pesos)
- ✅ Precio costo: `$400` (formato pesos, admin)
- ✅ Total invertido: `$32.000` (formato pesos)
- ✅ Total esperado: `$68.000` (formato pesos)
- ✅ **NO** aparece `ARS` ni `currency:'ARS'`

**Si falla:**
- Precio costo muestra `ARS$400` → `currency:'ARS'` sigue en `producto.page.html`
- Precio venta sin formato → el pipe no se aplica

---

### TEST 10 — Checkout Modal: montos en formato pesos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟠 ALTO |
| **Precondición** | Al menos 2 productos en carrito |
| **Archivos afectados** | `checkout-modal.component.html` (pesos pipe) |
| **Riesgo si falla** | Montos confusos durante cobro |

**Pasos:**
1. Agregar 2 productos diferentes al carrito
2. Abrir modal de checkout
3. Observar cada línea de producto
4. Observar subtotal y total

**Resultado esperado:**
- ✅ Cada producto muestra precio en formato `$`
- ✅ Subtotales en formato `$`
- ✅ Total general en formato `$`
- ✅ Si hay descuento, el monto descontado en formato `$`

**Si falla:**
- Algún monto muestra `ARS` →.pipe no migrado en checkout-modal
- Total sin formato → el pipe falta en el template

---

### TEST 11 — Historial: montos en vista previa de jornada

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟠 ALTO |
| **Precondición** | Jornada cerrada con ventas y gastos |
| **Archivos afectados** | `historial.page.html` (pesos pipe) |
| **Riesgo si falla** | Montos incorrectos en reporte diario |

**Pasos:**
1. Ir a **Historial**
2. Seleccionar un día con jornada cerrada
3. Observar panel de detalle: Ventas, Gastos, Saldo esperado
4. Hacer clic en **Ver Preview** (si existe)
5. Observar filas de productos y totales

**Resultado esperado:**
- ✅ Ventas totales: `$25.000` (formato pesos)
- ✅ Gastos: `$3.000` (formato pesos)
- ✅ Saldo esperado: `$27.000` (formato pesos)
- ✅ En preview: precios de productos en formato `$`

**Si falla:**
- Algún monto muestra `ARS` → pipe no migrado en historial
- Preview sin formato → pipe falta en vista previa

---

### TEST 12 — Inventario: precios de lotes en formato pesos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟠 ALTO |
| **Precondición** | Al menos 1 producto con lotes |
| **Archivos afectados** | `inventario.page.html` (pesos pipe) |
| **Riesgo si falla** | Costos de inventario confusos |

**Pasos:**
1. Ir a **Inventario**
2. Expandir lotes de un producto
3. Observar columna "Precio costo" en lotes
4. Observar "Total invertido" del producto

**Resultado esperado:**
- ✅ Precio costo del lote: `$550` (formato pesos)
- ✅ Total invertido del producto: `$44.000` (formato pesos)
- ✅ Total esperado: `$68.000` (formato pesos)

**Si falla:**
- Precio muestra `ARS$550` → pipe no migrado en inventario
- Total sin formato → pipe falta

---

## 🟡 FASE 3 — MEDIO (Neutralización de Lenguaje)

> **Riesgo:** Textos con voseo rioplatense en app que debería ser neutra.

---

### TEST 13 — Checkout: textos neutros en modal

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Producto en carrito |
| **Archivos afectados** | `checkout-modal.component.html` |
| **Riesgo si falla** | Inconsistencia de lenguaje |

**Pasos:**
1. Agregar producto al carrito
2. Abrir modal de checkout
3. Leer todos los textos visibles del modal

**Resultado esperado (textos neutros):**
- ✅ "Seleccione forma de pago" (NO "Seleccioná")
- ✅ "Ingrese monto" (NO "Ingresá")
- ✅ "Confirmar cobro" (sin voseo)
- ✅ "Cancelar" (sin voseo)
- ✅ Ningún texto terminado en "á" (infinitivo voseo)

**Si falla:**
- Cualquier texto con "á" al final → voseo no neutralizado

---

### TEST 14 — Cobro Pendiente: textos neutros

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Venta con pendiente generada |
| **Archivos afectados** | `cobro-pendiente-modal.component.html` |
| **Riesgo si falla** | Voseo en gestión de cobros |

**Pasos:**
1. Generar una venta con forma de pago "pendiente"
2. Ir a gestión de pendientes
3. Abrir modal de cobro pendiente
4. Leer todos los textos

**Resultado esperado:**
- ✅ Textos en español neutro
- ✅ "Cobrar pendiente" (NO "Cobrá")
- ✅ "Ingrese monto" (NO "Ingresá")
- ✅ Botones: "Confirmar", "Cancelar" (sin voseo)

**Si falla:**
- Cualquier texto con voseo → no se neutralizó

---

### TEST 15 — Historial: texto de validación de rango

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Ninguna (solo navegar) |
| **Archivos afectados** | `historial.page.ts` (error messages) |
| **Riesgo si falla** | Mensaje de error con voseo |

**Pasos:**
1. Ir a **Historial**
2. Abrir picker de rango
3. Dejar "fecha desde" vacía
4. Seleccionar "fecha hasta"
5. Hacer clic en **Exportar**
6. Observar mensaje de error

**Resultado esperado:**
- ✅ Mensaje: "Seleccione fecha desde y hasta para exportar."
- ✅ **NO** aparece "Seleccioná fecha desde y hasta..."

**Si falla:**
- Mensaje con "Seleccioná" → el string no se neutralizó

---

### TEST 16 — Empty states: mensajes neutros

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Página sin datos |
| **Archivos afectados** | Varios componentes |
| **Riesgo si falla** | Mensajes de empty state con voseo |

**Pasos:**
1. Ir a **Historial** en un mes sin jornadas
2. Observar mensaje de empty state
3. Ir a **POS** sin productos
4. Observar mensaje de empty state

**Resultado esperado:**
- ✅ "No hay jornadas registradas aún. Abra una jornada desde la página de Jornada."
- ✅ Textos sin voseo ("Abra" NO "Abrí")

**Si falla:**
- Cualquier mensaje con voseo → no se neutralizó

---

### TEST 17 — Errores: mensajes de error neutros

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Capability de forzar error |
| **Archivos afectados** | `db-error.component.html`, otros |
| **Riesgo si falla** | Errores con voseo confunden al usuario |

**Pasos:**
1. Forzar error de DB (desconectar, abortar, etc.)
2. Observar componente de error
3. Leer todos los textos

**Resultado esperado:**
- ✅ Mensajes de error en español neutro
- ✅ "Error al cargar datos" (NO "Error al cargar los datos" con voseo implícito)
- ✅ Botón: "Reintentar" (sin voseo)

**Si falla:**
- Error con voseo → no se neutralizó

---

## 🟡 FASE 4 — MEDIO (Accesibilidad a11y)

> **Riesgo:** Navegación por teclado rota, usuarios con discapacidad no pueden usar la app.

---

### TEST 18 — Checkout: labels asociados a inputs

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Producto en carrito, modal abierto |
| **Archivos afectados** | `checkout-modal.component.html` (for/id) |
| **Riesgo si falla** | Inputs inaccesibles por teclado |

**Pasos:**
1. Abrir modal de checkout
2. Hacer clic en el label "Efectivo" (o el label del input de monto)
3. Observar a dónde va el foco

**Resultado esperado:**
- ✅ Al hacer clic en el label, el foco se mueve al input correspondiente
- ✅ El input recibe foco visible (borde azul o ring)
- ✅ Se puede escribir directamente sin hacer clic en el input

**Si falla:**
- Foco no se mueve → `[attr.for]` no está asociado al `[attr.id]` del input
- Label no es clickeable → el `for` no coincide con el `id`

---

### TEST 19 — Cobro Pendiente: labels accesibles

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Modal de cobro pendiente abierto |
| **Archivos afectados** | `cobro-pendiente-modal.component.html` |
| **Riesgo si falla** | Inputs inaccesibles |

**Pasos:**
1. Abrir modal de cobro pendiente
2. Hacer clic en labels de los inputs
3. Verificar que el foco se mueve

**Resultado esperado:**
- ✅ Cada label está asociado a su input (for/id match)
- ✅ El foco se mueve al hacer clic en el label
- ✅ Se puede navegar con Tab entre inputs

**Si falla:**
- Labels no asociados → `[attr.for]` o `[attr.id]` falta

---

### TEST 20 — Inventario: labels en formulario de edición

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Al menos 1 producto en inventario |
| **Archivos afectados** | `inventario.page.html` (labels con for/id) |
| **Riesgo si falla** | Formulario de edición inaccesible |

**Pasos:**
1. Ir a **Inventario**
2. Hacer clic en "Editar" de un producto
3. Hacer clic en label "Nombre"
4. Hacer clic en label "Precio Venta"
5. Hacer clic en label "Precio Costo"
6. Hacer clic en label "Cantidad nueva del lote"
7. Hacer clic en label "Lote" (si aplica)

**Resultado esperado:**
- ✅ Cada label mueve el foco al input correspondiente
- ✅ Los IDs son únicos por producto (no colisionan)
- ✅ Se puede navegar con Tab

**Si falla:**
- Labels no funcionan → `[attr.for]` no coincide con `[attr.id]`
- IDs duplicados → el `id` no incluye `producto.id`

---

### TEST 21 — POS: navegación por teclado

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Jornada abierta, productos disponibles |
| **Archivos afectados** | `quantity-input.component.html`, `pos.page.html` |
| **Riesgo si falla** | POS inaccesible sin mouse |

**Pasos:**
1. Ir a **POS**
2. Presionar **Tab** repetidamente
3. Verificar qué elemento recibe foco en cada paso
4. Presionar **Enter** sobre un producto
5. Presionar **Escape** si se abre un modal

**Resultado esperado:**
- ✅ Tab navega por: búsqueda → productos → carrito → botones de acción
- ✅ Enter sobre producto lo agrega al carrito
- ✅ Escape cierra modales abiertos
- ✅ No hay "trampas de foco" (elementos no alcanzables)

**Si falla:**
- Tab se pierde → hay elementos sin `tabindex` o `role`
- Escape no cierra modal → el listener no está configurado

---

### TEST 22 — Modales: cierre con Escape

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Cualquier modal abierto |
| **Archivos afectados** | checkout-modal, cobro-pendiente-modal, preview |
| **Riesgo si falla** | UX rota, usuario atrapado en modal |

**Pasos:**
1. Abrir modal de checkout (agregar producto al carrito + clic en cobrar)
2. Presionar **Escape**
3. Abrir modal de vista previa en historial
4. Presionar **Escape**
5. Abrir modal de cobro pendiente
6. Presionar **Escape**

**Resultado esperado:**
- ✅ Checkout: modal se cierra
- ✅ Preview: modal se cierra
- ✅ Cobro pendiente: modal se cierra
- ✅ El foco vuelve al elemento que abrió el modal

**Si falla:**
- Modal no cierra → el listener de keydown no está configurado
- Foco no vuelve → no hay `returnFocus` o similar

---

## 🟡 FASE 5 — MEDIO (Tipado y Calidad)

> **Riesgo:** Errores de tipo en runtime, `any` que oculta bugs.

---

### TEST 23 — Consola: sin errores de TypeScript

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | DevTools Console abierta |
| **Archivos afectados** | Todos los archivos modificados |
| **Riesgo si falla** | Bugs de tipo en runtime |

**Pasos:**
1. Abrir DevTools → Console
2. Recargar la app (Ctrl+Shift+R)
3. Navegar por: POS → Historial → Productos → Inventario
4. Observar Console durante toda la navegación

**Resultado esperado:**
- ✅ Console limpia (solo logs de Angular en modo dev)
- ✅ Sin errores de `TypeError`, `undefined is not a function`
- ✅ Sin warnings de `any` o `unsafe assignment`

**Si falla:**
- `TypeError: Cannot read property of undefined` → un cast `as any` ocultó un bug real
- `is not a function` → una función async se trata como sync

---

### TEST 24 — Exportaciones: tipo de retorno correcto

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟡 MEDIO |
| **Precondición** | Jornada cerrada |
| **Archivos afectados** | `jornada.service.ts` (Promise<string>) |
| **Riesgo si falla** | Exportación retorna Observable en vez de Promise |

**Pasos:**
1. Ir a **Historial**
2. Seleccionar día cerrado
3. Hacer clic en **Descargar Excel**
4. En Console, verificar que no hay warnings sobre `subscribe` en Promise

**Resultado esperado:**
- ✅ La descarga funciona
- ✅ No hay warnings sobre `subscribe` en una Promise
- ✅ El `await` resuelve correctamente

**Si falla:**
- Warning sobre `subscribe` → la función todavía retorna Observable en vez de Promise
- Error `subscribe is not a function` → el consumer no se actualizó a async

---

## 🟢 FASE 6 — BAJO (Regresiones)

> **Riesgo:** Funciones que ya funcionaban se rompieron por los cambios.

---

### TEST 25 — POS: flujo completo de venta

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Jornada abierta, productos con stock |
| **Archivos afectados** | pos.page, cart-item-row, checkout-modal |
| **Riesgo si falla** | Venta no se registra |

**Pasos:**
1. Ir a **POS**
2. Agregar 2 productos al carrito (cantidades distintas)
3. Verificar que los subtotales son correctos
4. Hacer clic en **Cobrar**
5. Seleccionar **Efectivo**
6. Confirmar cobro
7. Verificar que el carrito se vacía

**Resultado esperado:**
- ✅ Productos se agregan al carrito
- ✅ Subtotales = cantidad × precio unitario
- ✅ Total = suma de subtotales
- ✅ Después de cobrar, carrito vacío
- ✅ Stock se actualiza (verificar en Inventario)

**Si falla:**
- Subtotal incorrecto → el pipe o el cálculo se rompió
- Carrito no se vacía → el reset no funciona
- Stock no se actualiza → la transacción no se ejecutó

---

### TEST 26 — Cierre de jornada: cálculos correctos

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Jornada abierta con movimientos |
| **Archivos afectados** | `jornada.service.ts` |
| **Riesgo si falla** | Saldos incorrectos |

**Pasos:**
1. Ir a **Jornada**
2. Registrar 2 gastos ($500 y $1.000)
3. Registrar 1 ingreso extra ($2.000)
4. Verificar total en caja
5. Cerrar jornada
6. Verificar saldo esperado vs saldo real

**Resultado esperado:**
- ✅ Total en caja = monto_inicial + ingresos - gastos
- ✅ Saldo esperado = total en caja (si no hay ventas) o monto calculado
- ✅ La jornada se marca como "cerrada"
- ✅ Se puede descargar Excel de la jornada cerrada

**Si falla:**
- Saldo incorrecto → los cálculos de `totalEnCaja` se rompieron
- Jornada no cierra → la función de cierre falló

---

### TEST 27 — Inventario: CRUD completo

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Capacidad de crear/editar productos |
| **Archivos afectados** | `inventario.page.ts` |
| **Riesgo si falla** | Gestión de inventario rota |

**Pasos:**
1. Ir a **Inventario**
2. Crear nuevo producto (nombre, precio, stock)
3. Editar producto existente (cambiar precio)
4. Agregar lote a un producto
5. Registrar merma
6. Verificar que los cambios persisten

**Resultado esperado:**
- ✅ Producto creado aparece en la lista
- ✅ Precio editado se refleja
- ✅ Lote agregado aparece en detalle
- ✅ Merma reduce el stock
- ✅ Los totales se recalculan

**Si falla:**
- Producto no aparece → la inserción falló
- Precio no cambia → el update no ejecutó
- Stock no reduce → la merma no se registró

---

### TEST 28 — Login/Logout: autenticación

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Credenciales válidas |
| **Archivos afectados** | `auth.service.ts`, `auth.guard.spec.ts` |
| **Riesgo si falla** | No se puede acceder a la app |

**Pasos:**
1. Cerrar sesión (si hay botón)
2. Ir a login
3. Ingresar credenciales
4. Hacer clic en entrar
5. Verificar que se redirige al POS o dashboard

**Resultado esperado:**
- ✅ Login muestra formulario
- ✅ Credenciales correctas → redirige a app
- ✅ Credenciales incorrectas → muestra error
- ✅ Logout → vuelve a login
- ✅ Rutas protegidas redirigen a login

**Si falla:**
- Login no funciona → `auth.service.ts` se rompió
- Ruta protegida accesible → el guard no funciona

---

### TEST 29 — Dark mode: legibilidad

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Toggle de dark mode disponible |
| **Archivos afectados** | Tailwind dark: classes |
| **Riesgo si falla** | Texto ilegible en dark mode |

**Pasos:**
1. Activar dark mode (toggle o preferencia del sistema)
2. Navegar por: POS → Historial → Productos → Inventario
3. Verificar colores de texto y fondo
4. Verificar pipes de moneda en dark mode

**Resultado esperado:**
- ✅ Texto claro sobre fondo oscuro (legible)
- ✅ Precios en formato `$` se ven bien
- ✅ Botones visibles
- ✅ Modales con fondo oscuro y texto claro

**Si falla:**
- Texto invisible → falta `dark:text-*` en algún elemento
- Precio ilegible → el pipe no considera dark mode

---

### TEST 30 — Multi-jornada: día con 2 jornadas

| Campo | Valor |
|-------|-------|
| **Prioridad** | 🟢 BAJO |
| **Precondición** | Día con 2 jornadas (ej: junio 4) |
| **Archivos afectados** | `historial.page.ts` (Multi-jornada Feature A) |
| **Riesgo si falla** | Visualización incorrecta de múltiples jornadas |

**Pasos:**
1. Ir a **Historial** → junio 2026
2. Seleccionar día 4 (tiene 2 jornadas)
3. Observar panel de detalle
4. Verificar que hay 2 tarjetas de jornada

**Resultado esperado:**
- ✅ Se muestran 2 tarjetas de jornada
- ✅ Cada tarjeta tiene su propio botón "Descargar Excel"
- ✅ Los datos de cada jornada son correctos
- ✅ El badge del día muestra 2 indicadores

**Si falla:**
- Solo 1 jornada visible → el agrupador no funciona
- Datos mezclados → la separación por jornada falló

---

## 📋 Checklist de Aprobación

| # | Test | Área | Estado | Notas |
|---|------|------|--------|-------|
| 01 | Cold Start Excel | 🔴 CRÍTICO | ⬜ | |
| 02 | Preload idle | 🔴 CRÍTICO | ⬜ | |
| 03 | Exportación mensual | 🔴 CRÍTICO | ⬜ | |
| 04 | Exportación rango | 🔴 CRÍTICO | ⬜ | |
| 05 | Error exportación | 🔴 CRÍTICO | ⬜ | |
| 06 | Reintento backoff | 🔴 CRÍTICO | ⬜ | |
| 07 | Descarga individual | 🔴 CRÍTICO | ⬜ | |
| 08 | POS pesos | 🟠 ALTO | ⬜ | |
| 09 | Productos pesos | 🟠 ALTO | ⬜ | |
| 10 | Checkout pesos | 🟠 ALTO | ⬜ | |
| 11 | Historial pesos | 🟠 ALTO | ⬜ | |
| 12 | Inventario pesos | 🟠 ALTO | ⬜ | |
| 13 | Checkout neutro | 🟡 MEDIO | ⬜ | |
| 14 | Cobro pendiente neutro | 🟡 MEDIO | ⬜ | |
| 15 | Historial neutro | 🟡 MEDIO | ⬜ | |
| 16 | Empty states neutro | 🟡 MEDIO | ⬜ | |
| 17 | Errores neutros | 🟡 MEDIO | ⬜ | |
| 18 | Checkout a11y | 🟡 MEDIO | ⬜ | |
| 19 | Cobro pendiente a11y | 🟡 MEDIO | ⬜ | |
| 20 | Inventario a11y | 🟡 MEDIO | ⬜ | |
| 21 | POS teclado | 🟡 MEDIO | ⬜ | |
| 22 | Modales Escape | 🟡 MEDIO | ⬜ | |
| 23 | Consola limpia | 🟡 MEDIO | ⬜ | |
| 24 | Tipos export | 🟡 MEDIO | ⬜ | |
| 25 | POS venta | 🟢 BAJO | ⬜ | |
| 26 | Cierre jornada | 🟢 BAJO | ⬜ | |
| 27 | Inventario CRUD | 🟢 BAJO | ⬜ | |
| 28 | Login/Logout | 🟢 BAJO | ⬜ | |
| 29 | Dark mode | 🟢 BAJO | ⬜ | |
| 30 | Multi-jornada | 🟢 BAJO | ⬜ | |

---

## Resumen de aprobación

| Fase | Tests | Aprobados | Bloquean merge |
|------|-------|-----------|----------------|
| 🔴 CRÍTICO | 7 | __/7 | **SÍ** |
| 🟠 ALTO | 5 | __/5 | SÍ |
| 🟡 MEDIO | 12 | __/12 | No |
| 🟢 BAJO | 6 | __/6 | No |

**Resultado final:**
- [ ] ✅ **APROBADO** — Todos los tests CRÍTICOS y ALTO pasaron
- [ ] ❌ **RECHAZADO** — Hay tests CRÍTICOS o ALTO fallando

**Tester:** _________________
**Fecha:** _________________
**Observaciones:**
_______________________________________________
_______________________________________________
