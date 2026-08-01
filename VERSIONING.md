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

## Sincronización automática (version-sync-feature, 0.1.12-beta)

**La versión en `package.json` es la ÚNICA fuente de verdad.** Ya no se edita
nada a mano: ni el `<title>` del `index.html`, ni la versión que se ve en la
app, ni el nombre del instalador. Todo se deriva solo en el build.

### Subir versión

```bash
# Automático: sube 0.1.12-beta → 0.1.13-beta (preserva el sufijo -beta)
npm run version:bump

# Manual: editar package.json y luego regenerar artifacts
npm run sync:version
```

`npm run version:bump` incrementa el último número y preserva el sufijo
(`0.1.12-beta` → `0.1.13-beta`). No se necesita decir qué número.

### Qué se sincroniza

| Superficie | Cómo se entera |
|------------|----------------|
| Instalador (`Tienda - App Setup X.Y.Z-beta.exe`) | electron-builder lee `package.json` (siempre fue así) |
| Title de la ventana/tab | `src/main.ts` setea `document.title` desde `APP_VERSION` al bootstrap |
| Badge de versión en el nav | `app-nav.component.ts` muestra `v{APP_VERSION}` |
| `<title>` del `index.html` | `scripts/sync-version.mjs` lo actualiza en cada build |

### Archivos del sistema

| Archivo | Rol |
|---------|-----|
| `scripts/sync-version.mjs` | Lee `package.json#version` → genera `src/app/version.ts` + actualiza `index.html` |
| `scripts/bump-version.mjs` | Incrementa la versión beta y corre `sync-version` |
| `src/app/version.ts` | GENERADO — exporta `APP_VERSION`, no editar a mano |
| `package.json` scripts | `prebuild` / `prestart` corren `sync-version` automáticamente |

**Nota para el equipo:** el sufijo distingue entorno, no configuración Angular.
Un build `-beta` usa el mismo `environment.prod.ts` que producción; la
diferencia es solo el número de versión.

## Build

```bash
# Test / QA
npm run electron:build:win    # versión: X.Y.Z-beta

# Producción
# (mismo comando, pero la versión en package.json no lleva sufijo)
```

El nombre del instalador se genera automáticamente como `Tienda - App Setup X.Y.Z[-sufijo].exe`.
