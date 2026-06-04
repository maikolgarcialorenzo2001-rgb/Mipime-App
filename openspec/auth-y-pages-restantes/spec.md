# Delta Specs: auth-y-pages-restantes

> Change that completes the POS app: auth, admin, full payment flow, inventory, jornada close with PDF, and history.

## Migration v2 (Data Model Changes)

Executed by `SqliteService._migrationV2()` after v1 succeeds.

### New table: `usuarios`
```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### New table: `stock_movimientos`
```sql
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'ajuste')),
  motivo TEXT,
  created_at TEXT NOT NULL
);
```

### New table: `jornada_pdfs`
```sql
CREATE TABLE IF NOT EXISTS jornada_pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
  pdf_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### ALTER existing tables
```sql
ALTER TABLE jornadas ADD COLUMN user_cierre_id INTEGER REFERENCES usuarios(id);
ALTER TABLE ventas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE ventas ADD COLUMN forma_pago TEXT NOT NULL DEFAULT 'efectivo'
  CHECK(forma_pago IN ('efectivo', 'transferencia', 'tarjeta', 'mercadopago'));
```

### Default admin seed
```sql
INSERT INTO usuarios (nombre, email, password_hash, salt, rol, activo, created_at, updated_at)
SELECT 'Admin', 'admin@mipime.com', '<hash>', '<salt>', 'admin', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@mipime.com');
```

## Routes

| Path | Component | Guards | Role Required |
|------|-----------|--------|---------------|
| `/` | redirect → `/jornada` | — | — |
| `/login` | LoginPage | none | — |
| `/jornada` | JornadaPage | authGuard | any |
| `/productos` | ProductosPage | authGuard | any |
| `/pos` | PosPage | authGuard | any |
| `/admin` | AdminPage | authGuard + adminGuard | admin |
| `/inventario` | InventarioPage | authGuard | any |
| `/historial` | HistorialPage | authGuard | any |

## Requirements

### Auth

- **AUTH-1**: Login with email+password, SHA-256+salt via Web Crypto API. Reject invalid credentials (no user enumeration). Reject deactivated users.
- **AUTH-2**: Session persists in Signal + localStorage. Survives page reload. Logout clears both.
- **AUTH-3**: SHA-256 + 16-byte random salt per user.
- **AUTH-4**: Expose `usuario()` Signal and `isLoggedIn()` computed.

### Admin

- **ADMIN-1**: Admin can create workers (nombre, email, password). Reject duplicate email.
- **ADMIN-2**: List all users in a table.
- **ADMIN-3**: Toggle activo/inactive. Cannot deactivate self.

### Ventas (Modified)

- **VENTA-1**: Persist sale in SQL transaction: venta + detalle_ventas INSERT, stock deduction, jornada totals update. Reject if no open jornada or insufficient stock. Rollback on failure.

### Inventory

- **INV-1**: Create product (nombre, precio_venta required). Reject empty nombre or negative price.
- **INV-2**: Register stock entry → stock_movimientos + stock_actual update.
- **INV-3**: Display products with stock info.

### Jornada-PDF (Modified)

- **JOR-1**: Close jornada generates PDF via jsPDF, stores base64 in jornada_pdfs. Auto-download.
- **JOR-2**: Close requires admin role.

### History

- **HIST-1**: List closed jornadas descending.
- **HIST-2**: Download PDF per jornada. Handle missing PDF.

## Test Expectations

| Service | Key tests |
|---------|-----------|
| AuthService | login success/fail/deactivated, logout, session restore, isLoggedIn signal |
| UsuarioService | listar, crear (success + duplicate), toggleActivo (self-guard) |
| VentaService | confirmarVenta success, no jornada, insufficient stock, rollback, cart cleared |
| InventarioService | crearProducto (success + validation), registrarEntrada, listarConStock |
| PdfService | generarPdfJornada returns valid base64 PDF |
| JornadaService | cerrar with admin (pdf stored), cerrar with worker (rejected), obtenerCerradas |
| Guards | authGuard (session yes/no), adminGuard (admin/worker) |
