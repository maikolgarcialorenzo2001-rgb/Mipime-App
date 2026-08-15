# Neutral Language Specification

## Purpose

Garantizar español neutro en todos los strings visibles de la UI: sin voseo rioplatense y sin errores de concordancia («La acceso», «Error al registro»).

## Requirements

### Requirement: Imperativos neutros en la UI

Ningún string visible de la UI DEBE usar voseo rioplatense. Los siguientes strings DEBEN renderizar su forma neutra:

| Original | Neutro |
|---|---|
| "Contactá al desarrollador." | "Contacte al desarrollador." |
| "Abrí una jornada desde la página de Jornada." | "Abra una jornada desde la página de Jornada." |
| "Seleccioná fecha desde y hasta para exportar." | "Seleccione fecha desde y hasta para exportar." |
| "Iniciá el día en Jornada." | "Inicie el día en Jornada." |
| "Seleccioná la ubicación…" | "Seleccione la ubicación…" |
| "Seleccioná un lote…" | "Seleccione un lote…" |
| "Elegí la ubicación y el lote para el traslado" | "Elija la ubicación y el lote para el traslado" |

#### Scenario: Strings neutros en sus contextos

- GIVEN las páginas historial, inventario, pos y los overlays de error
- WHEN renderizan los strings enumerados
- THEN muestran la forma neutra de la tabla

#### Scenario: Cero voseo en src/

- GIVEN el código fuente de `src/`
- WHEN se buscan imperativos voseo ("Completá", "Seleccioná", "Reducí", "Elegí", "Abrí", "Iniciá", "Contactá", "aumentá")
- THEN no hay coincidencias en strings de UI

### Requirement: Errores gramaticales corregidos

El aviso de sesión expirada DEBE renderizar "El acceso finalizó el {{ fecha }}" (nunca "La acceso"). El fallback de error de registro de jornada DEBE ser "Error al registrar" (nunca "Error al registro").

#### Scenario: ttl-expired con «El acceso»

- GIVEN la sesión expiró
- WHEN ttl-expired renderiza el aviso
- THEN muestra "El acceso finalizó el {{ fecha }}"
- AND nunca contiene "La acceso"

#### Scenario: Error de jornada con infinitivo

- GIVEN falla el registro de la jornada y el error no es una instancia de `Error`
- WHEN jornada muestra el error de formulario
- THEN el mensaje es "Error al registrar"
- AND nunca contiene "Error al registro"
