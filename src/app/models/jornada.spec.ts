import type { Jornada } from './jornada';

describe('Jornada model', () => {
  it('debería crear una Jornada con total_usd y total_eur', () => {
    const jornada: Jornada = {
      id: 1,
      fecha: '2026-07-28',
      hora_apertura: '08:00',
      hora_cierre: '18:00',
      monto_inicial: 5000,
      total_ventas: 15000,
      total_movimientos: 2000,
      saldo_esperado: 18000,
      saldo_real: 17950,
      estado: 'cerrada',
      user_cierre_id: 1,
      user_apertura_id: 1,
      total_merma: 0,
      total_usd: 50,
      total_eur: 100,
      created_at: '2026-07-28T08:00:00Z',
      updated_at: '2026-07-28T18:00:00Z',
    };

    expect(jornada.total_usd).toBe(50);
    expect(jornada.total_eur).toBe(100);
  });

  it('debería crear una Jornada sin total_usd ni total_eur (opcionales)', () => {
    const jornada: Jornada = {
      id: 2,
      fecha: '2026-07-27',
      hora_apertura: '08:00',
      hora_cierre: null,
      monto_inicial: 3000,
      total_ventas: 8000,
      total_movimientos: 1000,
      saldo_esperado: 10000,
      saldo_real: null,
      estado: 'abierta',
      user_cierre_id: null,
      user_apertura_id: 1,
      total_merma: 0,
      created_at: '2026-07-27T08:00:00Z',
      updated_at: '2026-07-27T18:00:00Z',
    };

    expect(jornada.total_usd).toBeUndefined();
    expect(jornada.total_eur).toBeUndefined();
  });
});
