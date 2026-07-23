# Cuenta Cosas Specification

## Purpose

Registrar productos retirados por dueños o familiares sin mediar venta. Es una pérdida aceptable que descuenta stock y se refleja como valores negativos en el Excel de la jornada.

## Requirements

### Requirement: Registrar Cuenta Cosas

El sistema DEBE permitir registrar un retiro de producto con los campos: producto, cantidad, descripción (opcional), autorizado por (obligatorio).

#### Scenario: Registro exitoso

- GIVEN un usuario admin con jornada abierta
- WHEN registra una Cuenta Cosas con producto X, cantidad 2, autorizado por "Juan"
- THEN se inserta un registro en `cuenta_cosas`
- AND se descuenta stock de producto X vía `StockMovimientoService.registrarSalida()`
- AND NO se modifica `total_ventas` ni `saldo_esperado` de la jornada

### Requirement: Stock afectado

El sistema DEBE decrementar `stock_actual` del producto al registrar una Cuenta Cosas.

#### Scenario: Stock insuficiente

- GIVEN un producto con stock_actual = 1
- WHEN se intenta registrar Cuenta Cosas con cantidad 3
- THEN el sistema DEBE rechazar la operación con error "Stock insuficiente"

### Requirement: Excel

El sistema DEBE incluir una tabla "Cuenta Cosas" en la hoja Resumen del Excel con valores negativos.

#### Scenario: Tabla en Resumen

- GIVEN una jornada con 2 registros de Cuenta Cosas
- WHEN se genera el Excel de cierre
- THEN la hoja Resumen contiene una sección "Cuenta Cosas" con columnas Producto, Cantidad, Descripción, Autorizado por
- AND los montos totales se muestran como valores negativos