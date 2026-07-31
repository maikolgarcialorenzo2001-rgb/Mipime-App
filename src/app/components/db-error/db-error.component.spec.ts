import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DbErrorComponent } from './db-error.component';
import { DbStatusService } from '../../services/db-status.service';

const DIAGNOSTICS: DbDiagnostics = {
  appVersion: '0.1.8-beta',
  platform: 'win32',
  sqliteError: 'integrity check failed: database disk image is malformed',
  stage: 'open',
  backupsTried: [{ path: 'tienda-app.db', reason: 'open/validate failed' }],
};

describe('DbErrorComponent', () => {
  let fixture: ComponentFixture<DbErrorComponent>;
  let dbStatus: DbStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DbErrorComponent],
    });
    dbStatus = TestBed.inject(DbStatusService);
    dbStatus.setFatal(DIAGNOSTICS);
    fixture = TestBed.createComponent(DbErrorComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    dbStatus.setFatal(null);
  });

  it('se crea correctamente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza el título "Error crítico en la base de datos"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Error crítico en la base de datos');
  });

  it('renderiza el mensaje de contacto "Contactá al desarrollador"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Contactá al desarrollador');
  });

  it('muestra el sqliteError del diagnóstico', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain(
      'integrity check failed: database disk image is malformed',
    );
  });

  it('muestra los backups intentados con su motivo', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('tienda-app.db');
    expect(text).toContain('open/validate failed');
  });

  it('tiene el ícono material-symbols-outlined de error', () => {
    const icon = fixture.nativeElement.querySelector('.material-symbols-outlined');
    expect(icon).toBeTruthy();
  });

  it('tiene las clases de overlay full-screen (R5: bloquea toda la UI)', () => {
    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.classList.contains('fixed')).toBe(true);
    expect(div.classList.contains('inset-0')).toBe(true);
    expect(div.classList.contains('z-50')).toBe(true);
  });

  it('copia el diagnóstico en JSON al hacer clic en "Copiar diagnóstico"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    button.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('integrity check failed: database disk image is malformed'),
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"backupsTried"'));
  });

  it('no muestra el bloque de diagnóstico ni el botón cuando no hay fatal', () => {
    dbStatus.setFatal(null);
    fixture = TestBed.createComponent(DbErrorComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Copiar diagnóstico');
    expect(text).not.toContain('integrity check failed');
  });
});
