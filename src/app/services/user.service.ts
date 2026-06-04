import { Injectable, inject } from '@angular/core';
import { DATABASE, type Database } from './database';
import { AuthService } from './auth.service';
import { generateSalt, hashPassword } from './hash-password';
import type { Usuario, UsuarioPublico } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _db = inject(DATABASE);
  private readonly _auth = inject(AuthService);

  async list(): Promise<UsuarioPublico[]> {
    return this._db.sql<UsuarioPublico>(
      'SELECT id, nombre, rol, activo, created_at, updated_at FROM usuarios ORDER BY created_at DESC',
    );
  }

  async create(
    nombre: string,
    password: string,
    rol: 'admin' | 'trabajador',
  ): Promise<UsuarioPublico> {
    const existing = await this._db.sql<Usuario>(
      'SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?)',
      [nombre],
    );

    for (const user of existing) {
      const hash = await hashPassword(password, user.salt);
      if (hash === user.password_hash) {
        throw new Error('Ya existe un usuario con ese nombre y contraseña');
      }
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    const rows = await this._db.sql<Usuario>(
      `INSERT INTO usuarios (nombre, password_hash, salt, rol, activo, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING *`,
      [nombre, passwordHash, salt, rol, now, now],
    );

    const u = rows[0];
    return {
      id: u.id,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      created_at: u.created_at,
      updated_at: u.updated_at,
    };
  }

  async toggleActivo(id: number): Promise<void> {
    const currentUser = this._auth.usuario();
    if (currentUser && id === currentUser.id) {
      throw new Error('No puedes desactivarte a ti mismo');
    }

    const seedAdmin = await this._db.sql<Pick<Usuario, 'id'>>(
      'SELECT id FROM usuarios WHERE nombre = ? AND rol = ? LIMIT 1',
      ['admin', 'admin'],
    );

    if (seedAdmin.length > 0 && id === seedAdmin[0].id) {
      throw new Error('No puedes desactivar al usuario administrador');
    }

    const now = new Date().toISOString();
    await this._db.sql(
      'UPDATE usuarios SET activo = 1 - activo, updated_at = ? WHERE id = ?',
      [now, id],
    );
  }

  async updateRol(
    id: number,
    rol: 'admin' | 'trabajador',
  ): Promise<void> {
    const seedAdmin = await this._db.sql<Pick<Usuario, 'id'>>(
      'SELECT id FROM usuarios WHERE nombre = ? AND rol = ? LIMIT 1',
      ['admin', 'admin'],
    );

    if (seedAdmin.length > 0 && id === seedAdmin[0].id) {
      throw new Error('No puedes cambiar el rol del usuario administrador');
    }

    const now = new Date().toISOString();
    await this._db.sql(
      'UPDATE usuarios SET rol = ?, updated_at = ? WHERE id = ?',
      [rol, now, id],
    );
  }

  async updatePassword(id: number, password: string): Promise<void> {
    if (!password.trim()) {
      throw new Error('La contraseña no puede estar vacía');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    await this._db.sql(
      'UPDATE usuarios SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?',
      [passwordHash, salt, now, id],
    );
  }
}
