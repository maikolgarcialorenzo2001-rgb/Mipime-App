import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton.component';

function barras(fixture: ComponentFixture<SkeletonComponent>): HTMLElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.bg-gray-200, .bg-gray-300'),
  ) as HTMLElement[];
}

describe('Skeleton (R9)', () => {
  let fixture: ComponentFixture<SkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonComponent],
    }).compileComponents();
  });

  it('default: variant table con rows×cols barras y aria-label', () => {
    fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('rows', 3);
    fixture.componentRef.setInput('cols', 4);
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelector('[role="status"]')).toBeTruthy();
    expect(el.querySelector('[aria-label="Cargando…"]')).toBeTruthy();
    expect(el.querySelector('.animate-pulse')).toBeTruthy();
    expect(barras(fixture)).toHaveLength(12);
  });

  it('variant grid renderiza tarjetas en grilla responsive (rows tarjetas)', () => {
    fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('variant', 'grid');
    fixture.componentRef.setInput('rows', 4);
    fixture.detectChanges();

    const el = fixture.nativeElement;
    const grid = el.querySelector('div.grid');
    expect(grid).toBeTruthy();
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).toContain('xl:grid-cols-4');
    expect(el.querySelectorAll('.rounded-xl')).toHaveLength(4);
  });

  it('variant calendar renderiza el mes en grilla de 7 columnas (rows×7 celdas)', () => {
    fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('variant', 'calendar');
    fixture.componentRef.setInput('rows', 6);
    fixture.detectChanges();

    const el = fixture.nativeElement;
    const grid = el.querySelector('div.grid');
    expect(grid.className).toContain('grid-cols-7');
    expect(el.querySelectorAll('.h-10')).toHaveLength(42);
  });

  it('es dark-safe (bg-gray-200 + dark:bg-gray-700)', () => {
    fixture = TestBed.createComponent(SkeletonComponent);
    fixture.detectChanges();

    const primera = fixture.nativeElement.querySelector('.bg-gray-200');
    expect(primera.className).toContain('dark:bg-gray-700');
  });
});