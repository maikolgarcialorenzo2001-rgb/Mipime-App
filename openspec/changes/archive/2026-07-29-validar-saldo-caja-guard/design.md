# Design: validar-saldo-caja-guard

## Technical Approach

Dual validation — **UI guard** (reactive signal check, instant feedback) + **Service guard** (transactional SELECT-check, prevents inconsistent state). Shared helper `saldoSuficientePara(monto)` en JornadaService usado por ambos layers.

## Architecture Decisions

### Decision: `saldoSuficientePara()` como método de JornadaService

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Helper standalone | Sin DI, pero necesita acceso a `totalEnCaja` signal y `_db` | ❌ |
| Helper en JornadaService | Un solo dueño del estado de caja, reutilizable por UI y service guard | ✅ |

**Rationale**: `totalEnCaja()` ya vive en JornadaService. El service guard necesita leer `saldo_esperado` desde DB (misma conexión). Un solo helper evita duplicación.

### Decision: CheckoutModal recibe `saldoEnCaja` como input en vez de injectar JornadaService

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inyectar JornadaService | Acopla checkout-modal al service, rompe atomic design | ❌ |
| Input binding | CheckoutModal sigue siendo puro, POSPage orquesta | ✅ |

**Rationale**: CheckoutModal es presentacional. POSPage ya injecta JornadaService y pasa los datos. Esto mantiene la separación container/presentational.

### Decision: VentaService guard dentro de la transacción existente

El service guard en `VentaService._ejecutar` hace `SELECT saldo_esperado` **después de BEGIN TRANSACTION** y antes del UPDATE. Así la transacción serializa la lectura + escritura. En `_registrarMovimientoAsync` (sin transacción actual), el SELECT se hace antes del INSERT/UPDATE — SQLite serializado hace seguro el read-then-write.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ UI GUARD PATH                                                  │
│                                                                 │
│  User click → JornadaPage/PosPage                              │
│    → saldoSuficientePara(monto) → totalEnCaja() signal         │
│    → monto > 0 && es egreso? → monto > totalEnCaja()?          │
│      ├─ No:  botón habilitado, permite submit                  │
│      └─ Sí:  botón [disabled], tooltip "Saldo insuficiente"    │
│                                                                 │
│ SERVICE GUARD PATH                                              │
│                                                                 │
│  Llega request (sin pasar por UI)                              │
│    → _registrarMovimientoAsync / _ejecutar                     │
│    → SELECT saldo_esperado FROM jornadas WHERE id = ?          │
│    → monto_egreso > saldo_esperado?                            │
│      ├─ No:  proceed con INSERT/UPDATE                         │
│      └─ Sí:  throw SaldoInsuficienteError                      │
│               → caller catch → toast con mensaje               │
└─────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/jornada.service.ts` | Modify | Agregar `saldoSuficientePara()`, guard en `_registrarMovimientoAsync` |
| `src/app/services/venta.service.ts` | Modify | Guard transaccional en `_ejecutar` para vuelto divisa |
| `src/app/pages/jornada/jornada.page.ts` | Modify | UI check con computed basado en `saldoSuficientePara()` |
| `src/app/pages/pos/pos.page.ts` | Modify | Pasar `saldoEnCaja` a checkout-modal, computed para deshabilitar confirm |
| `src/app/components/checkout-modal/checkout-modal.component.ts` | Modify | Input `saldoEnCaja` + computed para validar vuelto |
| `src/app/services/jornada.service.spec.ts` | Modify | Tests para `saldoSuficientePara()` y guard |
| `src/app/services/venta.service.spec.ts` | Modify | Tests para guard en `_ejecutar` |
| `src/app/pages/jornada/jornada.page.spec.ts` | Modify | Tests UI check |
| `src/app/pages/pos/pos.page.spec.ts` | Modify | Tests UI check divisa |
| `src/app/components/checkout-modal/checkout-modal.component.spec.ts` | Modify | Tests con input `saldoEnCaja` |

## Interfaces / Contracts

### Shared helper (JornadaService)

```typescript
/**
 * Verifica si el saldo en caja alcanza para un monto de egreso.
 * @param monto - Monto a verificar (debe ser > 0 para egresos)
 * @returns true si saldo >= monto (o monto <= 0 → true, ingresos no se bloquean)
 */
saldoSuficientePara(monto: number): boolean {
  if (monto <= 0) return true; // ingresos o monto cero siempre permitidos
  return this.totalEnCaja() >= monto;
}
```

### Service guard pattern

```typescript
// En _registrarMovimientoAsync (antes del INSERT):
const rows = await this._db.sql<{ saldo_esperado: number }>(
  'SELECT saldo_esperado FROM jornadas WHERE id = ?',
  [jornadaId],
);
const saldoActual = rows[0]?.saldo_esperado ?? 0;
if (saldoActual - monto < 0) {
  throw new Error(`Saldo insuficiente: $${saldoActual} < $${monto}`);
}

// En _ejecutar (VentaService, después de BEGIN TRANSACTION):
const rows = await this._db.sql<{ saldo_esperado: number }>(
  'SELECT saldo_esperado FROM jornadas WHERE id = ?',
  [jornadaId],
);
const saldoActual = rows[0]?.saldo_esperado ?? 0;
const vuelto = Math.max(0, (payload.billeteRecibido ?? 0) * (payload.tasaCambio ?? 0) - total);
if (vuelto > 0 && saldoActual < vuelto) {
  throw new Error(`Saldo insuficiente para vuelto: $${saldoActual} < $${vuelto}`);
}
```

### CheckoutModal input

```typescript
// Nuevo input:
readonly saldoEnCaja = input<number>(0);

// Computed para deshabilitar confirm divisa:
readonly saldoInsuficienteVuelto = computed(() => {
  if (this.formaPago() !== 'divisas') return false;
  const v = this.vuelto();
  return v != null && v > 0 && this.saldoEnCaja() < v;
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `saldoSuficientePara()` — monto=0, negativo, exacto, insuficiente | Mock `totalEnCaja` signal en TestBed, assert boolean return |
| Unit | Guard en `_registrarMovimientoAsync` — saldo suficiente, insuficiente, borde exacto | Mock `_db.sql` para controlar `saldo_esperado` retornado, assert throw vs success |
| Unit | Guard en `_ejecutar` — venta divisa con vuelto, sin vuelto, vuelto exacto | Mock `_db.sql` chain (BEGIN, SELECT, INSERT, UPDATE, COMMIT), assert throw en SELECT |
| Unit | CheckoutModal `saldoInsuficienteVuelto` computed | Set input `saldoEnCaja`, cambiar formaPago/billete, assert computed |
| Unit | JornadaPage UI computed deshabilitado | Set totalEnCaja signal via service, assert botón disabled estado |

### Edge Cases

- `monto = 0` → `saldoSuficientePara()` retorna `true`
- `monto < 0` → `saldoSuficientePara()` retorna `true` (no es egreso)
- `saldo_esperado = monto` → guard permite (condición `>=`)
- Venta divisa sin vuelto (pago exacto) → guard salta (vuelto = 0)
- Venta divisa con completacionEfectivo pero vuelto=0 → ok
- `saldo_esperado = NULL` en DB → tratado como 0

## Migration / Rollout

No migration required. Cambio puramente lógico — no hay cambios de schema ni datos. Rollback: revert commits.

## Open Questions

Ninguno.
