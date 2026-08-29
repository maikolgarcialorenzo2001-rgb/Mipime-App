import { Injectable, inject } from '@angular/core';
import { DATABASE } from './database';
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

  async getActiveAdminCount(): Promise<number> {
    const [{ count }] = await this._db.sql<{ count: number }>(
      "SELECT COUNT(*) AS count FROM usuarios WHERE rol = 'admin' AND activo = 1",
    );
    return count;
  }

  async toggleActivo(id: number): Promise<void> {
    const currentUser = this._auth.usuario();
    if (currentUser && id === currentUser.id) {
      throw new Error('No puedes desactivarte a ti mismo');
    }

    const activeAdminCount = await this.getActiveAdminCount();
    if (activeAdminCount === 1) {
      // Check if the target is an active admin
      const target = await this._db.sql<Pick<Usuario, 'rol', 'activo'>>(
        'SELECT rol, activo FROM usuarios WHERE id = ?',
        [id],
      );
      if (target.length > 0 && target[0].rol === 'admin' && target[0].activo === 1) {
        throw new Error('No puedes desactivar al último administrador activo');
      }
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
    const activeAdminCount = await this.getActiveAdminCount();
    if (activeAdminCount === 1) {
      // Check if the target is an active admin
      const target = await this._db.sql<Pick<Usuario, 'rol', 'activo'>>(
        'SELECT rol, activo FROM usuarios WHERE id = ?',
        [id],
      );
      if (target.length > 0 && target[0].rol === 'admin' && target[0].activo === 1) {
        throw new Error('No puedes cambiar el rol del último administrador activo');
      }
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