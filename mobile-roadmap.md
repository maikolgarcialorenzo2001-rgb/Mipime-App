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
| **2. Tablet Breakpoints** | ✅ Completada | Responsive design: nav, POS, grids |
| **3. Touch Optimizations** | ✅ Completada | Tap areas, safe areas, touch feedback |
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

## Fase 2: Tablet Breakpoints ✅

### Completado
- [x] **Nav bar**: Bottom tab bar en móvil/tablet (`<lg`), top bar en desktop (`lg+`)
  - Links de navegación se ocultan en móvil, aparecen como iconos en bottom bar
  - Botones de jornada (Iniciar/Cerrar) se compactan en móvil
  - Usuario y logout se ocultan en móvil
- [x] **POS page**: Layout completamente adaptable
  - Móvil: carrito como bottom sheet fijo abajo (max 50vh, handle bar)
  - Tablet (`lg+`: sidebar derecho fijo (w-80/xl:w-96)
  - Product grid: 2 cols → 3 cols (md) → 4 cols (xl) → 5 cols (2xl)
  - Padding responsive: `p-4 sm:p-6`
- [x] **Todas las páginas**: Padding responsive `p-4 sm:p-6`
  - `safe-top` / `safe-bottom` para notch de iOS
  - Títulos responsive: `text-xl sm:text-2xl`
- [x] Build Angular: 640 kB (OK, budget warning)
- [x] Commits: `2bfe4f1`

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/styles.css` | Utility classes `safe-top`/`safe-bottom` |
| `src/app/components/layout/app-nav.component.html` | Bottom tab bar + top bar responsive |
| `src/app/pages/pos/pos.page.html` | Bottom sheet cart + responsive grid |
| `src/app/pages/admin/admin.page.html` | Padding responsive |
| `src/app/pages/historial/historial.page.html` | Padding responsive |
| `src/app/pages/inventario/inventario.page.html` | Padding responsive |
| `src/app/pages/jornada/jornada.page.html` | Padding responsive |
| `src/app/pages/login/login.page.html` | Padding + safe area |
| `src/app/pages/productos/producto.page.html` | Padding responsive |

---

## Fase 3: Touch Optimizations ✅

### Completado
- [x] **Tap areas 44px**: Cart +/- buttons (28px→44px), remove button (24px→40px), quantity input (48px)
- [x] **Touch feedback**: `active:scale-95`/`active:scale-[0.98]` on all interactive elements, `active:bg-*` highlights
- [x] **Product card**: `min-h-[100px]` + `touch-manipulation` for better tap target
- [x] **Checkout modal**: 48px buttons with `active:scale-[0.98]`
- [x] **Global CSS**: `touch-action: manipulation` (no double-tap zoom), `font-size: 16px` on inputs (no iOS zoom), `-webkit-tap-highlight-color: transparent`
- [x] **Safe areas**: `safe-top`/`safe-bottom` for iOS notch/home indicator
- [x] Commit: `20e071d`

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/styles.css` | Touch global CSS, keyboard handling, safe areas |
| `src/app/components/cart-item-row/*.html` | Botones 44px, touch-manipulation |
| `src/app/components/product-card/*.html` | min-h, active feedback |
| `src/app/components/quantity-input/*.html` | 48px buttons, safe-bottom |
| `src/app/components/checkout-modal/*.html` | 48px buttons, active feedback |

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
| Nav bar | Drawer hamburger | Bottom tab bar | **Bottom tab bar** | Estándar en mobile, accesible con pulgar, 5 tabs caben |

---

## Riesgos Conocidos

| Riesgo | Probabilidad | Impacto | Mitigation |
|--------|-------------|---------|------------|
| SQLocal/OPFS no funciona en WebView | Media | Alto | Migrar a `@capacitor-community/sqlite` (plugin nativo) |
| Budget warning (640 kB > 500 kB) | Alta | Bajo | Aumentar budget o lazy load xxl chunks |
| Android Studio no instalado | Variable | Medio | Guiar instalación |
