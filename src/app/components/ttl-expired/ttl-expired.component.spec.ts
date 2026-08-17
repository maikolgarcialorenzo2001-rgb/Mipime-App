import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TtlExpiredComponent } from './ttl-expired.component';

describe('TtlExpiredComponent', () => {
  let fixture: ComponentFixture<TtlExpiredComponent>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TtlExpiredComponent],
    });
    fixture = TestBed.createComponent(TtlExpiredComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('se crea correctamente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza el encabezado "Versión de prueba expirada"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Versión de prueba expirada');
  });

  it('renderiza el nombre de la app "Mipime-Cuentas"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mipime-Cuentas');
  });

  it('renderiza el mensaje de contacto con "desarrollador"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('desarrollador');
  });

  it('muestra la fecha de expiración cuando first_launch existe en localStorage', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('mipime_first_launch', eightDaysAgo);

    // Re-create component so constructor reads the new localStorage value
    fixture = TestBed.createComponent(TtlExpiredComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('El acceso finalizó el');
  });

  it('no muestra fecha cuando no hay first_launch en localStorage', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('El acceso finalizó el');
  });

  it('tiene el ícono material-symbols-outlined con timer_off', () => {
    const icon = fixture.nativeElement.querySelector('.material-symbols-outlined');
    expect(icon).toBeTruthy();
    expect(icon.textContent.trim()).toBe('timer_off');
  });

  it('tiene las clases de overlay full-screen', () => {
    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.classList.contains('fixed')).toBe(true);
    expect(div.classList.contains('inset-0')).toBe(true);
    expect(div.classList.contains('z-50')).toBe(true);
  });
});
