import { readFileSync } from 'node:fs';

const stylesCss = readFileSync('src/styles.css', 'utf-8');

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

describe('Dark mode scrollbars nativos (color-scheme)', () => {
  it('debería aplicar color-scheme: dark en la raíz .dark para que todos los scrollbars nativos sean oscuros', () => {
    // La raíz .dark (html) debe declarar color-scheme: dark; los contenedores
    // con overflow-* heredan el scheme y sus scrollbars nativos se vuelven oscuros.
    expect(normalizar(stylesCss)).toContain('.dark{color-scheme:dark');
  });

  it('debería mantener color-scheme explícito en selects y options (dropdowns nativos)', () => {
    expect(normalizar(stylesCss)).toContain('.darkselect,.darkselectoption{color-scheme:dark');
  });
});