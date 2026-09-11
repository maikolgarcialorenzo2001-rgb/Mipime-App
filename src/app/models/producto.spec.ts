import { UNIDAD_MEDIDA, unidadMedidaInfo } from './producto';

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

describe('unidadMedidaInfo — accessor seguro con fallback', () => {
  it('AC-1: valor conocido "unidad" → definición exacta de unidad', () => {
    expect(unidadMedidaInfo('unidad')).toEqual({
      suffix: 'u.',
      step: 1,
      allowsDecimal: false,
    });
  });

  it('AC-2: valor conocido "gramaje" → definición exacta de gramaje', () => {
    expect(unidadMedidaInfo('gramaje')).toEqual({
      suffix: 'lb',
      step: 0.1,
      allowsDecimal: true,
    });
  });

  it('AC-3: null → fallback unidad sin lanzar', () => {
    expect(unidadMedidaInfo(null)).toEqual(UNIDAD_MEDIDA.unidad);
  });

  it('AC-4: undefined → fallback unidad sin lanzar', () => {
    expect(unidadMedidaInfo(undefined)).toEqual(UNIDAD_MEDIDA.unidad);
  });

  it('AC-5: "" → fallback unidad sin lanzar', () => {
    expect(unidadMedidaInfo('')).toEqual(UNIDAD_MEDIDA.unidad);
  });

  it('AC-6: "KILOGRAMO" (desconocido) → fallback unidad sin lanzar', () => {
    expect(unidadMedidaInfo('KILOGRAMO')).toEqual(UNIDAD_MEDIDA.unidad);
  });

  it('AC-7: tipo number corrupto (42) → fallback unidad sin lanzar', () => {
    expect(unidadMedidaInfo(42 as unknown as string)).toEqual(
      UNIDAD_MEDIDA.unidad,
    );
  });
});
