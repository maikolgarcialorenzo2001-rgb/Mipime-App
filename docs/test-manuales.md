# 🧪 Guía de testeo manual — release 0.1.21-beta

## A. Área MONEDA (cambios frontend P0)

### A1. Formato unificado de dinero
1. Abrí la app, entrá a **Jornada** → mirá el resumen (inicial, ventas, gastos, saldo).
2. Mirá el **nav** superior → "Total en caja".
3. Entrá a **Inventario** → mirá los costos/precios de la tabla.
4. Entrá a **Productos** → columna de precios.

- ✅ Esperado: el monto se ve **idéntico en todas las vistas**: `$1.500,00` (punto de miles, coma decimal), independiente del locale del dispositivo.

### A2. tabular-nums (dígitos no tiemblan)
1. Andá al **POS** y armá un carrito.
2. Mirá fijo el **total** mientras agregás productos y cambia en vivo.

- ✅ Esperado: los dígitos **no se mueven/tiemblan** al actualizarse. En tablas, los números quedan alineados verticalmente.

### A3. Guard de doble envío (checkout)
1. POS → agregá un producto → tocá **Cobrar / Confirmar**.
2. Hacé **doble click rápido** sobre "Confirmar".
3. Mientras procesa, intentá: **Escape**, click en el **backdrop**, click en **Cancelar**.

- ✅ Esperado: el botón se deshabilita con "Guardando…" + spinner; **solo se registra UNA venta** (verificable en Historial/Jornada); el modal no se cierra ni duplica.

### A4. Motion + reduced-motion
1. Hover sobre botones/cards → transición rápida (~0.25s), no lenta.
2. Toggle **claro/oscuro** (ajustes) → suave.
3. Activá en el OS **Reducir movimiento** (Accesibilidad → Efectos) → reiniciá la app.

- ✅ Esperado: con reduced-motion activo **no hay animaciones** (todo instantáneo), el toggle sigue andando.

---

## B. Área BRANDING / SHELL (P1)

### B1. Nombre del comercio
1. Con `nombre_comercio` configurado en Setup → reiniciá.
2. Sin configurar → fallback **"Mipime POS"**.
3. **Título de pestaña** refleja el nombre (runtime).

- ✅ Esperado: el **nav** y **login** muestran el nombre real (no "Tienda-App").

### B2. Focus visible por teclado
1. En el **POS**, navegá con **Tab** y **flechas**.
2. Probá en: cards de producto, links del nav, botones de tabla (Inventario).

- ✅ Esperado: anillo azul visible al navegar por teclado; **sin anillo** con mouse.

### B3. Route transitions
1. Navegá: POS → Jornada → Inventario → Historial.

- ✅ Esperado: **fade + slide corto (~180ms)**; el POS full-bleed no se corta.

---

## C. Área FEEDBACK (toasts, skeletons, empty states — P1)

### C1. Toasts compartidos
1. POS → vendé → toast verde "Venta registrada" (~2s).
2. Inventario → movimiento OK → toast (2.5s).
3. Historial → exportá Excel / guardá → toast (2.5s).
4. Varios toasts seguidos → se apilan ordenados, se pueden cerrar.

- ✅ Esperado: misma apariencia en las 3 páginas, sin duplicados.
- ✅ (a11y) Con screen reader: éxito → "status"; error → "alert".

### C2. Skeletons
1. Recargá con **red lenta** (DevTools → Slow 3G, o máquina lenta).
2. Entrá a Inventario / Productos / Historial / POS (grilla).
3. Refrescá un listado ya cargado (búsqueda POS, filtro Inventario).

- ✅ Esperado: carga inicial muestra "esqueleto" (barras grises), no solo spinner.
- ✅ Esperado: la tabla **queda montada** (sin parpadeo) al refrescar.

### C3. Empty states con icono + acción
1. POS sin buscar → icono búsqueda + mensaje.
2. Jornada sin abrir → icono "event_available" + mensaje.
3. Inventario vacío (admin) → icono "inventory_2" + **botón "Nuevo producto"** funcional.
4. Historial sin jornadas → icono "event_note".

- ✅ Esperado: sin texto gris pelado; cuando hay acción, el botón funciona.

---

## D. Área STOCK UNIT TYPE (cambios de la branch)

### D1. Fallback de unidad corrupta (el fix central)
1. Creá un producto → la unidad se guarda correctamente.
2. Con `unidad_medida` inválido (ej: `KILOGRAMO` no soportado o basura): la app **no crashea**:
   - Inventario: fila/movimientos con sufijo seguro (ej: "u."), nunca error.
   - Cart/POS: `step` del quantity-input usa fallback.
   - Product card: etiqueta de precio no explota.
3. Al editar/crear con unidad válida (`unidad`, `lb`, `gramaje`) → se **coerce** al guardar (sin basura persistida).

### D2. Gramaje / unidades especiales
1. Producto **lb/gramaje** → quantity-input permite decimales (`1.5`, `0.25`).
2. **Sufijo** correcto: `c/u` para "u.", `por lb` para libras.
3. POS: producto no-unidad → paso del stepper + sufijo en carrito correctos (0.5, 1.5…).
4. Inventario: **radio group de unidad** (Unidades/Libras/Gramaje) funciona y persiste.

### D3. Regresión stock × premium (zona del merge)
1. Producto **lb/gramaje** → costo con pipe pesos (`$1.500,00`) Y sufijo de unidad bien en el toast al editar costo.
2. Toast de inventario al guardar → sistema compartido + monto formateado.
3. POS con "u." → `sufijo() === 'u.' ? 'c/u' : 'por lb'` respetado.

---

## E. Área GENERAL / REGRESIÓN

### E1. Instalador
1. Instalá `Tienda - App Setup 0.1.21-beta.exe` (elige directorio, crea accesos escritorio + menú inicio).
2. Abrí la app → Ajustes → versión **0.1.21-beta**.
3. Instalando sobre versión anterior → los datos (SQLocal) **se conservan**.

### E2. Tema + escala de fuente
1. Toggle claro/oscuro en varias páginas (POS, Inventario, Jornada).
2. Ajustes → escala de fuente: **5 niveles** (87.5% → 135%) sin romper layout (POS, tablas).
3. Scrollbars en dark mode → oscuras.

### E3. Suite automática (soporte)
- `node node_modules/@angular/cli/bin/ng.js test --watch=false` → **1134 passed / 2 skipped**, exit 0.

---

**Prioridad:** A1, A3, D1 (críticos) → B1, C1, C3 (valor visible) → resto.