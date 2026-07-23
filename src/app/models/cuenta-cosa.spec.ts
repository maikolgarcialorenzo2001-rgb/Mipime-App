import type { CuentaCosa } from './cuenta-cosa';

describe('CuentaCosa model', () => {
  it('debería crear un objeto CuentaCosa con todos los campos', () => {
    const cc: CuentaCosa = {
      id: 1,
      jornada_id: 10,
      producto_id: 5,
      cantidad: 2,
      descripcion: 'Retiro para consumo personal',
      autorizado_por: 'Juan',
      created_at: '2026-07-23T12:00:00Z',
    };

    expect(cc.id).toBe(1);
    expect(cc.jornada_id).toBe(10);
    expect(cc.producto_id).toBe(5);
    expect(cc.cantidad).toBe(2);
    expect(cc.descripcion).toBe('Retiro para consumo personal');
    expect(cc.autorizado_por).toBe('Juan');
    expect(cc.created_at).toBe('2026-07-23T12:00:00Z');
  });

  it('debería permitir descripcion null', () => {
    const cc: CuentaCosa = {
      id: 2,
      jornada_id: 10,
      producto_id: 8,
      cantidad: 1.5,
      descripcion: null,
      autorizado_por: 'María',
      created_at: '2026-07-23T13:00:00Z',
    };

    expect(cc.descripcion).toBeNull();
    expect(cc.cantidad).toBe(1.5);
    expect(cc.autorizado_por).toBe('María');
  });
});
