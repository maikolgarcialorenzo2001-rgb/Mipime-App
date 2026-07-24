# Delta Spec — gestión-inventario-mejoras

## ADDED Domains

### A. Múltiples jornadas por día (HistorialPage)

**Requirement: A-FR1 — Agrupar jornadas por fecha**

`_jornadasPorFecha` MUST retornar `Map<string, Jornada[]>` agrupando todas las jornadas de una misma fecha en un array.

**Scenario: Dos jornadas mismo día**
- GIVEN el historial tiene 2 jornadas con fecha `2026-06-04`
- WHEN se calcula `_jornadasPorFecha`
- THEN el map contiene `{"2026-06-04" => [j1, j2]}`

**Requirement: A-FR2 — Panel de detalle multi-jornada**

`diaSeleccionado` MUST contener un array de jornadas. El panel de detalle MUST mostrar una tarjeta por cada jornada, cada una con sus propios botones Descargar Excel y Vista Previa.

**Scenario: Click en día con 2 jornadas**
- GIVEN el usuario clickea un día con 2 jornadas
- THEN se muestran 2 tarjetas independientes
- AND cada tarjeta muestra datos de su jornada
- AND cada tarjeta tiene botón Descargar y Vista Previa

**Requirement: A-FR3 — Calendario muestra múltiples badges**

El calendario MUST mostrar un badge por cada jornada del día cuando hay múltiples.

**Scenario: Día con 2 jornadas en calendario**
- GIVEN un día tiene 2 jornadas
- THEN se ven 2 badges de estado en la celda del calendario

---

### B. CRUD productos en InventarioPage

**Requirement: B-FR1 — Modal Nuevo/Editar producto**

InventarioPage MUST tener un modal flotante con campos: nombre, precio_costo, precio_venta, stock_actual. Todos MUST ser obligatorios. El modal MUST reutilizarse para Nuevo (campos vacíos) y Editar (campos precargados).

**Scenario: Crear producto**
- GIVEN el admin clickea "Nuevo producto"
- WHEN completa nombre="Coca", coste=200, precio_venta=500, unidades=10
- AND confirma
- THEN el producto se guarda en DB
- AND la tabla se actualiza

**Scenario: Editar producto**
- GIVEN el admin clickea "Editar" en un producto existente
- THEN el modal se abre con los campos precargados
- WHEN modifica precio_venta y confirma
- THEN el producto se actualiza en DB

**Scenario: Campos vacíos rechazados**
- GIVEN el modal está abierto
- WHEN el admin intenta confirmar con campos vacíos
- THEN el modal MUST mostrar error y no guardar

**Requirement: B-FR2 — Eliminar producto con confirmación**

Cada fila MUST tener botón "Eliminar". Al clickear, MUST mostrar confirmación. Si se confirma, el producto MUST eliminarse de DB. Si se cancela, no pasa nada.

**Requirement: B-FR3 — Columna precio_costo visible**

La tabla de inventario MUST mostrar `precio_costo` como columna visible (solo en inventario por ser admin-only).

---

### C. Hoja Movimientos de Stock en Excel

**Requirement: C-FR1 — Migración DB v6**

`stock_movimientos` MUST agregar columna `jornada_id INTEGER` nullable.

**Requirement: C-FR2 — Hoja en Excel diario**

`generarExcelJornada()` MUST incluir hoja "Stock" con movimientos de stock cuya fecha coincide con la jornada. Columnas: Producto, Tipo, Cantidad, Motivo, Fecha.

**Requirement: C-FR3 — Hoja en Excel mensual**

`generarExcelMensual()` MUST incluir hoja "Movimientos de Stock" consolidando todos los movimientos del rango de fechas.

**Requirement: C-FR4 — Registrar movimientos con jornada_id**

`StockMovimientoService.registrarEntrada/Salida/Ajuste` MUST aceptar `jornada_id?: number` opcional.

---

### D. Exportación por rango de fechas

**Requirement: D-FR1 — Selector de rango en HistorialPage**

HistorialPage MUST tener un botón "Exportar rango" que muestra date pickers para fecha desde / fecha hasta.

**Requirement: D-FR2 — Exportación por rango**

`JornadaService` MUST tener método `generarExportacionPorRango(desde: string, hasta: string)` que genera Excel multi-hoja con todas las jornadas cerradas en ese rango.

**Scenario: Exportar rango válido**
- GIVEN hay jornadas cerradas entre 2026-06-01 y 2026-06-15
- WHEN el usuario selecciona ese rango y confirma
- THEN se descarga un Excel con las jornadas del rango

**Scenario: Sin jornadas en el rango**
- GIVEN no hay jornadas en el rango seleccionado
- WHEN el usuario confirma
- THEN se MUST mostrar error "No hay jornadas en el rango seleccionado"