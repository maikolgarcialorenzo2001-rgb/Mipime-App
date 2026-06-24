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
});
