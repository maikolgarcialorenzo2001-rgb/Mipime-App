import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
import { generateSalt, hashPassword } from './hash-password';
import { seedProductosSiVacio } from './db-migrations';
import type { Usuario, UsuarioPublico } from '../models';

@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly _db = inject(DATABASE);

  async countUsers(): Promise<number> {
    const [{ count }] = await this._db.sql<{ count: number }>(
      'SELECT COUNT(*) AS count FROM usuarios',
    );
    return count;
  }

  async getConfig(clave: string): Promise<string | null> {
    const rows = await this._db.sql<{ valor: string }>(
      'SELECT valor FROM config WHERE clave = ?',
      [clave],
    );
    return rows[0]?.valor ?? null;
  }

  async setConfig(clave: string, valor: string): Promise<void> {
    await this._db.sql(
      'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
      [clave, valor],
    );
  }

  async createInitialAdmin(
    nombre: string,
    password: string,
    nombreComercio: string,
    seedProducts: boolean,
  ): Promise<UsuarioPublico> {
    const userCount = await this.countUsers();
    if (userCount > 0) {
      throw new Error('Setup already completed - users exist');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    const rows = await this._db.sql<Usuario>(
      `INSERT INTO usuarios (nombre, password_hash, salt, rol, activo, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 1, ?, ?) RETURNING *`,
      [nombre, passwordHash, salt, now, now],
    );

    const user = rows[0];
    const usuarioPublico: UsuarioPublico = {
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      activo: user.activo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    await this.setConfig('nombre_comercio', nombreComercio);
    await this.setConfig('seedProducts', seedProducts ? '1' : '0');

    if (seedProducts) {
      await seedProductosSiVacio(this._db);
    }

    return usuarioPublico;
  }
}