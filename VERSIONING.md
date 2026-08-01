# Versionado

## Convención

Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH[-prerelease]`

| Entorno | Sufijo | Ejemplo | Cuándo se usa |
|---------|--------|---------|---------------|
| Desarrollo / experimental | `-alpha` | `0.2.0-alpha` | Features en progreso, ramp-up |
| Test / QA | `-beta` | `0.2.0-beta` | Features completas, build para testear |
| Producción | *(ninguno)* | `0.2.0` | Release estable a usuarios finales |

## Reglas

- **Siempre** que se haga un build con cambios o fixes (no importa el entorno), se sube la versión.
- La versión en `package.json` es la fuente de verdad — refleja el último build con cambios.
- Al hacer `git pull`, la versión queda en la que el último que commiteó la dejó. Nadie la "baja".
- Elegir `MAJOR.MINOR.PATCH` según el impacto del cambio:
  - `PATCH` — bug fixes, refactors, cambios menores sin features nuevas.
  - `MINOR` — features nuevas, cambios significativos pero compatibles.
  - `MAJOR` — breaking changes, reescrituras grandes.
- Agregar el sufijo correspondiente al entorno (`-alpha`, `-beta`, o nada).
- Committear el version bump junto con los cambios o en un commit separado con mensaje `chore: bump version to X.Y.Z[-sufijo]`.

## Build

```bash
# Test / QA
npm run electron:build:win    # versión: X.Y.Z-beta

# Producción
# (mismo comando, pero la versión en package.json no lleva sufijo)
```

El nombre del instalador se genera automáticamente como `Tienda - App Setup X.Y.Z[-sufijo].exe`.
