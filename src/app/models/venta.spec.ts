import type { Venta } from './venta';

describe('Venta model', () => {
  it('debería crear una Venta con forma_pago divisas y campos opcionales', () => {
    const venta: Venta = {
      id: 1,
      jornada_id: 10,
      fecha_hora: '2026-07-23T12:00:00Z',
      total: 1950,
      usuario_id: 1,
      forma_pago: 'divisas',
      divisa_tipo: 'USD',
      monto_divisa: 3,
      tasa_cambio: 650,
      created_at: '2026-07-23T12:00:00Z',
    };

    expect(venta.forma_pago).toBe('divisas');
    expect(venta.divisa_tipo).toBe('USD');
    expect(venta.monto_divisa).toBe(3);
    expect(venta.tasa_cambio).toBe(650);
  });

  it('debería crear una Venta con forma_pago pendiente y campos opcionales', () => {
    const venta: Venta = {
      id: 2,
      jornada_id: 10,
      fecha_hora: '2026-07-23T13:00:00Z',
      total: 2500,
      usuario_id: 1,
      forma_pago: 'pendiente',
      comprador_nombre: 'Carlos',
      autorizado_por: 'María',
      descripcion: 'Se lo lleva en cuenta corriente',
      created_at: '2026-07-23T13:00:00Z',
    };

    expect(venta.forma_pago).toBe('pendiente');
    expect(venta.comprador_nombre).toBe('Carlos');
    expect(venta.autorizado_por).toBe('María');
    expect(venta.descripcion).toBe('Se lo lleva en cuenta corriente');
  });

  it('debería crear una Venta sin campos opcionales (efectivo/transferencia)', () => {
    const venta: Venta = {
      id: 3,
      jornada_id: 10,
      fecha_hora: '2026-07-23T14:00:00Z',
      total: 1200,
      usuario_id: null,
      forma_pago: 'efectivo',
      created_at: '2026-07-23T14:00:00Z',
    };

    expect(venta.forma_pago).toBe('efectivo');
    expect(venta.comprador_nombre).toBeUndefined();
    expect(venta.divisa_tipo).toBeUndefined();
  });
});
