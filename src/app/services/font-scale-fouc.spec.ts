import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('src/index.html', 'utf-8');

const SCRIPT_REGEX = /<script>([\s\S]*?)<\/script>/g;

function extraerScripts(): string[] {
  const scripts: string[] = [];
  for (const match of indexHtml.matchAll(SCRIPT_REGEX)) {
    scripts.push(match[1]);
  }
  return scripts;
}

function aplicarPreBoot(): void {
  for (const script of extraerScripts()) {
    // Ejecuta los scripts inline del head tal cual correrían antes del bootstrap
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(script)();
  }
}

function limpiarMarcadores(): void {
  document.documentElement.classList.remove(
    ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
  );
}

describe('FontScale pre-boot FOUC', () => {
  beforeEach(() => {
    localStorage.clear();
    limpiarMarcadores();
  });

  afterEach(() => {
    localStorage.clear();
    limpiarMarcadores();
  });

  it('debería existir un script pre-boot de escala antes de <app-root>', () => {
    expect(indexHtml).toContain("localStorage.getItem('fontScale')");
    const scriptPos = indexHtml.indexOf("localStorage.getItem('fontScale')");
    expect(scriptPos).toBeGreaterThanOrEqual(0);
    expect(indexHtml.indexOf('<app-root>')).toBeGreaterThan(scriptPos);
  });

  it('debería restaurar el marcador ANTES del bootstrap al ejecutar el pre-boot', () => {
    localStorage.setItem('fontScale', 'xxlarge');

    aplicarPreBoot();

    expect(document.documentElement.classList.contains('font-scale-xxlarge')).toBe(true);
  });

  it('debería aplicar la clase correcta para cada nivel válido de la whitelist', () => {
    const niveles: [string, string][] = [
      ['small', 'font-scale-small'],
      ['large', 'font-scale-large'],
      ['xlarge', 'font-scale-xlarge'],
      ['xxlarge', 'font-scale-xxlarge'],
    ];

    for (const [stored, cls] of niveles) {
      limpiarMarcadores();
      localStorage.setItem('fontScale', stored);
      aplicarPreBoot();
      expect(document.documentElement.classList.contains(cls)).toBe(true);
    }
  });

  it('debería tratar valores inválidos como normal (sin marcador)', () => {
    localStorage.setItem('fontScale', 'huge');

    aplicarPreBoot();

    const tieneMarcador = [...document.documentElement.classList].some((c) =>
      c.startsWith('font-scale-'),
    );
    expect(tieneMarcador).toBe(false);
  });
});
