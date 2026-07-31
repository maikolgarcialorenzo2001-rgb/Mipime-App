import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RestoreFeedbackComponent } from './restore-feedback.component';
import { DbStatusService } from '../../services/db-status.service';

const INFO: DbRestoreInfo = {
  from: 'timestamped',
  path: '/backups/tienda_2026-06-02_1407.db',
  when: '2026-06-02T14:07:00Z',
  lostWindowMs: 3 * 3600000,
};

describe('RestoreFeedbackComponent', () => {
  let fixture: ComponentFixture<RestoreFeedbackComponent>;
  let dbStatus: DbStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RestoreFeedbackComponent],
    });
    dbStatus = TestBed.inject(DbStatusService);
    dbStatus.setRestoreInfo(INFO);
    fixture = TestBed.createComponent(RestoreFeedbackComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    dbStatus.setRestoreInfo(null);
  });

  it('se crea correctamente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('no renderiza nada cuando no hay restoreInfo (R4: solo aviso cuando corresponde)', () => {
    dbStatus.setRestoreInfo(null);
    fixture = TestBed.createComponent(RestoreFeedbackComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('muestra el título "Base de datos restaurada"', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'Base de datos restaurada',
    );
  });

  it('muestra el origen de la restauración (from → etiqueta)', () => {
    expect(fixture.nativeElement.textContent).toContain('copia con fecha');
  });

  it('muestra el cuándo del backup restaurado (formato es-AR determinístico, no tautológico)', () => {
    const text = fixture.nativeElement.textContent;
    // Pinea el formato concreto que el toast debe producir a partir del when
    // ISO: es-AR = d/m/yyyy + hora 24h (sin AM/PM). Independiente del TZ del
    // host: el año siempre es 2026.
    expect(text).toMatch(/\d{1,2}\/\d{1,2}\/2026/);
    expect(text).not.toMatch(/AM|PM/);
  });

  it('muestra la ventana de pérdida estimada (lostWindowMs)', () => {
    expect(fixture.nativeElement.textContent).toContain('3 h');
  });

  it('es NO bloqueante: toast anclado abajo-derecha, sin overlay full-screen (R4)', () => {
    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.classList.contains('fixed')).toBe(true);
    expect(div.classList.contains('inset-0')).toBe(false);
  });

  it('descartar() limpia restoreInfo y oculta el toast', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();

    expect(dbStatus.restoreInfo()).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('no muestra ventana de pérdida cuando lostWindowMs es 0', () => {
    dbStatus.setRestoreInfo({ ...INFO, lostWindowMs: 0 });
    fixture = TestBed.createComponent(RestoreFeedbackComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('se perdieron');
  });

  it('mapea las etiquetas de origen para cada RestoreFrom', () => {
    const labels = fixture.componentInstance.originLabel;
    const cases: Array<[RestoreFrom, string]> = [
      ['recover', 'recuperada'],
      ['rodante', 'rodante'],
      ['timestamped', 'fecha'],
      ['adopt', 'adoptado'],
    ];
    for (const [from, fragment] of cases) {
      dbStatus.setRestoreInfo({ ...INFO, from });
      expect(labels()).toContain(fragment);
    }
  });
});
