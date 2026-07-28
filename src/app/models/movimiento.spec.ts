import type { Movimiento } from './movimiento';

describe('Movimiento model', () => {
  it('debería crear un Movimiento con tipo compra_divisa y campos de divisa', () => {
    const mov: Movimiento = {
      id: 1,
      jornada_id: 10,
      tipo: 'compra_divisa',
      descripcion: 'Compra de USD',
      monto: -1950,
      divisa_tipo: 'USD',
      monto_divisa: 3,
      tasa_cambio: 650,
      created_at: '2026-07-28T12:00:00Z',
    };

    expect(mov.tipo).toBe('compra_divisa');
    expect(mov.divisa_tipo).toBe('USD');
    expect(mov.monto_divisa).toBe(3);
    expect(mov.tasa_cambio).toBe(650);
  });

  it('debería crear un Movimiento con tipo compra_divisa y divisa EUR', () => {
    const mov: Movimiento = {
      id: 2,
      jornada_id: 10,
      tipo: 'compra_divisa',
      descripcion: 'Compra de EUR',
      monto: -2400,
      divisa_tipo: 'EUR',
      monto_divisa: 4,
      tasa_cambio: 600,
      created_at: '2026-07-28T13:00:00Z',
    };

    expect(mov.tipo).toBe('compra_divisa');
    expect(mov.divisa_tipo).toBe('EUR');
    expect(mov.monto_divisa).toBe(4);
    expect(mov.tasa_cambio).toBe(600);
  });

  it('debería crear un Movimiento sin campos opcionales de divisa', () => {
    const mov: Movimiento = {
      id: 3,
      jornada_id: 10,
      tipo: 'gasto',
      descripcion: 'Compra de insumos',
      monto: -500,
      created_at: '2026-07-28T14:00:00Z',
    };

    expect(mov.tipo).toBe('gasto');
    expect(mov.divisa_tipo).toBeUndefined();
    expect(mov.monto_divisa).toBeUndefined();
    expect(mov.tasa_cambio).toBeUndefined();
  });
});
