import { TestBed } from '@angular/core/testing';
import { CurrencyPipe } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { PesosPipe } from './pesos.pipe';

describe('PesosPipe', () => {
  let pipe: PesosPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'en-US' }],
    });
    pipe = TestBed.runInInjectionContext(() => new PesosPipe());
  });

  it('formatea un monto como pesos genérico con símbolo $ (equivalente a CurrencyPipe ARS symbol-narrow)', () => {
    const esperado = new CurrencyPipe('en-US').transform(500, 'ARS', 'symbol-narrow', '1.0-0');
    expect(pipe.transform(500, '1.0-0')).toBe(esperado);
    expect(pipe.transform(500, '1.0-0')).toBe('$500');
  });

  it('usa el locale inyectado (en-US en tests) y separadores de miles', () => {
    expect(pipe.transform(150000, '1.0-0')).toBe('$150,000');
  });

  it('aplica digitsInfo configurable', () => {
    expect(pipe.transform(1500, '1.2-2')).toBe('$1,500.00');
  });

  it('usa el formato por defecto cuando no se pasa digitsInfo', () => {
    expect(pipe.transform(1950)).toBe('$1,950');
  });

  it('devuelve null para valores nulos o indefinidos', () => {
    expect(pipe.transform(null, '1.0-0')).toBeNull();
    expect(pipe.transform(undefined, '1.0-0')).toBeNull();
  });

  it('no expone el código ARS en el output', () => {
    expect(pipe.transform(500, '1.0-0')).not.toContain('ARS');
  });
});
