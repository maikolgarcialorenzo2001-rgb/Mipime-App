import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppToastComponent } from './app-toast.component';
import { ToastService } from '../../services/toast.service';

describe('AppToast (R8)', () => {
  let fixture: ComponentFixture<AppToastComponent>;
  let service: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppToastComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AppToastComponent);
    service = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('con la lista vacía solo expone el contenedor aria-live', () => {
    const live = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('muestra el mensaje en un contenedor role=status', () => {
    service.success('Guardado');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[role="status"]');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('Guardado');
  });

  it('apila varios toasts en orden de creación', () => {
    service.success('Primero');
    service.info('Segundo');
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Primero');
    expect(items[1].textContent).toContain('Segundo');
  });

  it('aplica el color según el tipo de toast', () => {
    service.success('ok');
    service.error('boom');
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="status"], [role="alert"]');
    expect(items[0].classList.contains('bg-green-500')).toBe(true);
    expect(items[1].classList.contains('bg-red-500')).toBe(true);
  });

  it('asigna role=alert a los toasts de error y role=status a success/info (D5)', () => {
    service.error('Boom');
    service.success('OK');
    service.info('Info');
    fixture.detectChanges();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toContain('Boom');
    const statuses = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(statuses.length).toBe(2);
    expect(statuses[0].textContent).toContain('OK');
    expect(statuses[1].textContent).toContain('Info');
  });

  it('el botón X descarta ese toast', () => {
    service.success('Descartable');
    service.success('Otro');
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector(
      'button[aria-label^="Cerrar"]',
    ) as HTMLButtonElement;
    expect(boton).toBeTruthy();
    boton.click();
    fixture.detectChanges();
    expect(service.toasts().map((t) => t.mensaje)).toEqual(['Otro']);
    expect(fixture.nativeElement.textContent).not.toContain('Descartable');
  });
});