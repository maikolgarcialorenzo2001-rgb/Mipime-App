import { UNIDAD_MEDIDA } from './producto';

describe('UNIDAD_MEDIDA', () => {
  it('unidad: suffix u., step 1, no decimals', () => {
    expect(UNIDAD_MEDIDA.unidad.suffix).toBe('u.');
    expect(UNIDAD_MEDIDA.unidad.step).toBe(1);
    expect(UNIDAD_MEDIDA.unidad.allowsDecimal).toBe(false);
  });

  it('gramaje: suffix lb, step 0.1, allows decimals', () => {
    expect(UNIDAD_MEDIDA.gramaje.suffix).toBe('lb');
    expect(UNIDAD_MEDIDA.gramaje.step).toBe(0.1);
    expect(UNIDAD_MEDIDA.gramaje.allowsDecimal).toBe(true);
  });
});
