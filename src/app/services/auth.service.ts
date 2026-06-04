import { Injectable, computed, inject, signal } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { DATABASE } from './database';
import { hashPassword } from './hash-password';
import type { Usuario, UsuarioPublico } from '../models';

const SESSION_KEY = 'mipime_session';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly _db = inject(DATABASE);

  private readonly _currentUser = signal<UsuarioPublico | null>(null);

  /** Señal reactiva del usuario logueado (sin hash/salt). */
  readonly usuario = this._currentUser.asReadonly();

  /** `true` si hay sesión activa. */
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  constructor() {
    this._restoreSession();
  }

  /**
   * Verifica si el usuario autenticado tiene un rol específico.
   */
  hasRole(role: string): boolean {
    return this._currentUser()?.rol === role;
  }

  /**
   * Inicia sesión con email y contraseña.
   * Busca el usuario, verifica el hash y persiste la sesión.
   */
  login(email: string, password: string): Observable<UsuarioPublico> {
    return from(this._loginAsync(email, password));
  }

  /**
   * Cierra sesión: limpia signal y localStorage.
   */
  logout(): void {
    this._currentUser.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  private async _loginAsync(
    email: string,
    password: string,
  ): Promise<UsuarioPublico> {
    const rows = await this._db.sql<Usuario>(
      'SELECT * FROM usuarios WHERE email = ?',
      [email],
    );

    const user = rows[0];
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    if (!user.activo) {
      throw new Error('Usuario desactivado');
    }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.password_hash) {
      throw new Error('Credenciales inválidas');
    }

    const session: UsuarioPublico = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    this._currentUser.set(session);
    this._persistSession(session);
    return session;
  }

  private _persistSession(session: UsuarioPublico): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // localStorage puede fallar (cuota excedida, etc.)
    }
  }

  private _restoreSession(): void {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as UsuarioPublico;
        if (session && session.id && session.email) {
          this._currentUser.set(session);
        }
      }
    } catch {
      // JSON corrupto → no hay sesión
    }
  }
}
