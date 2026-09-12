import { readFileSync } from 'node:fs';
import type { FontScaleLevel } from './font-scale.service';

const stylesCss = readFileSync('src/styles.css', 'utf-8');

const RULE_REGEX = /html\.font-scale-([a-z]+)\s*\{([^}]*)\}/g;
const PCT_REGEX = /font-size\s*:\s*([\d.]+)%/;
const BASE_PX = 16;

function extraerReglas(): Map<string, string> {
  const rules = new Map<string, string>();
  for (const match of stylesCss.matchAll(RULE_REGEX)) {
    rules.set(match[1], match[0]);
  }
  return rules;
}

function porcentajeDeRegla(rules: Map<string, string>, level: FontScaleLevel): number {
  if (level === 'normal') return 100;
  const match = (rules.get(level) ?? '').match(PCT_REGEX);
  return match ? Number(match[1]) : Number.NaN;
}

function aplicarMarcador(level: FontScaleLevel | null): void {
  document.documentElement.classList.remove(
    ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
  );
  if (level !== null) {
    document.documentElement.classList.add(`font-scale-${level}`);
  }
}

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

describe('FontScale CSS root', () => {
  const rules = extraerReglas();

  function inyectarReglas(): void {
    const style = document.createElement('style');
    style.id = 'font-scale-test';
    style.textContent = [...rules.values()].join('\n');
    document.head.appendChild(style);
  }

  beforeEach(() => {
    aplicarMarcador(null);
    inyectarReglas();
  });

  afterEach(() => {
    document.getElementById('font-scale-test')?.remove();
    aplicarMarcador(null);
  });

  it('debería definir reglas html.font-scale-* con los porcentajes del spec', () => {
    expect(normalizar(rules.get('small') ?? '')).toContain('font-size:87.5%');
    expect(normalizar(rules.get('large') ?? '')).toContain('font-size:112.5%');
    expect(normalizar(rules.get('xlarge') ?? '')).toContain('font-size:125%');
    expect(normalizar(rules.get('xxlarge') ?? '')).toContain('font-size:135%');
  });

  it('no debería existir regla font-scale-normal (ausencia de marcador = normal)', () => {
    expect(rules.has('normal')).toBe(false);
  });

  it('debería aplicar el porcentaje declarado al root cuando el marcador está presente', () => {
    const esperado: [FontScaleLevel, string][] = [
      ['small', '87.5%'],
      ['large', '112.5%'],
      ['xlarge', '125%'],
      ['xxlarge', '135%'],
    ];

    for (const [nivel, pct] of esperado) {
      aplicarMarcador(nivel);
      expect(getComputedStyle(document.documentElement).fontSize).toBe(pct);
    }
  });

  it('sin marcador ninguna regla font-scale aplica al root (default 16px del navegador)', () => {
    aplicarMarcador(null);
    expect(getComputedStyle(document.documentElement).fontSize).toBe('');

    aplicarMarcador('small');
    expect(getComputedStyle(document.documentElement).fontSize).toBe('87.5%');

    aplicarMarcador(null);
    expect(getComputedStyle(document.documentElement).fontSize).toBe('');
  });

  it('debería producir los px esperados por el spec a partir del porcentaje declarado', () => {
    const esperadoPx: [FontScaleLevel, number][] = [
      ['small', 14],
      ['normal', 16],
      ['large', 18],
      ['xlarge', 20],
      ['xxlarge', 21.6],
    ];

    for (const [nivel, px] of esperadoPx) {
      const pct = porcentajeDeRegla(rules, nivel);
      expect(BASE_PX * (pct / 100)).toBeCloseTo(px, 2);
    }
  });
});
