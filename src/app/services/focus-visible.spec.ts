import { readFileSync } from 'node:fs';

const stylesCss = readFileSync('src/styles.css', 'utf-8');

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

/** Extrae el cuerpo de la primera regla cuyo selector (normalizado) matchee.
 *  Cuenta llaves para no romperse con bloques anidados (Tailwind v4 no anida
 *  acá, pero el patrón es robusto ante @media y bloques anidados futuros). */
function regla(selector: string): string {
  const normalizado = normalizar(stylesCss);
  const sel = normalizar(selector);
  const inicio = normalizado.indexOf(sel + '{');
  if (inicio === -1) return '';

  let profundidad = 1;
  let i = inicio + sel.length + 1; // después del '{' que abre la regla
  const cuerpo: string[] = [];
  while (i < normalizado.length && profundidad > 0) {
    const ch = normalizado[i];
    if (ch === '{') profundidad++;
    else if (ch === '}') profundidad--;
    if (profundidad > 0) cuerpo.push(ch);
    i++;
  }
  return cuerpo.join('');
}

const SELECTOR =
  ':where(a, button, input, select, textarea, summary, [tabindex]):focus-visible';

describe('R5: anillo de foco visible solo por teclado (focus-visible)', () => {
  it('debería declarar un anillo azul para los controles interactivos al enfocar por teclado', () => {
    const cuerpo = regla(SELECTOR);

    expect(cuerpo).toContain('outline:2pxsolid#2563eb'); // blue-600
    expect(cuerpo).toContain('outline-offset:2px');
  });

  it('la variante oscura debería usar un anillo más claro (#60a5fa)', () => {
    const cuerpo = regla(`.dark ${SELECTOR}`);

    expect(cuerpo).toContain('outline-color:#60a5fa'); // blue-400
  });

  it('el selector debería usar :where() (especificidad 0) para no pisar utilities focus:outline-none ni focus:ring-*', () => {
    // El anillo es un fallback global: utilities específicas del componente
    // (outline-none, ring-2) deben seguir ganando. :where() = especificidad 0.
    expect(regla(SELECTOR)).not.toBe('');
    expect(SELECTOR.startsWith(':where(')).toBe(true);
    expect(stylesCss).not.toContain('button:focus-visible');
    expect(stylesCss).not.toContain('a:focus-visible');
  });

  it('el anillo no debería transicionar (outline no está en la lista de transiciones de R4)', () => {
    // R4 transiciona background-color/color/border-color/box-shadow; el outline
    // del anillo debe aparecer al instante (feedback inmediato de foco).
    expect(normalizar(stylesCss)).toContain(
      'transition:background-color250msease,color250msease,border-color250msease,box-shadow250msease',
    );
  });
});