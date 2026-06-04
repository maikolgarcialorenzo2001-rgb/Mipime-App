# Tasks: auth-y-pages-restantes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2000 |
| 400-line budget risk | High |
| Delivery strategy | ask-on-risk → feature-branch-chain |
| Chain strategy | feature-branch-chain (feature/auth-y-pages) |

## Dependency Graph

```
Phase 1: 1.1  1.2
           ↘    ↓
1.3 → 1.4 → 1.5 → 1.6
 ↓
Phase 2: 2.1    2.2 → 2.3
          ↓
Phase 3: 3.1 → 3.2    3.3 → 3.4
          ↓
Phase 4: 4.1 → 4.2 → 4.3 → 4.4
                     ↓
                    4.5
```

## Distribution

| Person | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|--------|---------|---------|---------|---------|-------|
| **Tú (P1)** | 1.1, 1.2, 1.3 | 2.1 | 3.1, 3.2 | 4.1, 4.2, 4.5 | **9 tasks** |
| **Compañero (P2)** | 1.4, 1.5, 1.6 | 2.2, 2.3 | 3.3, 3.4 | 4.3, 4.4 | **9 tasks** |

### Parallelizable blocks
- Phase 1: 1.1-1.3 (P1) & 1.4-1.6 (P2, starts after 1.3)
- Phase 2 & 3: fully parallel between P1 and P2
- Phase 4: 4.1+4.2+4.5 (P1) & 4.3+4.4 (P2, starts after 4.2)

---

## Phase 1: Foundation (Migration + Auth)

- [x] **1.1 [P1][M]** Migration v2 in SqliteService — add usuarios, stock_movimientos, jornada_pdfs tables, ALTER jornadas/ventas, seed admin
- [x] **1.2 [P1][S]** Create `models/usuario.ts` — Usuario interface
- [x] **1.3 [P1][L]** AuthService — login (SHA-256+salt), logout, Signal session, localStorage restore
- [x] **1.4 [P2][S]** Guards: `auth.guard.ts` + `admin.guard.ts`
- [x] **1.5 [P2][S]** Update `app.routes.ts` — add all routes with guards
- [x] **1.6 [P2][M]** Update `app.ts` — conditional nav, logout button

**Tests**: AuthService login/logout/session/guard redirects

---

## Phase 2: Admin + Login Page

- [ ] **2.1 [P1][M]** LoginPage — email+password form, wire AuthService, error display, redirect
- [ ] **2.2 [P2][M]** UsuarioService — listar(), crear() with duplicate check, toggleActivo()
- [ ] **2.3 [P2][L]** AdminPage — user table, create worker form, toggle activo

**Tests**: Login redirect/error, UsuarioService CRUD, AdminPage renders/deactivates

---

## Phase 3: POS + Inventory

- [ ] **3.1 [P1][L]** VentaService — confirmarVenta() SQL transaction (INSERT venta+detalle, UPDATE stock, UPDATE jornada)
  - [x] Block 1: Model + StockMovimientoService + VentaService integration
- [ ] **3.2 [P1][M]** PosPage — wire confirmarVenta(), forma_pago selector, error handling
- [ ] **3.3 [P2][M]** InventarioService — crearProducto(), registrarEntrada(), listarConStock()
- [ ] **3.4 [P2][L]** InventarioPage — product form, stock entry form, inventory table

**Tests**: Venta transaction success/fail, Inventario validation/stock

---

## Phase 4: Jornada Close + Excel + History

- [ ] **4.1 [P1][S]** Install `xlsx` (SheetJS, bun add xlsx)
- [ ] **4.2 [P1][M]** ExcelService — generarExcelJornada() base64 xlsx with ventas + movimientos
- [x] **4.3 [P1][M]** JornadaService — cerrar() with Excel generation + storage (jornada_reportes), admin check
- [x] **4.4 [P1][M]** JornadaPage — close modal, admin-only button, auto-download Excel, in-app preview
- [ ] **4.5 [P1][M]** HistorialPage — list closed jornadas, download Excel, in-app view, empty state

**Tests**: ExcelService valid xlsx, JornadaService admin/worker, HistorialPage list/download/preview
