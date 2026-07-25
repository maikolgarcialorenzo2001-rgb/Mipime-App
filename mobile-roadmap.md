# Mobile Capacitor — Roadmap

> Convierte Mipime-Cuentas en una APK instalable para Android (y iOS).
> Branch: `mobile-capacitor` (separada de `prod-features` que es desktop/Electron)
> Stack: Angular 21 + Capacitor 8.4.2 + SQLocal (SQLite WASM)
> Última actualización: 2026-07-25

---

## Resumen de Fases

| Fase | Estado | Descripción |
|------|--------|-------------|
| **1. Capacitor Setup** | ✅ Completada | Infraestructura base: deps, config, platforms |
| **2. Tablet Breakpoints** | ⏳ Pendiente | Responsive design: nav, POS, grids |
| **3. Touch Optimizations** | ⏳ Pendiente | Tap areas, safe areas, gestures |
| **4. Build & Test APK** | ⏳ Pendiente | Build release, test en emulador/device |

---

## Fase 1: Capacitor Setup ✅

### Completado
- [x] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` (v8.4.2)
- [x] Crear `capacitor.config.ts` con `appId: com.mipime.cuentas`, `webDir: dist/Mipime-Cuentas/browser`
- [x] Agregar scripts a `package.json`: `cap:sync`, `cap:android`, `cap:ios`, `cap:build:android`
- [x] `bunx cap add android` — plataforma Android generada
- [x] `bunx cap add ios` — plataforma iOS generada
- [x] `bunx cap sync` — web assets copiados a ambas plataformas
- [x] `.gitignore` actualizado: `android/` e `ios/` excluidos
- [x] Build Angular: 634 kB (budget warning, non-blocking)
- [x] Commit: `e1d2f50`

### Pendiente (requiere Android Studio)
- [ ] Test SQLocal en WebView del emulador — verificar que OPFS funciona
- [ ] Si OPFS no funciona → evaluar migración a `@capacitor-community/sqlite`

### Archivos modificados/creados
| Archivo | Acción |
|---------|--------|
| `capacitor.config.ts` | Creado |
| `package.json` | Modificado (deps + scripts) |
| `.gitignore` | Modificado (+android, +ios) |
| `bun.lock` | Actualizado |

---

## Fase 2: Tablet Breakpoints ⏳

### Objetivo
Hacer que la UI se adapte a tablets Android (768px-1024px) y móviles (<768px).

### Tareas planificadas
- [ ] Definir breakpoints custom en Tailwind: `tablet: 768px`, `tablet-lg: 1024px`
- [ ] **Nav bar**: Bottom tab bar en móvil/tablet, top bar en desktop
- [ ] **POS page**: Layout apilado en móvil (carrito colapsa), 2 cols en tablet, 3+ en desktop
- [ ] **Carrito**: Modo móvil (drawer/sheet), modo desktop (sidebar fijo)
- [ ] **HistorialPage**: Grid adaptativo (1 col móvil, 2 tablet, 4 desktop)
- [ ] **AdminPage**: Formularios adaptables
- [ ] **InventarioPage**: Tabla responsive (cards en móvil, tabla en desktop)
- [ ] **LoginPage**: Centrado y sizing para tablet

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/styles.css` | Breakpoints custom |
| `src/app/components/layout/app-nav.component.html` | Bottom bar responsive |
| `src/app/pages/pos/pos.page.html` | Layout adaptable |
| `src/app/pages/historial/historial.page.html` | Grid responsive |
| `src/app/pages/admin/admin.page.html` | Forms adaptables |
| `src/app/pages/inventario/inventario.page.html` | Tabla/cards responsive |
| `src/app/pages/jornada/jornada.page.html` | Layout adaptable |
| `src/app/pages/login/login.page.html` | Centering tablet |

---

## Fase 3: Touch Optimizations ⏳

### Objetivo
Optimizar interacción táctil para tablets y móviles.

### Tareas planificadas
- [ ] Tap areas mínimas 44x44px (Apple HIG / Material Design)
- [ ] Bottom safe area para iOS (notch/home indicator)
- [ ] Touch feedback (ripple o highlight en taps)
- [ ] Swipe gestures para carrito (opcional)
- [ ] Pull-to-refresh en historial (opcional)
- [ ] Virtual keyboard handling (input focus, scroll into view)

---

## Fase 4: Build & Test APK ⏳

### Objetivo
Generar APK funcional y verificar en emulador/device real.

### Tareas planificadas
- [ ] `bun run cap:build:android` — build completo
- [ ] Abrir en Android Studio: `bunx cap open android`
- [ ] Test en emulador Android (tablet profile)
- [ ] Verificar SQLocal/OPFS en WebView
- [ ] Verificar offline mode
- [ ] Test en device real (si disponible)
- [ ] Generar APK release firmado
- [ ] (Opcional) Build iOS en macOS

---

## Decisiones Técnicas

| Decisión | Opción A | Opción B | Elegida | Razón |
|----------|----------|----------|---------|-------|
| Runtime nativo | Capacitor | PWA installable | **Capacitor** | Más control, plugins nativos, APK real |
| SQLite en móvil | SQLocal (WASM) | @capacitor-community/sqlite | **SQLocal** (primero) | Misma DB que web/desktop, sin migración. Fallback a plugin nativo si OPFS falla |
| Branch | Mezclar con prod-features | Separada | **Separada** (`mobile-capacitor`) | Desktop (Electron) y mobile (Capacitor) son targets independientes |

---

## Riesgos Conocidos

| Riesgo | Probabilidad | Impacto | Mitigation |
|--------|-------------|---------|------------|
| SQLocal/OPFS no funciona en WebView | Media | Alto | Migrar a `@capacitor-community/sqlite` (plugin nativo) |
| Budget warning (634 kB > 500 kB) | Alta | Bajo | Aumentar budget o lazy load xxl chunks |
| Android Studio no instalado | Variable | Medio | Guiar instalación |
