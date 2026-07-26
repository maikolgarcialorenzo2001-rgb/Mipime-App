import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorAlertComponent } from './error-alert.component';

describe('ErrorAlertComponent', () => {
  let fixture: ComponentFixture<ErrorAlertComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ErrorAlertComponent],
    });
    fixture = TestBed.createComponent(ErrorAlertComponent);
  });

  it('se crea correctamente', () => {
    fixture.componentRef.setInput('message', 'Error de prueba');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza el mensaje de error', () => {
    fixture.componentRef.setInput('message', 'Stock insuficiente');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Stock insuficiente');
  });

  it('aplica clases de estilo del alert (bg-red-50, text-red-700)', () => {
    fixture.componentRef.setInput('message', 'Error');
    fixture.detectChanges();

    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.classList.contains('bg-red-50')).toBe(true);
    expect(div.classList.contains('text-red-700')).toBe(true);
    expect(div.classList.contains('rounded-lg')).toBe(true);
  });

  it('renderiza un mensaje vacío sin errores', () => {
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();

    const div = fixture.nativeElement.querySelector('div');
    expect(div).toBeTruthy();
  });
});
