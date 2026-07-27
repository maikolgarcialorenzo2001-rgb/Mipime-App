import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadoBadgeComponent } from './estado-badge.component';

describe('EstadoBadgeComponent', () => {
  let fixture: ComponentFixture<EstadoBadgeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EstadoBadgeComponent],
    });
    fixture = TestBed.createComponent(EstadoBadgeComponent);
  });

  it('se crea correctamente', () => {
    fixture.componentRef.setInput('estado', 'abierta');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra "Abierta" cuando estado es abierta', () => {
    fixture.componentRef.setInput('estado', 'abierta');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Abierta');
  });

  it('muestra "Cerrada" cuando estado es cerrada', () => {
    fixture.componentRef.setInput('estado', 'cerrada');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cerrada');
  });

  it('aplica clases verdes cuando es abierta', () => {
    fixture.componentRef.setInput('estado', 'abierta');
    fixture.detectChanges();

    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-green-100')).toBe(true);
    expect(span.classList.contains('text-green-700')).toBe(true);
  });

  it('aplica clases grises cuando es cerrada', () => {
    fixture.componentRef.setInput('estado', 'cerrada');
    fixture.detectChanges();

    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-gray-100')).toBe(true);
    expect(span.classList.contains('text-gray-600')).toBe(true);
  });

  it('muestra icono check_circle para abierta', () => {
    fixture.componentRef.setInput('estado', 'abierta');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('check_circle');
  });

  it('muestra icono cancel para cerrada', () => {
    fixture.componentRef.setInput('estado', 'cerrada');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('cancel');
  });
});
