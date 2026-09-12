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

  // ─── R10: icono + acción opcional ─────────────────────────────────

  it('R10: renderiza el icono por defecto (inbox) cuando no se provee icono', () => {
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('.material-symbols-outlined');
    expect(icon).toBeTruthy();
    expect(icon.textContent.trim()).toBe('inbox');
  });

  it('R10: renderiza el icono provisto por input', () => {
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.componentRef.setInput('icon', 'search');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('.material-symbols-outlined');
    expect(icon.textContent.trim()).toBe('search');
  });

  it('R10: no renderiza botón de acción cuando accion no está definida', () => {
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
  });

  it('R10: renderiza botón con la etiqueta cuando accion está definida', () => {
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.componentRef.setInput('accion', 'Nuevo producto');
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Nuevo producto');
  });

  it('R10: emite accionClick al hacer click en la acción', () => {
    const emitted = vi.fn();
    fixture.componentRef.setInput('message', 'Vacío');
    fixture.componentRef.setInput('accion', 'Abrir');
    fixture.detectChanges();

    fixture.componentInstance.accionClick.subscribe(emitted);
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    fixture.detectChanges();

    expect(emitted).toHaveBeenCalledTimes(1);
  });
});
