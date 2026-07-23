# Proposal: C11 — Nuevos Métodos de Pago

## Intent

Agregar 3 nuevos métodos de gestión de pagos que el negocio necesita: Cuenta Cosas (productos retirados por dueños/familia), Divisas (ventas en EUR/USD) y Pendientes (ventas sin cobro). El sistema actual solo soporta efectivo y transferencia.

## Scope

### In Scope
- Migration v6: recrear `ventas` con nuevas columnas + crear tabla `cuenta_cosas`
- Extender `Venta` interface con campos opcionales (divisa_tipo, tasa_cambio, comprador_nombre, autorizado_por, descripcion)
- Checkout modal con 4 opciones de pago y sub-formularios condicionales
- Lógica condicional en VentaService para Pendiente (no afecta total_ventas/saldo_esperado)
- Servicio separado para Cuenta Cosas (no pasa por VentaService)
- JornadaService: consultar cuenta_cosas en cierre
- ExcelService: nuevas filas en Resumen, columna divisa en Ventas, tabla de Cuenta Cosas dentro del Resumen
- StockMovimientoService reutilizado por flujo C.C.

### Out of Scope
- Reportes históricos o dashboard de cuenta_cosas
- Conversión automática de tasa de cambio (siempre manual)
- Edición de ventas pendientes o divisas ya registradas

## Capabilities

### New Capabilities
- `cuenta-cosas`: Gestión de productos retirados por dueños/familia sin registro de venta. Tabla separada, servicio propio, decremento de stock, reporte en Excel con valores negativos.

### Modified Capabilities
- `ventas`: Se extiende para soportar divisas (EUR/USD con tasa de cambio) y pendientes (con comprador, autorizado por). Pendiente no afecta total_ventas ni saldo_esperado.
- `checkout`: Se expande de 2 a 4 opciones de pago con sub-formularios condicionales.
- `excel-reportes`: Resumen agrega tabla de Cuenta Cosas (valores negativos), filas para divisas, pendientes (entre paréntesis). Ventas agrega columnas condicionales.

## Approach

Extender `Venta` con campos opcionales (divisa_tipo, tasa_cambio, comprador_nombre, autorizado_por, descripcion). Crear tabla `cuenta_cosas` separada con su propio servicio. Migration v6 recrea `ventas` (mismo patrón v5) + crea `cuenta_cosas`. Checkout modal emite payload enriquecido. VentaService usa lógica condicional para Pendiente (salta UPDATE jornadas). Cuenta Cosas no pasa por VentaService, llama directo a StockMovimientoService.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `sqlite.service.ts` | Modified | Migration v6: recrear ventas + crear cuenta_cosas |
| `models/venta.ts` | Modified | 5 nuevos campos opcionales |
| `models/cuenta-cosa.ts` | New | Interfaz para tabla cuenta_cosas |
| `models/index.ts` | Modified | Re-exportar nuevo modelo |
| `checkout-modal.component.ts/.html` | Modified | 4 opciones de pago con sub-formularios |
| `pos.page.ts/.html` | Modified | Entry point para Cuenta Cosas |
| `venta.service.ts` | Modified | Lógica condicional para Pendiente |
| `jornada.service.ts` | Modified | Consultar cuenta_cosas en cierre |
| `excel.service.ts` | Modified | Tabla CC en Resumen, filas divisas/pendientes, columnas condicionales en Ventas |
| `stock-movimiento.service.ts` | Unchanged | Reutilizado por flujo C.C. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pendiente afecta saldo_esperado por error | Medium | Test específico que verifica que NO se ejecuta UPDATE jornadas |
| Migration v6 falla en tabla recreada | Low | Mismo patrón probado en v5; test de migración |
| Cuenta Cosas olvida decrementar stock | Medium | Llamada explícita a StockMovimientoService.registrarSalida() en el servicio CC |
| Tasa de cambio inválida (0 o negativa) | Low | Validación en checkout modal + backend |

## Rollback Plan

1. Revertir migration v6: ejecutar `DROP TABLE IF EXISTS cuenta_cosas` y recrear `ventas` desde v5 (CHECK original, sin columnas nuevas)
2. Revertir cambios en checkout modal, VentaService, ExcelService
3. Restaurar modelos y señales a union type original

## Dependencies

- Ninguna externa. Todo es dentro del stack actual (SQLite WASM, Angular, Tailwind).

## Success Criteria

- [ ] Migration v6 ejecuta sin errores y datos existentes se preservan
- [ ] Checkout modal muestra 4 opciones con sub-formularios condicionales funcionales
- [ ] Venta con divisas registra correctamente tipo, tasa, y afecta total_ventas/saldo_esperado
- [ ] Venta pendiente registra sin afectar total_ventas ni saldo_esperado
- [ ] Cuenta Cosas registra en tabla separada y decrementa stock
- [ ] Excel Resumen muestra tabla de Cuenta Cosas (negativo), fila de divisas, y pendientes entre paréntesis
- [ ] Todas las pruebas existentes pasan + nuevas pruebas para cada flujo
- [ ] Rollback: migration v6 reversible sin pérdida de datos

Now persist to Engram:

<｜DSML｜tool_calls>
<｜DSML｜invoke name="engram_mem_save">
<｜DSML｜parameter name="title" string="true">sdd/C11-nuevos-metodos-pago/proposal