# Design: C11 — Nuevos Métodos de Pago

## Technical Approach

Extender `ventas` con columnas opcionales (migration v6, patrón CREATE→INSERT SELECT→DROP→RENAME de v5). Crear tabla `cuenta_cosas` separada. Checkout modal pasa de 2 a 5 opciones con sub-formularios condicionales. `VentaService` aplica lógica condicional para Pendiente (salta UPDATE jornadas). Cuenta Cosas tiene servicio propio que reutiliza `StockMovimientoService`. PosPage rutea al servicio según `formaPago` recibido del modal.

## Architecture Decisions

### Migration v6

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| CHECK expandido | SQLite no soporta ALTER CHECK; recrear tabla | Recrear `ventas` con CHECK `('efectivo','transferencia','divisas','pendiente')` + columnas nuevas. Patrón identical a v5. |
| Sin CHECK (validación app) | Menos seguridad en DB | Rechazado — inconsistente con v1-v5. |

### Cuenta Cosas

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Tabla separada | Modelo limpio, sin impacto en ventas | **Elegido** — no es una venta, no toca jornadas. |
| Flag en ventas | Contamina `total_ventas`, confunde reportes | Rechazado — viola semántica del negocio. |

### Checkout Output

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Objeto plano con opcionales | Un solo output type, campos según forma_pago | **Elegido** — `{ formaPago: string, divisaTipo?, tasaCambio?, compradorNombre?, autorizadoPor?, descripcion? }` |
| Discriminated union | TypeScript estricto, más boilerplate | Rechazado — los campos opcionales alcanzan y simplifican el consumo en PosPage. |

## Data Flow

```
PosPage → CheckoutModal (5 opciones + sub-formularios)
           │
           ├── 'efectivo'|'transferencia'
           │   └── VentaService.registrar()
           │       ├── INSERT ventas (+ detalle_ventas, stock)
           │       └── UPDATE jornadas (total_ventas+=total, saldo_esperado+=total)
           │
           ├── 'divisas'
           │   └── VentaService.registrar() con divisa_tipo, monto_divisa, tasa_cambio
           │       ├── total = monto_divisa * tasa_cambio (en ARS)
           │       ├── INSERT ventas (+ detalle_ventas, stock)
           │       └── UPDATE jornadas (total_ventas+=total, saldo_esperado+=total)
           │
           ├── 'pendiente'
           │   └── VentaService.registrar() condicional
           │       ├── INSERT ventas (+ detalle_ventas, stock)
           │       └── salta UPDATE jornadas
           │
           └── 'cuenta_cosas'
               └── CuentaCosasService.registrar()
                   ├── INSERT INTO cuenta_cosas
                   └── StockMovimientoService.registrarSalida()
```

## File Changes

| File | Acción | Descripción |
|------|--------|-------------|
| `src/app/services/sqlite.service.ts` | Modificar | Migration v6: recrear `ventas` + CREATE `cuenta_cosas` |
| `src/app/models/venta.ts` | Modificar | 5 optional fields nuevos |
| `src/app/models/cuenta-cosa.ts` | Crear | Interfaz `CuentaCosa` |
| `src/app/models/index.ts` | Modificar | Re-exportar `CuentaCosa` |
| `src/app/services/cuenta-cosa.service.ts` | Crear | Lógica CC (INSERT + stock salida) |
| `src/app/services/venta.service.ts` | Modificar | `registrar()` acepta objeto; método `_ejecutar` condicional |
| `src/app/components/checkout-modal/checkout-modal.component.ts` | Modificar | Output type expandido, 5 opciones, sub-formularios |
| `src/app/components/checkout-modal/checkout-modal.component.html` | Modificar | 5 botones + forms condicionales (divisa_tipo/tasa_cambio, comprador/autorizado/descripcion, CC: descripcion/autorizado_por) |
| `src/app/pages/pos/pos.page.ts` | Modificar | `confirmarVenta` recibe payload, rutea a VentaService o CuentaCosasService según `formaPago` |
| `src/app/services/jornada.service.ts` | Modificar | `_ejecutarCierre` y `_recolectarDatosJornada` consultan `cuenta_cosas` |
| `src/app/services/excel.service.ts` | Modificar | Resumen: tabla CC, fila divisas, fila pendientes (paréntesis). Ventas: columnas condicionales. |

## Interfaces / Contracts

```ts
// venta.ts — nuevos campos opcionales
export interface Venta {
  id: number;
  jornada_id: number;
  fecha_hora: string;
  total: number;            // ARS (total = monto_divisa * tasa_cambio cuando divisas)
  usuario_id: number | null;
  forma_pago: string;      // 'efectivo' | 'transferencia' | 'divisas' | 'pendiente'
  divisa_tipo?: 'EUR' | 'USD';
  monto_divisa?: number;   // cuánta divisa entregó el comprador
  tasa_cambio?: number;    // 1 divisa = X ARS
  comprador_nombre?: string;
  autorizado_por?: string;
  descripcion?: string;
  created_at: string;
}

// cuenta-cosa.ts
export interface CuentaCosa {
  id: number;
  jornada_id: number;
  producto_id: number;
  cantidad: number;
  descripcion: string | null;
  autorizado_por: string;
  created_at: string;
}

// checkout-modal output — campos planos opcionales (no discriminated union)
export interface CheckoutPayload {
  formaPago: string;
  divisaTipo?: 'EUR' | 'USD';
  montoDivisa?: number;    // cuánta divisa entrega el comprador
  tasaCambio?: number;     // 1 divisa = X ARS
  compradorNombre?: string;
  autorizadoPor?: string;
  descripcion?: string;
}
```

### Migration v6 SQL (patrón exacto)

```sql
BEGIN TRANSACTION;

CREATE TABLE ventas_v6 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
  fecha_hora TEXT NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  forma_pago TEXT NOT NULL DEFAULT 'efectivo'
    CHECK(forma_pago IN ('efectivo','transferencia','divisas','pendiente')),
  divisa_tipo TEXT,
  monto_divisa REAL,
  tasa_cambio REAL,
  comprador_nombre TEXT,
  autorizado_por TEXT,
  descripcion TEXT
);

INSERT INTO ventas_v6 SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago, NULL, NULL, NULL, NULL, NULL, NULL FROM ventas;

DROP TABLE ventas;
ALTER TABLE ventas_v6 RENAME TO ventas;

CREATE TABLE cuenta_cosas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  descripcion TEXT,
  autorizado_por TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO schema_version (version) VALUES (6);

COMMIT;
```

## Testing Strategy

| Layer | Qué probar | Cómo |
|-------|-----------|------|
| Unit | Migration v6 preserva datos v5 | Mock SQLite, ejecutar v5→v6, verificar registros |
| Unit | VentaService: divisas calcula total = monto * tasa | Mock DB, verificar total = 3*650=1950 y UPDATE jornadas |
| Unit | VentaService: pendiente NO actualiza jornada | Mock DB, verificar UPDATE jornadas NO llamado |
| Unit | CuentaCosasService: INSERT + stock salida | Mock DB, verificar ambas queries |
| Unit | CheckoutModal: sub-formularios condicionales | Test cada forma_pago renderiza/oculta campos |
| Integration | Cierre jornada incluye CC en Excel | Flujo real con datos semilla |
| Unit | Excel: Resumen contiene filas divisas/pendientes/CC | Data mock + verificar output |

## Migration / Rollout

Migration v6 se ejecuta automáticamente en `initialize()` como v1-v5. Rollback: recrear `ventas` desde v5 (sin columnas nuevas) y `DROP TABLE cuenta_cosas`.

## Open Questions

Ninguna. Diseño completo basado en explore + proposal.