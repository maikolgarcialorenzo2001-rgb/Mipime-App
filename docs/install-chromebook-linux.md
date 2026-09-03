# Instalación de Mipime-Cuentas en Chromebook (Linux/Crostini)

> Target: **Chromebook Lenovo 100e 2nd Gen AMD** (modelo 81EE, board `grunt` / `treeya`)
> Release: **main** (`0.1.18`) — build local Linux
> Rol del dispositivo: uso y operación únicamente (no se desarrolla sobre la Chromebook)
> Última actualización: 2026-08-30

---

## 1. Contexto y decisión de plataforma

La app se entrega como binario de escritorio **Electron** corriendo dentro del contenedor
Linux (Crostini) de la Chromebook. Se eligió esta vía sobre el APK de Capacitor porque:

- Reutiliza **exactamente el binario productivo** ya probado en Windows (misma base de datos
  SQLite nativa con `better-sqlite3`, mismo flujo de setup/admin).
- Evita el riesgo abierto del roadmap mobile: `SQLocal`/OPFS en WebView **nunca fue validado**.
- No requiere Android Studio ni cuenta de Google Play Console.

Hardware validado del Lenovo 100e 2nd Gen AMD:

| Recurso | Valor | Implicancia |
|---------|-------|-------------|
| CPU | AMD A4-9120C (x86_64) | AppImage/deb x64 compatible ✔ |
| RAM | 4 GB (soldada) | Justa: cerrar pestañas, correr la app como única app pesada |
| Storage | 32 GB eMMC | Con margen para el contenedor + la app + datos |
| Linux (Crostini) | Soportado oficialmente | ✔ |
| Google Play | Soportado | No necesario para esta vía |
| Pantalla | 11.6" 1366x768, sin touch | La UI desktop funciona con mouse/trackpad |

---

## 2. Posibles errores de compatibilidad y mitigaciones

| # | Riesgo | Probabilidad | Mitigación |
|---|--------|-------------|------------|
| 1 | `better-sqlite3` nativo no carga en Linux | Baja | El módulo usa prebuilds N-API (`npmRebuild: false` ya configurado). Validar en la primera apertura; el contenedor es Debian 12 (glibc reciente) y el prebuild linux-x64 de Electron 43 es compatible. |
| 2 | Sandbox de Chromium falla dentro de Crostini | Baja | Crostini expone user namespaces; normalmente corre sin tocar nada. Si la ventana no abre: relanzar con `--no-sandbox` una vez para confirmar diagnóstico (no dejarlo como solución permanente sin probar antes). |
| 3 | Renderizado por software / ventana lenta | Media | En la Chromebook la GPU se expone por virtio; si la UI se ve lenta, probar con `--disable-gpu` o flags de hardware acceleration desactivada. |
| 4 | RAM insuficiente (4 GB) | Media | ChromeOS + contenedor + Electron es pesado. Operar con pocas pestañas abiertas; medir en la prueba real antes de desplegar a producción. |
| 5 | Pérdida de datos al deshabilitar/resetear Linux | Media | La base de datos vive dentro del contenedor (`~/.config/<product>/*.db`). **Backup manual periódico** de ese archivo (copiar a Google Drive o a "Archivos"). |
| 6 | Artefactos con build metadata truncado | Baja (main no lleva `+`) | Aplica solo a versiones con metadata tipo `0.1.x+Palmar`. La release de main (`0.1.18`) no tiene metadata → artefactos se generan con nombre correcto. |
| 7 | AppImage requiere FUSE | Baja | Por eso el método primario de instalación es el **.deb** (integración directa al launcher). La AppImage queda como fallback. |

---

## 3. Flujo de instalación en la Chromebook

### 3.1 Activar Linux (una sola vez)

1. Abrir **Configuración** de ChromeOS.
2. Ir a **Avanzado → Desarrolladores → Linux (Beta)**.
3. Elegir **Activar** y seguir el asistente (dejar el tamaño de disco por defecto).
4. Esperar a que el contenedor termine de configurarse (aparece la app "Terminal" / Penguín).

> El contenedor consume ~2-3 GB de los 32 GB eMMC. Verificable desde
> Configuración → Avanzado → Desarrolladores → Linux.

### 3.2 Copiar el instalador

1. En la PC de desarrollo (Windows, branch `main`), generar el paquete Linux (ver sección 4).
2. Copiar `release/<producto>.deb` a la Chromebook por **USB** o **Google Drive**.
   - Con USB: insertar el pendrive, abrir la app **Archivos**, y copiar el `.deb` a
     **Mi unidad de Linux** (`Archivos → Linux`), p. ej. `~/Downloads`.

### 3.3 Instalar el paquete

Abrir **Terminal** (Penguín) y ejecutar:

```bash
cd ~/Downloads
sudo dpkg -i <archivo>.deb
```

Si `dpkg` reporta dependencias faltantes (poco probable en el contenedor recién creado):

```bash
sudo apt-get -f install -y
```

### 3.4 Verificar instalación

1. Cerrar la Terminal.
2. En el **launcher** de ChromeOS (tecla `Search`), buscar **"Tienda - App"**.
3. Abrir la app: debe aparecer la ventana de la aplicación con el login/setup inicial.

### 3.5 Validación funcional (primer encendido)

- [ ] Abre la app sin errores de consola.
- [ ] Corre el flujo de setup (creación de admin / datos del comercio).
- [ ] Se puede registrar una jornada y hacer una venta de prueba.
- [ ] La app sigue funcionando **sin conexión a internet**.
- [ ] Reiniciar la Chromebook y abrir la app: los datos persisten.

### Fallback: AppImage

Si el `.deb` fallara o prefirieras no usar `dpkg`, copiar el `*.AppImage` a `~/Downloads`,
abrir Terminal y ejecutar:

```bash
chmod +x ~/Downloads/<archivo>.AppImage
```

Ejecutar la AppImage (`./~/Downloads/<archivo>.AppImage`) o darle doble clic desde Archivos.
Saber que con AppImage el acceso directo en el launcher puede requerir crear un archivo
`.desktop` manualmente.

---

## 4. Generar el build Linux (lado desarrollo)

En la PC de desarrollo, sobre la branch **main** (release `0.1.18`):

```bash
git checkout main
bun install
bun run electron:build:linux
```

Salida esperada en `release/`:

- `<Producto>.AppImage` (si el target AppImage está configurado)
- `<Producto>.deb`

Nota: si se agrega el target `.deb` a `electron-builder.yml` (target `linux`:

```yaml
linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
  category: Finance
  icon: build/icon.png
```

La compilación cruzada Windows → Linux es soportada por electron-builder para estos formatos
sin Docker.

---

## 5. Actualizaciones futuras — PENDIENTE

- **Decisión tomada**: las actualizaciones de la app en la Chromebook serán **manuales**
  (copiar el nuevo `.deb` a la Chromebook e instalar con `dpkg -i`).
- **Sin tocar por ahora**: el cableado de `electron-updater` ya existente en el proyecto
  queda **intacto**; no se modifica ni se remueve en este trabajo.
- **Pendiente**: decidir si más adelante se activan actualizaciones automáticas vía
  `electron-updater` (requiere publicar releases en GitHub u otro canal) o se mantiene el
  flujo manual. Este punto se retoma cuando el equipo lo pida.