import { readFileSync } from 'node:fs';

const stylesCss = readFileSync('src/styles.css', 'utf-8');

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

/** Extrae el cuerpo normalizado de un @media por su condición (hasta el
 *  último } del archivo, capturando los bloques anidados). */
function mediaQuery(condicion: string): string {
  const match = normalizar(stylesCss).match(
    new RegExp(`@media\\(${condicion}\\)\\{([\\s\\S]*)\\}`),
  );
  // Sin ; antes de } para que las declaraciones finales matcheen sin importar
  // si la fuente dejó un punto y coma de cierre.
  return (match?.[1] ?? '').replace(/;}/g, '}');
}

describe('R4: motion global retune y prefers-reduced-motion', () => {
  it('no debería existir la transición global fija de 0.6s', () => {
    // La regla vieja (universal sin media query) hacía que TODA transición
    // de tema durara 0.6s, incluyendo movimiento no deseado.
    expect(normalizar(stylesCss)).not.toContain('background-color0.6s');
  });

  it('prefers-reduced-motion: no-preference debería declarar transiciones de tema ≤ 300ms', () => {
    const bloque = mediaQuery('prefers-reduced-motion:no-preference');

    expect(bloque).toContain('background-color');
    expect(bloque).toMatch(/\*/);

    const duraciones = (bloque.match(/(\d+(?:\.\d+)?)ms/g) ?? []).map((d) =>
      parseFloat(d),
    );
    expect(duraciones.length).toBeGreaterThan(0);
    for (const duracion of duraciones) {
      expect(duracion).toBeLessThanOrEqual(300);
    }
  });

  it('prefers-reduced-motion: reduce debería recortar transiciones y animaciones', () => {
    const bloque = mediaQuery('prefers-reduced-motion:reduce');

    expect(bloque).toContain('transition-duration:0.01ms!important');
    expect(bloque).toContain('animation-duration:0.01ms!important');
  });

  it('prefers-reduced-motion: reduce debería apagar la animación del toast (animate-fade-in) por cascada', () => {
    const bloque = mediaQuery('prefers-reduced-motion:reduce');

    // Debe ganar aunque .animate-fade-in se defina más abajo en el archivo:
    // se usa !important para vencer la declaración normal posterior.
    expect(bloque).toContain('.animate-fade-in{animation:none!important}');
  });
});