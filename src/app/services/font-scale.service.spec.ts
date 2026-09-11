import { TestBed } from '@angular/core/testing';
import { FontScaleService, type FontScaleLevel } from './font-scale.service';

function limpiarMarcadores(): void {
  document.documentElement.classList.remove(
    ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
  );
}

function tieneAlgunMarcador(): boolean {
  return [...document.documentElement.classList].some((c) => c.startsWith('font-scale-'));
}

describe('FontScaleService', () => {
  beforeEach(() => {
    localStorage.clear();
    limpiarMarcadores();
  });

  afterEach(() => {
    localStorage.clear();
    limpiarMarcadores();
  });

  function crearServicio(): FontScaleService {
    TestBed.configureTestingModule({ providers: [FontScaleService] });
    return TestBed.inject(FontScaleService);
  }

  it('debería iniciar en normal sin marcador cuando no hay valor previo', () => {
    const service = crearServicio();

    expect(service.level()).toBe('normal');
    expect(tieneAlgunMarcador()).toBe(false);
  });

  it('debería aplicar font-scale-small y persistirlo al llamar setLevel("small")', () => {
    const service = crearServicio();

    service.setLevel('small');

    expect(service.level()).toBe('small');
    expect(document.documentElement.classList.contains('font-scale-small')).toBe(true);
    expect(localStorage.getItem('fontScale')).toBe('small');
  });

  it('debería aplicar font-scale-large y persistirlo al llamar setLevel("large")', () => {
    const service = crearServicio();

    service.setLevel('large');

    expect(service.level()).toBe('large');
    expect(document.documentElement.classList.contains('font-scale-large')).toBe(true);
    expect(localStorage.getItem('fontScale')).toBe('large');
  });

  it('debería aplicar font-scale-xlarge y persistirlo al llamar setLevel("xlarge")', () => {
    const service = crearServicio();

    service.setLevel('xlarge');

    expect(service.level()).toBe('xlarge');
    expect(document.documentElement.classList.contains('font-scale-xlarge')).toBe(true);
    expect(localStorage.getItem('fontScale')).toBe('xlarge');
  });

  it('debería aplicar font-scale-xxlarge y persistirlo al llamar setLevel("xxlarge")', () => {
    const service = crearServicio();

    service.setLevel('xxlarge');

    expect(service.level()).toBe('xxlarge');
    expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(true);
    expect(localStorage.getItem('fontScale')).toBe('xxlarge');
  });

  it('debería remover el marcador de <html> y persistir "normal" al llamar setLevel("normal")', () => {
    const service = crearServicio();

    service.setLevel('xxlarge');
    service.setLevel('normal');

    expect(service.level()).toBe('normal');
    expect(tieneAlgunMarcador()).toBe(false);
    expect(localStorage.getItem('fontScale')).toBe('normal');
  });

  it('debería reemplazar el marcador previo al cambiar de nivel', () => {
    const service = crearServicio();

    service.setLevel('large');
    service.setLevel('xlarge');

    expect(document.documentElement.classList.contains('font-scale-large')).toBe(false);
    expect(document.documentElement.classList.contains('font-scale-xlarge')).toBe(true);
  });

  it('debería restaurar el marcador desde localStorage en el constructor (recarga)', () => {
    localStorage.setItem('fontScale', 'xxlarge');

    const service = crearServicio();

    expect(service.level()).toBe('xxlarge');
    expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(true);
  });

  it('debería tratar valores inválidos de localStorage como normal sin marcador', () => {
    localStorage.setItem('fontScale', 'invalid');

    const service = crearServicio();

    expect(service.level()).toBe('normal');
    expect(tieneAlgunMarcador()).toBe(false);
  });

  it('debería exponer percentage y label para cada nivel', () => {
    const service = crearServicio();
    const esperado: [FontScaleLevel, number, string][] = [
      ['small', 87.5, 'Pequeña'],
      ['normal', 100, 'Normal'],
      ['large', 112.5, 'Grande'],
      ['xlarge', 125, 'Muy grande'],
      ['xxlarge', 135, 'Extra grande'],
    ];

    for (const [nivel, pct, label] of esperado) {
      service.setLevel(nivel);
      expect(service.percentage()).toBe(pct);
      expect(service.label()).toBe(label);
    }
  });
});
