# Proposal: auth-y-pages-restantes

## Intent

Complete the remaining features of Mipime-Cuentas: auth, admin panel, full POS payment flow, inventory management, jornada close with Excel export, and jornada history. This ships a production-ready POS for small businesses.

## Scope

### In Scope
- Auth system (SHA-256 + salt, session persistence, login page, guards)
- Admin page (CRUD usuarios, role-based access)
- VentaService + complete POS payment (SQL transaction, stock update, jornada totals)
- Inventory page (create products, register stock entries, stock display)
- Jornada close with Excel export (SheetJS, base64 storage in DB)
- History page (closed jornadas list, Excel download and in-app view)
- DB migration v2 (usuarios table, jornada/venta ALTERs, jornada_pdfs table)

### Out of Scope
- Password reset flow
- Email verification
- Multi-tenant / organization support
- Real-time sync or cloud backup
- Dark mode
- E2E tests (integration tests only)

## Approach

Auth first (foundation for admin). Then POS payment + inventory (parallel). Then jornada close + Excel + history (depend on payment flow).

| Component | Approach |
|-----------|----------|
| Auth | Web Crypto API (SHA-256), Signal-based AuthService, localStorage for reload, guards as functions |
| Admin | AdminPageComponent + UsuarioService, adminGuard, CRUD via SQLite |
| POS payment | VentaService.confirmarVenta with SQLite transaction, stock deduction, jornada totals update |
| Inventory | InventarioService + InventoryPageComponent, product + stock entry forms |
| Jornada close | Close modal → saldo_real input → Excel generation → DB storage |
| Excel | SheetJS (xlsx), base64 in jornada_reportes table, in-app preview |
| History | HistoryPageComponent, list closed jornadas, download Excel file or view in-app |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `crypto.subtle` not in jsdom | High | Mock in test setup |
| SQLocal transaction syntax | Medium | Verify with small test before coding |
| SheetJS xlsx bundle size | Low | Dynamic import in ExcelService |

## Dependencies

- `xlsx` (SheetJS, bun add)
- Web Crypto API (browser built-in)
