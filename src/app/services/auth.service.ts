import { Injectable, computed, inject, signal } from '@angular/core';
import { from, Observable } from 'rxjs';
import { DATABASE } from './database';
import { hashPassword } from './hash-password';
import type { Usuario, UsuarioPublico } from '../models';

const SESSION_KEY = 'mipime_session';
const HEARTBEAT_KEY = 'session_heartbeat';

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
    this._setHeartbeat();
  }

  /**
   * Escribe session_heartbeat en sessionStorage.
   * sessionStorage sobrevive a F5 pero muere al cerrar tab.
   */
  private _setHeartbeat(): void {
    try {
      sessionStorage.setItem(HEARTBEAT_KEY, '1');
    } catch {
      // sessionStorage puede fallar (cuota excedida, etc.)
    }
  }

  /**
   * Verifica si el usuario autenticado tiene un rol específico.
   */
  hasRole(role: string): boolean {
    return this._currentUser()?.rol === role;
  }

  /**
   * Inicia sesión con nombre de usuario y contraseña.
   * Busca por nombre (case-insensitive), verifica el hash y persiste la sesión.
   */
  login(username: string, password: string): Observable<UsuarioPublico> {
    return from(this._loginAsync(username, password));
  }

  /**
   * Cierra sesión: limpia signal y localStorage.
   */
  logout(): void {
    this._currentUser.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  private async _loginAsync(
    username: string,
    password: string,
  ): Promise<UsuarioPublico> {
    const rows = await this._db.sql<Usuario>(
      'SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?)',
      [username],
    );

    if (rows.length === 0) {
      throw new Error('Credenciales inválidas');
    }

    // Si todos los usuarios con ese nombre están desactivados, rechazar
    if (rows.every((u) => !u.activo)) {
      throw new Error('Usuario desactivado');
    }

    // ⚠️ `nombre` NO tiene UNIQUE constraint — pueden existir múltiples
    // usuarios con el mismo nombre. NO usamos rows[0] porque agarraría
    // al primer coincidente, ignorando password y rol del resto.
    //
    // En vez de eso: iteramos TODOS los que se llamen igual, y el que
    // tenga la contraseña correcta → ese loguea con SU rol (sea admin
    // o trabajador). Así cada uno entra con su identidad real.
    for (const user of rows) {
      if (!user.activo) continue;

      const hash = await hashPassword(password, user.salt);
      if (hash !== user.password_hash) continue;

      const session: UsuarioPublico = {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
        activo: user.activo,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      this._currentUser.set(session);
      this._persistSession(session);
      return session;
    }

    throw new Error('Credenciales inválidas');
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
      if (!raw) return;

      // Si no hay heartbeat en sessionStorage, es una tab nueva tras cerrar la app.
      const heartbeat = sessionStorage.getItem(HEARTBEAT_KEY);
      if (!heartbeat) {
        localStorage.removeItem(SESSION_KEY);
        return;
      }

      const session = JSON.parse(raw) as UsuarioPublico;
      if (session && session.id && session.nombre) {
        this._currentUser.set(session);
      }
    } catch {
      // JSON corrupto → no hay sesión
    }
  }
}
