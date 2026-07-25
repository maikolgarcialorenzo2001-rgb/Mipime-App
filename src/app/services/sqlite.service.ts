import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SQLocal } from 'sqlocal';
import type { Database } from './database';
import { environment } from '../environments/environment';

@Injectable()
export class SqliteService implements Database {
  private _client: SQLocal | null = null;
  private readonly _isBrowser: boolean;

  constructor() {
    this._isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  private async _getClient(): Promise<SQLocal> {
    if (!this._client) {
      if (!this._isBrowser) {
        throw new Error('SqliteService solo está disponible en el navegador');
      }
      // Dynamic import: sqlocal se carga solo en el browser,
      // Vite nunca lo bundlea para SSR y no rompe el dev server.
      const { SQLocal: SQLocalClass } = await import('sqlocal');

      // Creamos el Worker desde nuestro código para que Vite/Angular
      // lo procese correctamente (type: module). Si dejamos que SQLocal
      // cree el Worker internamente, Vite no configura worker.format: 'es'
      // y el worker falla con NS_ERROR_CORRUPTED_CONTENT.
      const worker = new Worker(
        new URL(
          '../../../node_modules/sqlocal/dist/worker',
          import.meta.url,
        ),
        { type: 'module' },
      );

      this._client = new SQLocalClass({
        databasePath: environment.dbName,
        processor: worker,
      });
    }
    return this._client;
  }

  async sql<T>(query: string, params?: unknown[]): Promise<T[]> {
    const client = await this._getClient();
    const result = await client.sql(query, ...(params ?? []));
    return this._mapRows<T>(result);
  }

  /**
   * Convierte el resultado crudo de SQLocal (Record<string, unknown>[])
   * al tipo esperado T. Es un cast necesario porque SQLocal no conoce
   * nuestras tablas. Nosotros controlamos el schema, así que es seguro.
   */
  private _mapRows<T>(rows: Record<string, unknown>[]): T[] {
    return rows as unknown as T[];
  }

  async initialize(): Promise<void> {
    if (!this._isBrowser) return;
    const client = await this._getClient();

    await client.sql(`CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )`);

    const rows = await client.sql<{ version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_version',
    );
    const currentVersion = rows[0]?.version ?? 0;

    if (currentVersion < 1) {
      await this._migrationV1(client);
    }

    if (currentVersion < 2) {
      await this._migrationV2(client);
    }

    if (currentVersion < 3) {
      await this._migrationV3(client);
    }

    if (currentVersion < 4) {
      await this._migrationV4(client);
    }

    if (currentVersion < 5) {
      await this._migrationV5(client);
    }

    if (currentVersion < 6) {
      await this._migrationV6(client);
    }

    if (currentVersion < 7) {
      await this._migrationV7(client);
    }

    if (currentVersion < 8) {
      await this._migrationV8(client);
    }

    if (environment.seedEnabled) {
      await this._seedIfEmpty(client);
    }
  }

  private async _migrationV1(client: SQLocal): Promise<void> {
    await client.sql(`CREATE TABLE IF NOT EXISTS jornadas (
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

    await client.sql(`CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio_venta REAL NOT NULL,
      precio_costo REAL,
      stock_actual REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
      fecha_hora TEXT NOT NULL,
      total REAL NOT NULL,
      created_at TEXT NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('gasto', 'ingreso_extra')),
      descripcion TEXT NOT NULL,
      monto REAL NOT NULL,
      created_at TEXT NOT NULL
    )`);

    await client.sql('INSERT INTO schema_version (version) VALUES (1)');
  }

  private async _migrationV2(client: SQLocal): Promise<void> {
    await client.sql(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS stock_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'ajuste')),
      motivo TEXT,
      created_at TEXT NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS jornada_reportes (
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
      try { await client.sql(q); } catch { /* columna ya existe */ }
    }

    // Seed admin: solo si no existe
    const [{ count }] = await client.sql<{ count: number }>(
      "SELECT COUNT(*) AS count FROM usuarios WHERE nombre = ?",
      environment.adminUser,
    );
    if (count === 0) {
      const ahora = new Date().toISOString();
      const { generateSalt, hashPassword } = await import('./hash-password');
      const salt = generateSalt();
      const hash = await hashPassword(environment.adminPassword, salt);
      await client.sql(
        `INSERT INTO usuarios (nombre, password_hash, salt, rol, activo, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', 1, ?, ?)`,
        environment.adminUser, hash, salt, ahora, ahora,
      );
    }

    await client.sql('INSERT INTO schema_version (version) VALUES (2)');
  }

  private async _migrationV3(client: SQLocal): Promise<void> {
    // Eliminar columna email de usuarios (ya no se usa para login).
    // Usamos recreación de tabla (compatible con TODAS las versiones
    // de SQLite, a diferencia de DROP COLUMN que requiere 3.35+).
    const columns = await client.sql<{ name: string }>(
      'PRAGMA table_info(usuarios)',
    );
    const hasEmail = columns.some((c) => c.name === 'email');
    if (hasEmail) {
      await client.sql('BEGIN TRANSACTION');
      await client.sql(`CREATE TABLE usuarios_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      await client.sql(`INSERT INTO usuarios_v3
        SELECT id, nombre, password_hash, salt, rol, activo, created_at, updated_at
        FROM usuarios`);
      await client.sql('DROP TABLE usuarios');
      await client.sql('ALTER TABLE usuarios_v3 RENAME TO usuarios');
      await client.sql('COMMIT');
    }

    await client.sql('INSERT INTO schema_version (version) VALUES (3)');
  }

  private async _migrationV4(client: SQLocal): Promise<void> {
    // Reparación: si la columna email aún existe (v3 falló en algunos entornos),
    // la eliminamos mediante recreación de tabla.
    const columns = await client.sql<{ name: string }>(
      'PRAGMA table_info(usuarios)',
    );
    const hasEmail = columns.some((c) => c.name === 'email');
    if (hasEmail) {
      await client.sql('BEGIN TRANSACTION');
      await client.sql(`CREATE TABLE usuarios_v4 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'trabajador' CHECK(rol IN ('admin', 'trabajador')),
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      await client.sql(`INSERT INTO usuarios_v4
        SELECT id, nombre, password_hash, salt, rol, activo, created_at, updated_at
        FROM usuarios`);
      await client.sql('DROP TABLE usuarios');
      await client.sql('ALTER TABLE usuarios_v4 RENAME TO usuarios');
      await client.sql('COMMIT');
    }

    await client.sql('INSERT INTO schema_version (version) VALUES (4)');
  }

  private async _migrationV5(client: SQLocal): Promise<void> {
    // Recrear ventas con CHECK(forma_pago) actualizado a solo efectivo/transferencia
    await client.sql('BEGIN TRANSACTION');
    await client.sql(`CREATE TABLE ventas_v5 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
      fecha_hora TEXT NOT NULL,
      total REAL NOT NULL,
      created_at TEXT NOT NULL,
      usuario_id INTEGER REFERENCES usuarios(id),
      forma_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK(forma_pago IN ('efectivo', 'transferencia'))
    )`);
    await client.sql(`INSERT INTO ventas_v5
      SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago
      FROM ventas`);
    await client.sql('DROP TABLE ventas');
    await client.sql('ALTER TABLE ventas_v5 RENAME TO ventas');
    await client.sql('INSERT INTO schema_version (version) VALUES (5)');
    await client.sql('COMMIT');
  }

  private async _migrationV6(client: SQLocal): Promise<void> {
    await client.sql('BEGIN TRANSACTION');
    await client.sql(`CREATE TABLE ventas_v6 (
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
    await client.sql(`INSERT INTO ventas_v6
      SELECT id, jornada_id, fecha_hora, total, created_at, usuario_id, forma_pago,
        NULL, NULL, NULL, NULL, NULL, NULL
      FROM ventas`);
    await client.sql('DROP TABLE ventas');
    await client.sql('ALTER TABLE ventas_v6 RENAME TO ventas');
    await client.sql(`CREATE TABLE cuenta_cosas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jornada_id INTEGER NOT NULL REFERENCES jornadas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      descripcion TEXT,
      autorizado_por TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    await client.sql('INSERT INTO schema_version (version) VALUES (6)');
    await client.sql('COMMIT');
  }

  private async _migrationV7(client: SQLocal): Promise<void> {
    // ALTER TABLE con try/catch por si la columna ya existe
    try {
      await client.sql(
        'ALTER TABLE stock_movimientos ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id)',
      );
    } catch { /* columna ya existe */ }

    await client.sql('INSERT INTO schema_version (version) VALUES (7)');
  }

  private async _migrationV8(client: SQLocal): Promise<void> {
    await client.sql(`CREATE TABLE IF NOT EXISTS lotes_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_costo REAL NOT NULL,
      fecha_ingreso TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);

    await client.sql(`CREATE TABLE IF NOT EXISTS venta_lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      lote_id INTEGER NOT NULL REFERENCES lotes_stock(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_costo_real REAL NOT NULL,
      created_at TEXT NOT NULL
    )`);

    await client.sql(
      'CREATE INDEX IF NOT EXISTS idx_lotes_stock_producto_fecha ON lotes_stock(producto_id, fecha_ingreso)',
    );

    await client.sql(
      'CREATE INDEX IF NOT EXISTS idx_venta_lotes_venta ON venta_lotes(venta_id)',
    );

    // Backfill: crear lotes para productos existentes con stock > 0
    await client.sql(`INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
      SELECT id, stock_actual, COALESCE(precio_costo, 0), created_at, created_at
      FROM productos
      WHERE stock_actual > 0`);

    await client.sql('INSERT INTO schema_version (version) VALUES (8)');
  }

  private async _seedIfEmpty(client: SQLocal): Promise<void> {
    const [{ count }] = await client.sql<{ count: number }>(
      'SELECT COUNT(*) AS count FROM productos',
    );

    if (count > 0) return;

    const ahora = new Date().toISOString();
    const productos: [string, string | null, number, number | null, number][] = [
      ['Harina 0000 1kg',        'Harina de trigo tradicional',         850,   550,  50],
      ['Azúcar 1kg',              'Azúcar blanca refinada',             900,   600,  40],
      ['Leche Entera 1L',         'Leche fluida entera',               1100,   750,  30],
      ['Pan Lactal 500g',         'Pan de molde blanco',               1500,  1000,  20],
      ['Huevos x12',              'Huevos de campo',                   1800,  1200,  25],
      ['Aceite Girasol 1.5L',     'Aceite puro de girasol',            2500,  1700,  15],
      ['Arroz 1kg',               'Arroz blanco largo fino',           1200,   800,  35],
      ['Fideos Tallarines 500g',  'Fideos secos de sémola',             800,   500,  45],
      ['Yerba Mate 1kg',          'Yerba mate con palo',               3500,  2500,  20],
      ['Café Molido 500g',        'Café torrado molido',               4000,  2800,  15],
      ['Galletitas Dulces 200g',  'Galletitas de vainilla',             950,   600,  40],
      ['Manteca 200g',            'Manteca pasteurizada',              1200,   800,  25],
      ['Queso Cremoso 200g',      'Queso cremoso entero',              1800,  1200,  20],
      ['Yogur Firme x4',          'Yogur firme sabor frutilla',        1400,   950,  30],
      ['Sal Fina 500g',           'Sal fina de mesa',                   500,   300,  50],
      ['Dulce de Leche 400g',     'Dulce de leche tradicional',        2200,  1500,  20],
      ['Atún al Natural x2',      'Lata de atún desmenuzado',          2100,  1400,  25],
      ['Tomate Perita Lata 400g', 'Tomate perita pelado entero',       1200,   750,  30],
      ['Lentejas 500g',           'Lentejas secas',                     950,   600,  30],
      ['Puré de Tomates 500g',    'Puré de tomates tradicional',        800,   500,  35],
      ['Mayonesa 500g',           'Mayonesa clásica',                  1600,  1100,  20],
      ['Mostaza 250g',            'Mostaza amarilla',                   900,   550,  25],
      ['Vinagre Alcohol 500ml',   'Vinagre de alcohol',                 600,   350,  30],
      ['Agua Mineral 2L',         'Agua mineral sin gas',               800,   500,  40],
      ['Gaseosa Cola 1.5L',       'Gaseosa sabor cola',                1800,  1200,  30],
      ['Cerveza Lata 473ml',      'Cerveza rubia',                     1500,   950,  35],
      ['Vino Tinto Botella',      'Vino tinto varietal',               3500,  2200,  15],
      ['Papas Fritas 150g',       'Papas fritas sabor original',       2100,  1400,  25],
      ['Chocolate con Leche 100g','Chocolate con leche',                2200,  1500,  20],
      ['Caramelos Masticables 100g','Caramelos surtidos',               500,   300,  60],
      // Productos 31-50: limpieza, higiene, y adicionales
      ['Detergente 500ml',           'Detergente líquido para vajilla', 1800,  1200,  20],
      ['Lavandina 1L',               'Lavandina concentrada',          1200,   800,  25],
      ['Papel Higiénico x4',         'Papel higiénico x4 unidades',    2500,  1800,  30],
      ['Pañuelos Descartables x10',  'Pañuelos de papel x10',          1200,   800,  40],
      ['Jabón de Tocador 125g',      'Jabón de tocador',               1000,   650,  30],
      ['Pasta Dental 90g',           'Pasta dental fluorada',          2200,  1500,  20],
      ['Shampoo Sachet',             'Shampoo en sachet',               800,   500,  35],
      ['Desodorante Aerosol',        'Desodorante aerosol x150ml',     3200,  2200,  15],
      ['Galletitas Saladas 200g',    'Galletitas de agua',             1100,   700,  30],
      ['Alfajores Triples x3',       'Alfajores triples de chocolate', 1800,  1200,  25],
      ['Chicles Blister',            'Chicles sabor menta',             600,   350,  50],
      ['Maní Salado 150g',           'Maní salado envasado',            900,   550,  30],
      ['Pipas 100g',                 'Semillas de girasol',             700,   400,  35],
      ['Té en Saquitos x25',         'Té negro en saquitos',           1500,  1000,  20],
      ['Fósforos x10',               'Fósforos de cocina',              400,   200,  60],
      ['Servilletas x100',           'Servilletas de papel x100',       800,   500,  25],
      ['Film Adherente 30m',         'Film adherente para cocina',      900,   600,  20],
      ['Papel Aluminio 5m',          'Papel de aluminio',              1200,   800,  15],
      ['Agua Saborizada 1.5L',       'Agua saborizada pomelo',         1200,   800,  25],
      ['Gaseosa Naranja 1.5L',       'Gaseosa sabor naranja',          1600,  1000,  20],
    ];

    const total = productos.length;
    const batchSize = 10;

    for (let i = 0; i < total; i += batchSize) {
      const batch = productos.slice(i, i + batchSize);
      const placeholders = batch
        .map(() => '(?, ?, ?, ?, ?, ?, ?)')
        .join(', ');

      const flatParams: unknown[] = [];
      for (const [nombre, descripcion, precioVenta, precioCosto, stock] of batch) {
        flatParams.push(nombre, descripcion, precioVenta, precioCosto ?? null, stock, ahora, ahora);
      }

      await client.sql(
        `INSERT INTO productos (nombre, descripcion, precio_venta, precio_costo, stock_actual, created_at, updated_at)
         VALUES ${placeholders}`,
        ...flatParams,
      );
    }

    // Crear lotes_stock para los productos seed (requerido para FIFO)
    await client.sql(`INSERT INTO lotes_stock (producto_id, cantidad, precio_costo, fecha_ingreso, created_at)
      SELECT id, stock_actual, COALESCE(precio_costo, 0), created_at, created_at
      FROM productos
      WHERE stock_actual > 0`);
  }
}
