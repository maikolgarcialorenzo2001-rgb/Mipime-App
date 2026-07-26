import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    });
    fixture = TestBed.createComponent(EmptyStateComponent);
  });

  it('se crea correctamente', () => {
    fixture.componentRef.setInput('message', 'Sin resultados');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza el mensaje proporcionado', () => {
    fixture.componentRef.setInput('message', 'No hay productos en el carrito');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay productos en el carrito');
  });

  it('renderiza un mensaje vacío sin errores', () => {
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();

    const div = fixture.nativeElement.querySelector('div');
    expect(div).toBeTruthy();
  });

  it('renderiza el contenedor con clases de centrado', () => {
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.detectChanges();

    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.classList.contains('flex')).toBe(true);
    expect(div.classList.contains('items-center')).toBe(true);
    expect(div.classList.contains('justify-center')).toBe(true);
  });
});
