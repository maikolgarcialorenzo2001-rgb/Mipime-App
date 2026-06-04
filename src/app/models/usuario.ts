export interface Usuario {
  id: number;
  nombre: string;
  password_hash: string;
  salt: string;
  rol: 'admin' | 'trabajador';
  activo: number;
  created_at: string;
  updated_at: string;
}

/** Versión pública de Usuario (sin datos sensibles) */
export type UsuarioPublico = Omit<Usuario, 'password_hash' | 'salt'>;
