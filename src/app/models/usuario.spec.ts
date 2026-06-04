import type { Usuario } from './usuario';

describe('Usuario model', () => {
  it('debería crear un objeto Usuario con rol admin', () => {
    const usuario: Usuario = {
      id: 1,
      nombre: 'Admin',
      email: 'admin@mipime.com',
      password_hash: 'a1b2c3d4e5f6',
      salt: 'saltejemplo',
      rol: 'admin',
      activo: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    expect(usuario.nombre).toBe('Admin');
    expect(usuario.rol).toBe('admin');
    expect(usuario.activo).toBe(1);
  });

  it('debería crear un objeto Usuario con rol trabajador', () => {
    const usuario: Usuario = {
      id: 2,
      nombre: 'Trabajador',
      email: 'trabajador@mipime.com',
      password_hash: 'hash123',
      salt: 'otrasalt',
      rol: 'trabajador',
      activo: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    expect(usuario.rol).toBe('trabajador');
    expect(usuario.activo).toBe(0);
  });
});
