import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductosPage } from './producto.page';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import { Observable, of, throwError } from 'rxjs';
import type { Producto } from '../../models';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

const mockProductos: Producto[] = [
  { id: 1, nombre: 'Café', descripcion: null, precio_costo: 300, precio_venta: 500, stock_almacen: 10, stock_shop: 0, created_at: '', updated_at: '' },
  { id: 2, nombre: 'Té', descripcion: 'Té negro', precio_costo: 200, precio_venta: 350, stock_almacen: 25, stock_shop: 0, created_at: '', updated_at: '' },
];

describe('ProductosPage', () => {
  let fixture: ComponentFixture<ProductosPage>;
  let component: ProductosPage;
  let productoService: ProductoService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStockService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockJornadaService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      usuario: vi.fn().mockReturnValue({ id: 1, nombre: 'Admin', rol: 'admin' }),
    };
    mockStockService = {
      registrarMerma: vi.fn().mockResolvedValue({ consumos: [], costoTotal: 0 }),
    };
    mockJornadaService = {
      jornadaAbierta: vi.fn().mockReturnValue(null),
    };

    TestBed.configureTestingModule({
      imports: [ProductosPage],
      providers: [
        ProductoService,
        { provide: DATABASE, useValue: createMockDb() },
        { provide: AuthService, useValue: mockAuthService },
        { provide: StockMovimientoService, useValue: mockStockService },
        { provide: JornadaService, useValue: mockJornadaService },
      ],
    });

    productoService = TestBed.inject(ProductoService);
    vi.spyOn(productoService, 'listar').mockReturnValue(of(mockProductos));
    vi.spyOn(productoService, 'buscar').mockReturnValue(of([]));

    fixture = TestBed.createComponent(ProductosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga productos al iniciar', () => {
    expect(productoService.listar).toHaveBeenCalledOnce();
    expect(component.productos()).toEqual(mockProductos);
  });

  it('renderiza la tabla con los productos', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Café');
    expect(el.textContent).toContain('Té');
  });

  it('renderiza el título Productos', () => {
    expect(fixture.nativeElement.textContent).toContain('Productos');
  });

  it('renderiza el input de búsqueda', () => {
    const input = fixture.nativeElement.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input.getAttribute('placeholder')).toContain('Buscar');
  });

  it('muestra la cantidad de productos', () => {
    expect(fixture.nativeElement.textContent).toContain('2 productos');
  });

  it('muestra "1 producto" (singular) cuando hay un solo resultado', () => {
    vi.spyOn(productoService, 'listar').mockReturnValue(of([mockProductos[0]]));
    component.recargar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 producto');
  });

  it('muestra estado vacío cuando no hay productos', () => {
    vi.spyOn(productoService, 'listar').mockReturnValue(of([]));
    component.recargar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay productos cargados');
  });

  it('muestra "Cargando…" mientras carga', () => {
    let resolve!: (v: Producto[]) => void;
    vi.spyOn(productoService, 'listar').mockReturnValue(
      new Observable((sub) => {
        resolve = (v) => { sub.next(v); sub.complete(); };
      }),
    );

    component.recargar();
    fixture.detectChanges();

    expect(component.buscando()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Cargando');

    resolve([]);
    fixture.detectChanges();
    expect(component.buscando()).toBe(false);
  });

  it('onSearch busca productos con debounce (usa timers)', () => {
    vi.useFakeTimers();
    vi.spyOn(productoService, 'buscar').mockReturnValue(of([mockProductos[0]]));

    component.onSearch('Café');
    vi.advanceTimersByTime(100);
    expect(productoService.buscar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(productoService.buscar).toHaveBeenCalledWith('Café');

    vi.useRealTimers();
  });

  it('onSearch con query vacía recarga todos los productos', () => {
    vi.useFakeTimers();
    vi.mocked(productoService.listar).mockClear();

    component.onSearch('');
    vi.advanceTimersByTime(300);

    expect(productoService.listar).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('muestra error cuando listar falla', () => {
    vi.spyOn(productoService, 'listar').mockReturnValue(
      throwError(() => new Error('DB error')),
    );

    component.recargar();
    fixture.detectChanges();

    expect(component.error()).toBe('DB error');
    expect(fixture.nativeElement.textContent).toContain('DB error');
  });

  it('muestra botón Reintentar cuando hay error', () => {
    vi.spyOn(productoService, 'listar').mockReturnValue(
      throwError(() => new Error('Fallo')),
    );

    component.recargar();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const retryBtn = Array.from(buttons).find((b) => b.textContent?.includes('Reintentar'));
    expect(retryBtn).toBeTruthy();
  });

  it('recargar limpia el error y vuelve a cargar', () => {
    vi.spyOn(productoService, 'listar')
      .mockReturnValueOnce(throwError(() => new Error('Fallo')))
      .mockReturnValueOnce(of(mockProductos));

    component.recargar();
    expect(component.error()).toBe('Fallo');

    component.recargar();
    expect(component.error()).toBeUndefined();
    expect(component.productos()).toEqual(mockProductos);
  });

  it('renderiza precio de venta formateado', () => {
    expect(fixture.nativeElement.textContent).toContain('500');
  });

  it('renderiza stock de cada producto', () => {
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('25');
  });

  // ── Merma Tests ──────────────────────────────────────────────

  it('shows Merma button for each product', () => {
    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const mermaBtns = Array.from(allBtns).filter(
      (b) => (b as HTMLButtonElement).textContent?.includes('Merma'),
    );
    expect(mermaBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('opens inline form when Merma button is clicked', () => {
    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const mermaBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Merma'),
    ) as HTMLButtonElement;
    mermaBtn.click();
    fixture.detectChanges();

    expect(component.selectedProductoId()).toBe(1);

    const form = fixture.nativeElement.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('submits merma calls registrarMerma with default shop ubicacion', async () => {
    component.abrirMerma(1);
    component.mermaCantidad.set(3);
    component.mermaMotivo.set('Rotura en depósito');
    fixture.detectChanges();

    await component.onSubmitMerma();
    fixture.detectChanges();

    expect(mockStockService.registrarMerma).toHaveBeenCalledWith(
      1,
      3,
      'Rotura en depósito',
      undefined,
      'shop',
    );
  });

  it('shows error on insufficient stock for merma', async () => {
    mockStockService.registrarMerma.mockRejectedValue(
      new Error('Stock insuficiente'),
    );

    component.abrirMerma(1);
    component.mermaCantidad.set(999);
    fixture.detectChanges();

    await component.onSubmitMerma();
    fixture.detectChanges();

    expect(component.mermaError()).toBe('Stock insuficiente');
  });

  it('Merma button uses red styling', () => {
    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const mermaBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Merma'),
    ) as HTMLButtonElement;
    expect(mermaBtn).toBeTruthy();
    expect(mermaBtn.className).toContain('bg-red-600');
  });

  it('cancelarMerma hides form', () => {
    component.abrirMerma(1);
    fixture.detectChanges();
    expect(component.selectedProductoId()).toBe(1);

    component.cancelarMerma();
    fixture.detectChanges();
    expect(component.selectedProductoId()).toBeNull();
  });
});
