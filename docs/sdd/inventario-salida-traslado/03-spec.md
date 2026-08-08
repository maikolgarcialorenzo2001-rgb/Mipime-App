# SDD — Spec (delta): `inventario-salida-traslado`

> Artefacto de spec (2026-08-08). Guardado también en Engram (`sdd/inventario-salida-traslado/spec` #531).
> **Estado: COMPLETE** (archivado 2026-08-08) — implementada y verificada APPROVED (45 files / 770 tests, 2 rondas). Requisitos REQ-1..REQ-11 cumplidos.
> **REVISADA (mid-flight)**: cambio de requisito a mitad de vuelo — lote OBLIGATORIO y ubicación de origen OBLIGATORIA, sin opción "FIFO automático". Versión original: lote opcional con FIFO default.

## Capacidad

`inventario-operaciones` (modificada). La salida se renombra comercialmente a "Traslado" y gana: (a) selector de UBICACIÓN DE ORIGEN OBLIGATORIO (Tienda | Almacén) y (b) selector de LOTE OBLIGATORIO filtrado por la ubicación elegida (sin opción "FIFO automático"). La operación subyacente NO cambia en esencia: outflow destructivo, admin-only, Cantidad + Motivo, movimiento `tipo: 'salida'`, método `registrarSalida`.

## Requisitos

| ID | Requisito | Prioridad | Categoría |
|----|-----------|-----------|-----------|
| REQ-1 | El botón del formulario inline (inventario.page.html:88) DEBE mostrar "Traslado" en lugar de "Salida". | Alta | UI |
| REQ-2 | El título del formulario de salida DEBE ser consistente con "Traslado". | Alta | UI |
| REQ-3 | La operación DEBE seguir siendo una salida destructiva de stock (el stock sale del sistema): solo admins, campos Cantidad + Motivo, movimiento `tipo: 'salida'`. | Alta | Núcleo |
| REQ-4 | El formulario DEBE incluir un selector de UBICACIÓN DE ORIGEN OBLIGATORIO: "Tienda" o "Almacén" (mapea a `'shop'` / `'almacen'`). No se puede enviar el formulario sin elegir ubicación. | Alta | Núcleo |
| REQ-5 | El formulario DEBE incluir un selector de LOTE OBLIGATORIO que liste solo los lotes de la ubicación elegida (cantidad > 0). NO DEBE existir la opción "FIFO automático (sin lote)". No se puede enviar sin elegir lote. | Alta | Núcleo |
| REQ-6 | El consumo DEBE aplicar SOLO al lote seleccionado y el movimiento DEBE ser `tipo 'salida'`. NOTA: `stock_movimientos` NO tiene columna `lote_id` (la granularidad de lote queda en el ConsumoRecord devuelto, patrón venta→venta_lotes); la desviación está sancionada por design (migración fuera de scope). | Alta | Núcleo |
| REQ-7 | Si `cantidad > lote.cantidad`, DEBE fallar con error 'Stock insuficiente' y NO consumir nada (sin consumo parcial). | Alta | Error |
| REQ-8 | `registrarSalida` DEBE aceptar el parámetro ADITIVO `loteId?` al final de la firma (default `undefined` → FIFO); los callers existentes (cuenta-cosa, venta) NO DEBEN modificarse. YA IMPLEMENTADO — el change UI lo consume siempre con ubicación + lote. | Alta | Servicio |
| REQ-9 | Solo usuarios admin DEBEN ver el botón/form "Traslado"; no-admin NO DEBEN verlo. | Alta | Seguridad |
| REQ-10 | El botón y operación "A Tienda" NO DEBEN cambiar. | Alta | No-tocar |
| REQ-11 | El chip de historial "Salida" (html:396, muestra `tipo 'salida'`) NO DEBE cambiar. | Media | No-tocar |

## Escenarios (Gherkin)

#### S-01: Admin abre el formulario renombrado
- DADO un admin en InventarioPage con la operación de salida
- CUANDO el admin ve el botón de operación
- ENTONCES el botón DEBE mostrar "Traslado"
- Y el título del formulario DEBE ser consistente ("Traslado")

#### S-02: Ubicación y lote obligatorios — no se puede enviar sin ambos
- DADO el formulario de salida abierto
- CUANDO el admin intenta enviar SIN elegir ubicación o SIN elegir lote
- ENTONCES el envío DEBE estar bloqueado/validado (submit deshabilitado o error)
- Y NO DEBE llamarse a `registrarSalida`

#### S-03: Lote seleccionado en la ubicación elegida con cantidad suficiente
- DADO un producto con lote de tienda `L_tienda` (cantidad 10) y lote de almacén `L_almacen` (cantidad 8), y el admin eligió ubicación "Tienda"
- CUANDO el admin ve el dropdown de lotes
- ENTONCES el dropdown DEBE listar SOLO lotes de tienda (`L_tienda`)
- CUANDO selecciona `L_tienda`, ingresa Cantidad 3 y envía
- ENTONCES el sistema consume SOLO de `L_tienda` (queda 7; `L_almacen` intacto en 8)
- Y `registrarSalida` recibe `(productoId, 3, motivo, undefined, 'shop', loteId_de_L_tienda)`

#### S-04: Cantidad excede al lote → error, sin consumo
- DADO un lote seleccionado con cantidad 10
- CUANDO el admin ingresa Cantidad 15 y envía el formulario
- ENTONCES el sistema falla con error 'Stock insuficiente'
- Y NO se consume stock de ningún lote ni se registra ningún movimiento

#### S-05: No-admin no ve el botón
- DADO un usuario con rol distinto de `admin` en Inventario
- CUANDO el usuario inspecciona el formulario de movimientos
- ENTONCES el botón "Traslado" NO DEBE aparecer (sigue admin-only)

#### S-06: El formulario conserva Cantidad + Motivo
- DADO el formulario de salida renombrado a "Traslado"
- CUANDO se abre
- ENTONCES DEBE seguir mostrando los campos Cantidad y Motivo

#### S-07: "A Tienda" y chip de historial no cambian
- DADO la página de Inventario en estado corriente
- ENTONCES el botón "A Tienda" DEBE seguir visible y funcional para todos los roles
- Y el chip de historial DEBE seguir mostrando "Salida" para movimientos `tipo 'salida'`

#### S-08: Cambiar la ubicación resetea el lote elegido
- DADO el formulario abierto con ubicación "Almacén" y un lote de almacén seleccionado
- CUANDO el admin cambia la ubicación a "Tienda"
- ENTONCES el lote seleccionado DEBE resetearse y el dropdown DEBE refiltrar mostrando solo lotes de tienda

## Nota de copy UI (explícita)
- Etiqueta del botón: **"Traslado"** (español, naming comercial).
- Título del formulario consistente con "Traslado".
- Selector de ubicación: opciones "Tienda" / "Almacén" (obligatorio, sin default).
- Selector de lote: placeholder "Seleccioná un lote…", SOLO lotes de la ubicación elegida con cantidad > 0.
- NO existe la opción "FIFO automático (sin lote)" en el dropdown de lotes.
- El chip del historial sigue **"Salida"** (etiqueta de tipo, NO se renombra).
- "A Tienda" intacto.
