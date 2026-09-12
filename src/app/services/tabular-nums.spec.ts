import { readFileSync } from 'node:fs';

const stylesCss = readFileSync('src/styles.css', 'utf-8');

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

function cuerpoNormalizado(): string {
  const match = stylesCss.match(/\bbody\s*\{([^}]*)\}/);
  return normalizar(match?.[1] ?? '');
}

describe('Dígitos tabulares globales (R2)', () => {
  it('debería declarar font-variant-numeric: tabular-nums en body', () => {
    // R2: una única regla global en body evita saltos de ancho en cifras sin
    // duplicar clases por elemento. Los spans existentes con tabular-nums se mantienen.
    expect(cuerpoNormalizado()).toContain('font-variant-numeric:tabular-nums');
  });

  it('no debería declarar font-variant-numeric en otros selectores (regla única global)', () => {
    const declaraciones = normalizar(stylesCss).match(/font-variant-numeric:tabular-nums/g) ?? [];
    expect(declaraciones).toHaveLength(1);
  });
});
