import { environment } from '../environments/environment';

/**
 * Ejecutor de SQL que abstrae el driver concreto (SQLocal en web,
 * IPC nativo en Electron). Recibe query + parámetros posicionales.
 */
export interface MigrationExecutor {
  sql<T>(query: string, params?: unknown[]): Promise<T[]>;
}

export interface RunMigrationsOptions {
  seedEnabled: boolean;
}

/**
 * Runner compartido de migraciones v1–v16 + seed condicional.
 * Mismo SQL exacto para ambos drivers (web y native); solo cambia
 * la capa de ejecución.
 */
export async function runMigrations(
  exec: MigrationExecutor,
  opts: RunMigrationsOptions,
): Promise<void> {
  // Runner autocontenido: crea schema_version él mismo (M2). Antes solo
  // funcionaba en web porque SqliteService.initialize() creaba la tabla
  // aparte; la ruta fresh de adoptOrFresh (T4) fallaba en el primer arranque.
  await exec.sql(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )`);

  const rows = await exec.sql<{ version: number }>(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_version',
  );
  const currentVersion = rows[0]?.version ?? 0;

  if (currentVersion < 1) {
    await migrationV1(exec);
  }

  if (currentVersion < 2) {
    await migrationV2(exec);
  }

  if (currentVersion < 3) {
    await migrationV3(exec);
  }

  if (currentVersion < 4) {
    await migrationV4(exec);
  }

  if (currentVersion < 5) {
    await migrationV5(exec);
  }

  if (currentVersion < 6) {
    await migrationV6(exec);
  }

  if (currentVersion < 7) {
    await migrationV7(exec);
  }

  if (currentVersion < 8) {
    await migrationV8(exec);
  }

  if (currentVersion < 9) {
    await migrationV9(exec);
  }

  if (currentVersion < 10) {
    await migrationV10(exec);
  }

  if (currentVersion < 11) {
    await migrationV11(exec);
  }

  if (currentVersion < 12) {
    await migrationV12(exec);
  }

  if (currentVersion < 13) {
    await migrationV13(exec);
  }

  if (currentVersion < 14) {
    await migrationV14(exec);
  }

  if (currentVersion < 15) {
    await migrationV15(exec);
  }

  if (currentVersion < 16) {
    await migrationV16(exec);
  }

  if (currentVersion < 17) {
    await migrationV17(exec);
  }

  if (opts.seedEnabled) {
    await seedIfEmpty(exec);
  }
}

async function migrationV1(exec: MigrationExecutor): Promise<void> {
  await exec.sql(`CREATE TABLE IF NOT EXISTS jornadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    hora_apertura TEXT NOT NULL,
    monto_inicial REAL NOT NULL DEFAULT 0,
    hora_cierre TEXT,
    total_ventas REAL NOT NULL DEFAULT 0,
    total_gastos REAL NOT NULL DEFAULT 0,
    saldo_esperado REAL NOT NULL DEFAULT 0,
    saldo_real REAL,
    estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta', 'cerrada')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_venta REAL NOT NULL,
    precio_costo REAL,
    stock_actual REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    fecha_hora TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    tipo TEXT NOT NULL CHECK(tipo IN ('gasto', 'ingreso_extra', 'compra_divisa')),
    descripcion TEXT NOT NULL,
    monto REAL NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await exec.sql('INSERT INTO schema_version (version) VALUES (1)');
}

async function migrationV2(exec: MigrationExecutor): Promise<void> {
  await exec.sql(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS stock_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'ajuste', 'merma')),
    motivo TEXT,
    created_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS jornada_reportes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    content_type TEXT NOT NULL DEFAULT 'excel',
    content_base64 TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  // ALTER TABLEs con try/catch por si la columna ya existe
  for (const q of [
    'ALTER TABLE jornadas ADD COLUMN user_cierre_id INTEGER REFERENCES usuarios(id)',
    'ALTER TABLE ventas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)',
    `ALTER TABLE ventas ADD COLUMN forma_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK(forma_pago IN ('efectivo', 'transferencia', 'tarjeta', 'mercadopago'))`,
  ]) {
    try { await exec.sql(q); } catch { /* columna ya existe */ }
  }

  // Seed admin: solo si no existe (parte de v2, no depende de seedEnabled)
  const [{ count }] = await exec.sql<{ count: number }>(
    "SELECT COUNT(*) AS count FROM usuarios WHERE nombre = ?",
    [environment.adminUser],
  );
  if (count === 0) {
    const ahora = new Date().toISOString();
    const { generateSalt, hashPassword } = await import('./hash-password');
    const salt = generateSalt();
    const hash = await hashPassword(environment.adminPassword, salt);
    await exec.sql(
      `INSERT INTO usuarios (nombre, password_hash, salt, rol, activo, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 1, ?, ?)`,
      [environment.adminUser, hash, salt, ahora, ahora],
    );
  }

  await exec.sql('INSERT INTO schema_version (version) VALUES (2)');
}

async function migrationV3(exec: MigrationExecutor): Promise<void> {
  // Eliminar columna email de usuarios (ya no se usa para login).
  // Usamos recreación de tabla (compatible con TODAS las versiones
  // de SQLite, a diferencia de DROP COLUMN que requiere 3.35+).
  const columns = await exec.sql<{ name: string }>(
    'PRAGMA table_info(usuarios)',
  );
  const hasEmail = columns.some((c) => c.name === 'email');
  if (hasEmail) {
    await exec.sql('BEGIN TRANSACTION');
    await exec.sql(`CREATE TABLE usuarios_v3 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await exec.sql(`INSERT INTO usuarios_v3
      SELECT id, nombre, password_hash, salt, rol, activo, created_at, updated_at
      FROM usuarios`);
    await exec.sql('DROP TABLE usuarios');
    await exec.sql('ALTER TABLE usuarios_v3 RENAME TO usuarios');
    await exec.sql('COMMIT');
  }

  await exec.sql('INSERT INTO schema_version (version) VALUES (3)');
}

async function migrationV4(exec: MigrationExecutor): Promise<void> {
  // Reparación: si la columna email aún existe (v3 falló en algunos entornos),
  // la eliminamos mediante recreación de tabla.
  const columns = await exec.sql<{ name: string }>(
    'PRAGMA table_info(usuarios)',
  );
  const hasEmail = columns.some((c) => c.name === 'email');
  if (hasEmail) {
    await exec.sql('BEGIN TRANSACTION');
    await exec.sql(`CREATE TABLE usuarios_v4 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await exec.sql(`INSERT INTO usuarios_v4
      SELECT id, nombre, password_hash, salt, rol, activo, created_at, updated_at
      FROM usuarios`);
    await exec.sql('DROP TABLE usuarios');
    await exec.sql('ALTER TABLE usuarios_v4 RENAME TO usuarios');
    await exec.sql('COMMIT');
  }

  await exec.sql('INSERT INTO schema_version (version) VALUES (4)');
}

async function migrationV5(exec: MigrationExecutor): Promise<void> {
  // Recrear ventas con CHECK(forma_pago) actualizado a solo efectivo/transferencia
  await exec.sql('BEGIN TRANSACTION');
  await exec.sql(`CREATE TABLE ventas_v5 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    fecha_hora TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    forma_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK(forma_pago IN ('efectivo', 'transferencia'))
  )`);
  await exec.sql(`INSERT INTO ventas_v5
    SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago
    FROM ventas`);
  await exec.sql('DROP TABLE ventas');
  await exec.sql('ALTER TABLE ventas_v5 RENAME TO ventas');
  await exec.sql('INSERT INTO schema_version (version) VALUES (5)');
  await exec.sql('COMMIT');
}

async function migrationV6(exec: MigrationExecutor): Promise<void> {
  await exec.sql('BEGIN TRANSACTION');
  await exec.sql(`CREATE TABLE ventas_v6 (
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
  )`);
  await exec.sql(`INSERT INTO ventas_v6
    SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago,
      NULL, NULL, NULL, NULL, NULL, NULL
    FROM ventas`);
  await exec.sql('DROP TABLE ventas');
  await exec.sql('ALTER TABLE ventas_v6 RENAME TO ventas');
  await exec.sql(`CREATE TABLE cuenta_cosas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    descripcion TEXT,
    autorizado_por TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await exec.sql('INSERT INTO schema_version (version) VALUES (6)');
  await exec.sql('COMMIT');
}

async function migrationV7(exec: MigrationExecutor): Promise<void> {
  // ALTER TABLE con try/catch por si la columna ya existe
  try {
    await exec.sql(
      'ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id)',
    );
  } catch { /* columna ya existe */ }

  await exec.sql('INSERT INTO schema_version (version) VALUES (7)');
}

async function migrationV8(exec: MigrationExecutor): Promise<void> {
  await exec.sql(`CREATE TABLE IF NOT EXISTS lotes_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    precio_costo REAL NOT NULL,
    fecha_ingreso TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await exec.sql(`CREATE TABLE IF NOT EXISTS venta_lotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id),
    lote_id INTEGER NOT NULL REFERENCES lotes_stock(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    precio_costo_real REAL NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await exec.sql(
    'CREATE INDEX IF NOT EXISTS idx_lotes_stock_producto_fecha ON lotes_stock(producto_id, fecha_ingreso)',
  );

  await exec.sql(
    'CREATE INDEX IF NOT EXISTS idx_venta_lotes_venta ON venta_lotes(venta_id)',
  );

  // Backfill: crear lotes para productos existentes con stock > 0
  await exec.sql(`INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
    SELECT id, stock_actual, COALESCE(precio_costo, 0), created_at, created_at
    FROM productos
    WHERE stock_actual > 0`);

  await exec.sql('INSERT INTO schema_version (version) VALUES (8)');
}

async function migrationV9(exec: MigrationExecutor): Promise<void> {
  // ALTER TABLEs con try/catch por si la columna ya existe
  for (const q of [
    'ALTER TABLE jornadas ADD COLUMN user_apertura_id INTEGER REFERENCES usuarios(id)',
    'ALTER TABLE stock_movimientos ADD COLUMN costo_total REAL DEFAULT 0',
    'ALTER TABLE jornadas ADD COLUMN total_merma REAL DEFAULT 0',
  ]) {
    try { await exec.sql(q); } catch { /* columna ya existe */ }
  }

  await exec.sql('INSERT INTO schema_version (version) VALUES (9)');
}

async function migrationV10(exec: MigrationExecutor): Promise<void> {
  // Recrear stock_movimientos con CHECK constraint actualizado: incluir 'merma'
  await exec.sql('BEGIN TRANSACTION');
  await exec.sql(`CREATE TABLE stock_movimientos_v10 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'ajuste', 'merma')),
    motivo TEXT,
    created_at TEXT NOT NULL,
    jornada_id INTEGER REFERENCES jornadas(id),
    costo_total REAL DEFAULT 0
  )`);
  await exec.sql(`INSERT INTO stock_movimientos_v10
    SELECT id, producto_id, cantidad, tipo, motivo, created_at,
      CASE WHEN jornada_id IS NULL THEN NULL ELSE jornada_id END,
      CASE WHEN costo_total IS NULL THEN 0 ELSE costo_total END
    FROM stock_movimientos`);
  await exec.sql('DROP TABLE stock_movimientos');
  await exec.sql('ALTER TABLE stock_movimientos_v10 RENAME TO stock_movimientos');
  await exec.sql('INSERT INTO schema_version (version) VALUES (10)');
  await exec.sql('COMMIT');
}

async function migrationV11(exec: MigrationExecutor): Promise<void> {
  // v11: rename productos.stock_actual→stock_almacen, add stock_shop;
  //      add lotes_stock.ubicacion;
  //      add 'traslado' to stock_movimientos CHECK
  await exec.sql('BEGIN TRANSACTION');

  // 1. Recreate productos with dual stock columns
  await exec.sql(`CREATE TABLE productos_v11 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_venta REAL NOT NULL,
    precio_costo REAL,
    stock_almacen REAL NOT NULL DEFAULT 0,
    stock_shop REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await exec.sql(`INSERT INTO productos_v11
    SELECT id, nombre, descripcion, precio_venta, precio_costo,
           stock_actual, 0, created_at, updated_at
    FROM productos`);
  await exec.sql('DROP TABLE productos');
  await exec.sql('ALTER TABLE productos_v11 RENAME TO productos');

  // 2. Add ubicacion to lotes_stock (safe ALTER with try/catch)
  try {
    await exec.sql(
      "ALTER TABLE lotes_stock ADD COLUMN ubicacion TEXT NOT NULL DEFAULT 'almacen' CHECK(ubicacion IN ('almacen','shop'))",
    );
  } catch { /* columna ya existe */ }

  // 3. Recreate stock_movimientos to add 'traslado' to CHECK
  await exec.sql(`CREATE TABLE stock_movimientos_v11 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste','merma','traslado')),
    motivo TEXT,
    created_at TEXT NOT NULL,
    jornada_id INTEGER REFERENCES jornadas(id),
    costo_total REAL DEFAULT 0
  )`);
  await exec.sql(`INSERT INTO stock_movimientos_v11
    SELECT id, producto_id, cantidad, tipo, motivo, created_at,
           jornada_id, costo_total
    FROM stock_movimientos`);
  await exec.sql('DROP TABLE stock_movimientos');
  await exec.sql('ALTER TABLE stock_movimientos_v11 RENAME TO stock_movimientos');

  await exec.sql('INSERT INTO schema_version (version) VALUES (11)');
  await exec.sql('COMMIT');
}

async function migrationV12(exec: MigrationExecutor): Promise<void> {
  // v12: rename total_gastos → total_movimientos in jornadas
  await exec.sql('BEGIN TRANSACTION');
  await exec.sql('ALTER TABLE jornadas RENAME COLUMN total_gastos TO total_movimientos');
  await exec.sql('INSERT INTO schema_version (version) VALUES (12)');
  await exec.sql('COMMIT');
}

async function migrationV13(exec: MigrationExecutor): Promise<void> {
  // v13: crear tabla arqueo_caja para conteo de billetes/monedas
  await exec.sql(`CREATE TABLE IF NOT EXISTS arqueo_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    denominacion INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  await exec.sql(
    'CREATE INDEX IF NOT EXISTS idx_arqueo_jornada ON arqueo_caja(jornada_id)',
  );
  await exec.sql('INSERT INTO schema_version (version) VALUES (13)');
}

async function migrationV14(exec: MigrationExecutor): Promise<void> {
  // v14: agregar columnas de divisa a movimientos y jornadas
  for (const q of [
    'ALTER TABLE movimientos ADD COLUMN divisa_tipo TEXT',
    'ALTER TABLE movimientos ADD COLUMN monto_divisa REAL',
    'ALTER TABLE movimientos ADD COLUMN tasa_cambio REAL',
    'ALTER TABLE jornadas ADD COLUMN total_usd REAL DEFAULT 0',
    'ALTER TABLE jornadas ADD COLUMN total_eur REAL DEFAULT 0',
  ]) {
    try { await exec.sql(q); } catch { /* columna ya existe */ }
  }

  await exec.sql('INSERT INTO schema_version (version) VALUES (14)');
}

async function migrationV15(exec: MigrationExecutor): Promise<void> {
  // v15: agregar 'compra_divisa' al CHECK de movimientos.tipo
  await exec.sql('BEGIN TRANSACTION');
  await exec.sql('PRAGMA foreign_keys = OFF');

  await exec.sql(`CREATE TABLE movimientos_v15 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
    tipo TEXT NOT NULL CHECK(tipo IN ('gasto', 'ingreso_extra', 'compra_divisa')),
    descripcion TEXT NOT NULL,
    monto REAL NOT NULL,
    created_at TEXT NOT NULL,
    divisa_tipo TEXT,
    monto_divisa REAL,
    tasa_cambio REAL
  )`);
  await exec.sql(`INSERT INTO movimientos_v15
    SELECT id, jornada_id, tipo, descripcion, monto, created_at,
           divisa_tipo, monto_divisa, tasa_cambio
    FROM movimientos`);
  await exec.sql('DROP TABLE movimientos');
  await exec.sql('ALTER TABLE movimientos_v15 RENAME TO movimientos');

  await exec.sql('PRAGMA foreign_keys = ON');
  await exec.sql('INSERT INTO schema_version (version) VALUES (15)');
  await exec.sql('COMMIT');
}

async function migrationV16(exec: MigrationExecutor): Promise<void> {
  // v16: agregar columna completacion_efectivo a ventas para pago mixto divisas+efectivo
  try {
    await exec.sql(
      'ALTER TABLE ventas ADD COLUMN completacion_efectivo REAL',
    );
  } catch { /* columna ya existe */ }

  await exec.sql('INSERT INTO schema_version (version) VALUES (16)');
}

async function migrationV17(exec: MigrationExecutor): Promise<void> {
  // v17: cobro de pendientes. Columnas nullable solo-aditivas (sin recreate
  // — ventas tiene FKs desde detalle_ventas/venta_lotes). Marcadores NULL
  // = pendiente legacy retroactivamente cobrable. Cada ALTER con try/catch
  // por idempotencia (patrón v16).
  try {
    await exec.sql(
      'ALTER TABLE ventas ADD COLUMN cobro_de_venta_id INTEGER REFERENCES ventas(id)',
    );
  } catch { /* columna ya existe */ }

  try {
    await exec.sql(
      'ALTER TABLE ventas ADD COLUMN pagado_en TEXT',
    );
  } catch { /* columna ya existe */ }

  // Índice parcial para la query de lista de pendientes
  await exec.sql(
    "CREATE INDEX IF NOT EXISTS idx_ventas_pendientes ON ventas(forma_pago) WHERE forma_pago='pendiente'",
  );

  await exec.sql('INSERT INTO schema_version (version) VALUES (17)');
}

async function seedIfEmpty(exec: MigrationExecutor): Promise<void> {
  const [{ count }] = await exec.sql<{ count: number }>(
    'SELECT COUNT(*) AS count FROM productos',
  );

  if (count > 0) return;

  const ahora = new Date().toISOString();
  // Seed real del negocio: cargado desde Excel (74 productos). Stock en 0,
  // se ajusta manualmente desde inventario.
  const productos: [string, string | null, number, number | null, number][] = [
    ['Hello',                  null, 180,  120,   0],
    ['G.nutro',                null, 120,   90,   0],
    ['G.Soda',                 null, 1600, 1350,  0],
    ['G.Soda pte',             null, 250,  193,   0],
    ['G.Rellenitas',           null, 120,   60,   0],
    ['S. Nick',                null, 150,  105,   0],
    ['bigo',                   null, 140,  120,   0],
    ['Gbrownie',               null, 180,  110,   0],
    ['Romo',                   null, 190,  120,   0],
    ['Roceo',                  null, 170,  110,   0],
    ['Crem',                   null, 150,  150,   0],
    ['Creme',                  null, 180,  105,   0],
    ['Morro',                  null, 170,  110,   0],
    ['Yummy',                  null, 150,  100,   0],
    ['Yum',                    null, 100,   80,   0],
    ['Pure de tomate',         null, 500,  400,   0],
    ['Chupa CH',               null, 45,    35,   0],
    ['Chupa CH',               null, 60,    55,   0],
    ['Caramelos',              null, 15,     7,   0],
    ['Caramelos',              null, 90,    45,   0],
    ['Ltas refresco',          null, 350,  305,   0],
    ['Pte refresco',           null, 50,    35,   0],
    ['Buñuelos',               null, 60,    50,   0],
    ['Buñuelos',               null, 50,    35,   0],
    ['Jugo chiq',              null, 240,  200,   0],
    ['Queso Porcionado',       null, 2800, 2500,  0],
    ['Yogurt',                 null, 2800, 2650,  0],
    ['Café',                   null, 500,  380,   0],
    ['Café',                   null, 250,  190,   0],
    ['Café',                   null, 1000, 770,   0],
    ['Cerveza',                null, 450,  370,   0],
    ['Yogurt',                 null, 2800, 2650,  0],
    ['Atun',                   null, 450,  400,   0],
    ['Cafe Villa Rico',        null, 1800, 1300,  0],
    ['Cafe Aroma',             null, 2500, 2300,  0],
    ['Mayonesa',               null, 1600, 1300,  0],
    ['Mayonesa',               null, 1100,  900,  0],
    ['Leche condensada',       null, 700,  600,   0],
    ['Papel Sanitario',        null, 170,  150,   0],
    ['Detergente',             null, 450,  300,   0],
    ['Detergente',             null, 700,  500,   0],
    ['Servilleta unidad',      null, 80,    50,   0],
    ['Servilletas',            null, 800,  650,   0],
    ['Jabon Unidad',           null, 130,  120,   0],
    ['Jabon cantidad',         null, 8280, 8000,  0],
    ['Jabon ofertas',          null, 1200, 1150,  0],
    ['Especial',               null, 1600, 1250,  0],
    ['Vodka',                  null, 2000, 1650,  0],
    ['Canecas',                null, 500,  380,   0],
    ['Croquetas',              null, 230,  180,   0],
    ['Hamburguesas',           null, 120,  100,   0],
    ['Huevos',                 null, 3000, 2500,  0],
    ['unidad',                 null, 110,   96.6, 0],
    ['Lomo natural',           null, 1500, 1200,  0],
    ['Embutidos',              null, 1100,  900,  0],
    ['Jamon',                  null, 750,  650,   0],
    ['Picadillo porcionado',   null, 450,  407,   0],
    ['POLLO PORC',             null, 1700, 1400,  0],
    ['Dulce Guayaba',          null, 220,  175,   0],
    ['Espaguetis',             null, 350,  250,   0],
    ['Arroz',                  null, 650,  600,   0],
    ['Aceite',                 null, 1350, 1150,  0],
    ['Ajonjoli',               null, 220,  160,   0],
    ['Vino seco',              null, 370,  270,   0],
    ['Vinagre',                null, 370,  270,   0],
    ['Limon',                  null, 370,  280,   0],
    ['Cigarros H-U con filtro',null, 600,  450,   0],
    ['Cigarros H-U Sin filtro',null, 400,  300,   0],
    ['Cigarro unidad',         null, 35,    20,   0],
    ['Cigarros Reno',          null, 600,  450,   0],
    ['Cigarro Engliish',       null, 650,  500,   0],
    ['Intimas',                null, 450,  325,   0],
    ['Pasta Dental',           null, 500,  400,   0],
    ['Bolsas',                 null, 15,     7,   0],
  ];

  const total = productos.length;
  const batchSize = 10;

  for (let i = 0; i < total; i += batchSize) {
    const batch = productos.slice(i, i + batchSize);
    const placeholders = batch
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?)')
      .join(', ');

    const flatParams: unknown[] = [];
    for (const [nombre, descripcion, precioVenta, precioCosto, stock] of batch) {
      flatParams.push(nombre, descripcion, precioVenta, precioCosto ?? null, stock, 0, ahora, ahora);
    }

    await exec.sql(
      `INSERT INTO productos (nombre, descripcion, precio_venta, precio_costo, stock_almacen, stock_shop, created_at, updated_at)
       VALUES ${placeholders}`,
      flatParams,
    );
  }

  // Crear lotes_stock para los productos seed (requerido para FIFO)
  await exec.sql(`INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
    SELECT id, stock_almacen, COALESCE(precio_costo, 0), created_at, created_at
    FROM productos
    WHERE stock_almacen > 0`);
}
