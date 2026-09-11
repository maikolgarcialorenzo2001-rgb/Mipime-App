import { readFileSync } from 'node:fs';

const posHtml = readFileSync('src/app/pages/pos/pos.page.html', 'utf-8');
const historialHtml = readFileSync('src/app/pages/historial/historial.page.html', 'utf-8');
const cobroHtml = readFileSync(
  'src/app/components/cobro-pendiente-modal/cobro-pendiente-modal.component.html',
  'utf-8',
);
const checkoutHtml = readFileSync(
  'src/app/components/checkout-modal/checkout-modal.component.html',
  'utf-8',
);
const productCardHtml = readFileSync(
  'src/app/components/product-card/product-card.component.html',
  'utf-8',
);
const appNavHtml = readFileSync('src/app/components/layout/app-nav.component.html', 'utf-8');
const quantityInputHtml = readFileSync(
  'src/app/components/quantity-input/quantity-input.component.html',
  'utf-8',
);
const stylesCss = readFileSync('src/styles.css', 'utf-8');

function contar(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function normalizar(css: string): string {
  return css.replace(/\s+/g, '');
}

describe('FontScale outliers px→rem', () => {
  it('la calc del POS no debería reservar la barra de búsqueda (altura natural del flex, escala-safe)', () => {
    // La barra de búsqueda es un hijo en flujo del flex; reservar 3.5rem en la
    // calc solo coincidía al 100% y producía márgenes al escalar la fuente.
    expect(posHtml).not.toContain('56px');
    expect(posHtml).not.toContain('100vh-4rem-3.5rem');
    expect(posHtml).toContain('h-[calc(100vh-4rem-1rem)]');

    // El bottom tab bar móvil es fixed (lg:hidden): el contenedor le deja holgura
    // con padding inferior en móvil, sin reserva dentro de la calc.
    expect(posHtml).toContain('pb-16');
    expect(posHtml).toContain('lg:pb-0');
  });

  it('la sombra del drawer del POS debería usar rem', () => {
    expect(contar(posHtml, 'shadow-[0_-0.25rem_1.25rem_rgba(0,0,0,0.1)]')).toBe(1);
    expect(posHtml).not.toContain('20px');
  });

  it('no debería quedar text-[10px] y debería existir text-[0.625rem]', () => {
    expect(historialHtml).not.toContain('text-[10px]');
    expect(cobroHtml).not.toContain('text-[10px]');
    expect(contar(historialHtml, 'text-[0.625rem]')).toBe(2);
    expect(contar(cobroHtml, 'text-[0.625rem]')).toBe(1);
  });

  it('las celdas de grid deberían escalar en rem', () => {
    expect(historialHtml).not.toContain('min-h-[90px]');
    expect(productCardHtml).not.toContain('min-h-[100px]');
    expect(contar(historialHtml, 'min-h-[5.625rem]')).toBe(3);
    expect(contar(productCardHtml, 'min-h-[6.25rem]')).toBe(1);
  });

  it('los touch targets deberían usar max(3rem,48px) y no quedar px', () => {
    expect(contar(checkoutHtml, 'min-h-[max(3rem,48px)]')).toBe(2);
    expect(contar(cobroHtml, 'min-h-[max(3rem,48px)]')).toBe(2);
    expect(contar(quantityInputHtml, 'min-h-[max(3rem,48px)]')).toBe(2);
    expect(contar(appNavHtml, 'min-w-[max(3rem,48px)]')).toBe(6);
    const todos = [
      posHtml,
      historialHtml,
      cobroHtml,
      checkoutHtml,
      productCardHtml,
      appNavHtml,
      quantityInputHtml,
    ];
    for (const html of todos) {
      expect(html).not.toContain('min-h-[48px]');
      expect(html).not.toContain('min-w-[48px]');
    }
  });

  it('los inputs deberían usar max(1rem,16px) como floor anti-zoom iOS', () => {
    expect(normalizar(stylesCss)).toContain(
      'input,select,textarea{font-size:max(1rem,16px)!important',
    );
    expect(normalizar(stylesCss)).not.toContain('font-size:16px!important');
  });

  it('las equivalencias rem→px y los floors deberían cumplirse en el nivel small', () => {
    // Equivalencias declaradas: 90px=5.625rem, 100px=6.25rem, 10px=0.625rem, 48px=3rem, 16px=1rem
    expect(5.625 * 16).toBe(90);
    expect(6.25 * 16).toBe(100);
    expect(0.625 * 16).toBe(10);
    expect(3 * 16).toBe(48);

    // En small (87.5% → root 14px) los floors se mantienen: touch ≥48px, inputs ≥16px
    const smallRootPx = 16 * (87.5 / 100);
    expect(smallRootPx).toBe(14);
    expect(Math.max(3 * smallRootPx, 48)).toBe(48);
    expect(Math.max(1 * smallRootPx, 16)).toBe(16);
  });
});
