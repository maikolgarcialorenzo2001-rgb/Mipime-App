# Design: fix-auto-cierre-jornada

## Technical Approach

Extraer la recolección de datos + generación de Excel + guardado de `_ejecutarCierre()` a un helper `_generarYGuardarExcel()` reutilizable. `autoCerrarSiOtroUsuario()` llama al helper tras el UPDATE.