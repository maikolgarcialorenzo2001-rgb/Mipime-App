import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('debería iniciar en modo claro por defecto (isDark() === false)', () => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
  });

  it('debería persistir el estado en localStorage tras toggle()', () => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(service.isDark()).toBe(true);

    service.toggle();
    expect(localStorage.getItem('theme')).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('debería agregar la clase .dark a <html> cuando se activa', () => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    service.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('debería quitar la clase .dark de <html> al desactivar', () => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    service.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('debería restaurar modo oscuro desde localStorage en el constructor', () => {
    localStorage.setItem('theme', 'dark');

    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('no debería agregar .dark si localStorage tiene "light"', () => {
    localStorage.setItem('theme', 'light');

    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('debería tratar valores inválidos de localStorage como modo claro', () => {
    localStorage.setItem('theme', 'invalid-value');

    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('debería mantener estado correcto tras múltiples toggles', () => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);

    service.toggle();
    expect(service.isDark()).toBe(true);

    service.toggle();
    expect(service.isDark()).toBe(false);

    service.toggle();
    expect(service.isDark()).toBe(true);

    service.toggle();
    expect(service.isDark()).toBe(false);
  });
});
