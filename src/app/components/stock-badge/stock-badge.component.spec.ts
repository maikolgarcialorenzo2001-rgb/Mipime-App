import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockBadgeComponent } from './stock-badge.component';

describe('StockBadgeComponent', () => {
  let fixture: ComponentFixture<StockBadgeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StockBadgeComponent],
    });
    fixture = TestBed.createComponent(StockBadgeComponent);
  });

  it('se crea con stock=5 y renderiza el span', () => {
    fixture.componentRef.setInput('stock', 5);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span).toBeTruthy();
    expect(span.textContent).toContain('5');
  });

  it('por defecto (unidad) muestra el sufijo "u."', () => {
    fixture.componentRef.setInput('stock', 5);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('5 u.');
  });

  it('unidadMedida=gramaje muestra el sufijo "lb"', () => {
    fixture.componentRef.setInput('stock', 2.5);
    fixture.componentRef.setInput('unidadMedida', 'gramaje');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('2.5 lb');
  });

  it('unidadMedida=unidad muestra el sufijo "u."', () => {
    fixture.componentRef.setInput('stock', 7);
    fixture.componentRef.setInput('unidadMedida', 'unidad');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('7 u.');
  });

  it('stock > 10 aplica clases bg-green-100/text-green-700 + dark: companion', () => {
    fixture.componentRef.setInput('stock', 25);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-green-100')).toBe(true);
    expect(span.classList.contains('text-green-700')).toBe(true);
    expect(span.classList.contains('dark:bg-green-900/40')).toBe(true);
    expect(span.classList.contains('dark:text-green-400')).toBe(true);
  });

  it('stock entre 1 y 10 aplica clases bg-yellow-100/text-yellow-600 + dark: companion', () => {
    fixture.componentRef.setInput('stock', 5);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-yellow-100')).toBe(true);
    expect(span.classList.contains('text-yellow-600')).toBe(true);
    expect(span.classList.contains('dark:bg-yellow-900/40')).toBe(true);
    expect(span.classList.contains('dark:text-yellow-400')).toBe(true);
  });

  it('stock = 0 aplica clases bg-red-100/text-red-700 + dark: companion', () => {
    fixture.componentRef.setInput('stock', 0);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-red-100')).toBe(true);
    expect(span.classList.contains('text-red-700')).toBe(true);
    expect(span.classList.contains('dark:bg-red-900/40')).toBe(true);
    expect(span.classList.contains('dark:text-red-400')).toBe(true);
  });

  it('stock negativo aplica clases bg-red-100/text-red-700 + dark: companion', () => {
    fixture.componentRef.setInput('stock', -5);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.classList.contains('bg-red-100')).toBe(true);
    expect(span.classList.contains('text-red-700')).toBe(true);
    expect(span.classList.contains('dark:bg-red-900/40')).toBe(true);
    expect(span.classList.contains('dark:text-red-400')).toBe(true);
  });

  // ─── REQ-5: suffix coverage by unidad_medida ──────────────────────

  it('REQ-5: stock entero con gramaje muestra sufijo "lb" sin decimales extra', () => {
    fixture.componentRef.setInput('stock', 3);
    fixture.componentRef.setInput('unidadMedida', 'gramaje');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('3 lb');
  });

  it('REQ-5: stock decimal con unidad muestra sufijo "u." con el valor exacto', () => {
    fixture.componentRef.setInput('stock', 2.5);
    fixture.componentRef.setInput('unidadMedida', 'unidad');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('2.5 u.');
  });

  it('REQ-5: stock=0 con unidad muestra "0 u."', () => {
    fixture.componentRef.setInput('stock', 0);
    fixture.componentRef.setInput('unidadMedida', 'unidad');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('0 u.');
  });

  it('REQ-5: stock=0 con gramaje muestra "0 lb"', () => {
    fixture.componentRef.setInput('stock', 0);
    fixture.componentRef.setInput('unidadMedida', 'gramaje');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent!.trim()).toBe('0 lb');
  });
});
