import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { InventarioPage } from './inventario.page';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import type { Producto, StockMovimiento } from '../../models';

describe('InventarioPage', () => {
  let fixture: ComponentFixture<InventarioPage>;
  let component: InventarioPage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductoService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStockService: any;

  const productos: Producto[] = [
    {
      id: 1,
      nombre: 'Coca Cola',
      descripcion: null,
      precio_venta: 12,
      precio_costo: 8,
      stock_actual: 100,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      nombre: 'Pepsi',
      descripcion: null,
      precio_venta: 10,
      precio_costo: 7,
      stock_actual: 50,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 3,
      nombre: 'Agua Mineral',
      descripcion: null,
      precio_venta: 5,
      precio_costo: 2,
      stock_actual: 200,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const movimientos: StockMovimiento[] = [
    {
      id: 1,
      producto_id: 1,
      cantidad: 10,
      tipo: 'entrada',
      motivo: 'Compra proveedor',
      created_at: '2026-02-01T10:00:00Z',
    },
    {
      id: 2,
      producto_id: 1,
      cantidad: 3,
      tipo: 'salida',
      motivo: 'Venta mostrador',
      created_at: '2026-02-02T14:30:00Z',
    },
  ];

  beforeEach(() => {
    mockProductoService = {
      listar: vi.fn(),
      buscar: vi.fn(),
      obtenerPorId: vi.fn(),
    };

    mockStockService = {
      registrarEntrada: vi.fn().mockResolvedValue(undefined),
      registrarSalida: vi.fn().mockResolvedValue(undefined),
      registrarAjuste: vi.fn().mockResolvedValue(undefined),
      obtenerMovimientos: vi.fn().mockResolvedValue([]),
      obtenerHistorial: vi.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      imports: [InventarioPage],
      providers: [
        { provide: ProductoService, useValue: mockProductoService },
        { provide: StockMovimientoService, useValue: mockStockService },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders loading state initially', async () => {
    let resolveListar!: (value: Producto[]) => void;
    mockProductoService.listar.mockReturnValue(
      new Observable<Producto[]>((subscriber) => {
        resolveListar = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('app-loading-spinner');
    expect(spinner).toBeTruthy();

    resolveListar([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
  });

  it('2. renders products after loading', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 2)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Coca Cola');
    expect(texto).toContain('Pepsi');
  });

  it('3. shows empty state when no products', async () => {
    mockProductoService.listar.mockReturnValue(of([]));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('4. shows error on service failure', async () => {
    mockProductoService.listar.mockReturnValue(
      throwError(() => new Error('Error de prueba')),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('app-error-alert');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert.textContent).toContain('Error de prueba');
    expect(component.loading()).toBe(false);
  });

  it('5. filters products by search query', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.filteredProductos().length).toBe(3);

    component.searchQuery.set('coca');
    fixture.detectChanges();

    expect(component.filteredProductos().length).toBe(1);
    expect(component.filteredProductos()[0].nombre).toBe('Coca Cola');

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Coca Cola');
    expect(texto).not.toContain('Pepsi');
    expect(texto).not.toContain('Agua Mineral');
  });

  it('6. shows inline form when action is selected', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('form'),
    ).toBeFalsy();

    const entradaBtn = fixture.nativeElement.querySelector(
      'tbody tr button',
    ) as HTMLButtonElement;
    entradaBtn.click();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    expect(form).toBeTruthy();
    expect(
      form.querySelector('input[name="movimientoCantidad"]'),
    ).toBeTruthy();

    const buttons = form.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) =>
      (b as HTMLButtonElement).textContent?.trim() ?? '',
    );
    expect(buttonTexts.some((t) => t.includes('Guardar'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Cancelar'))).toBe(true);
  });

  it('7. calls registrarEntrada on form submit', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const entradaBtn = fixture.nativeElement.querySelector(
      'tbody tr button',
    ) as HTMLButtonElement;
    entradaBtn.click();
    fixture.detectChanges();

    component.movimientoCantidad.set(5);
    component.movimientoMotivo.set('Repo');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEntrada).toHaveBeenCalledWith(
      1,
      5,
      'Repo',
    );
  });

  it('8. calls registrarSalida on form submit', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'tbody tr button',
    );
    // Second button is "Salida"
    (buttons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    component.movimientoCantidad.set(3);
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledWith(
      1,
      3,
      undefined,
    );
  });

  it('9. calls registrarAjuste on form submit', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'tbody tr button',
    );
    // Third button is "Ajustar"
    (buttons[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    component.movimientoCantidad.set(150);
    component.movimientoMotivo.set('Inventario físico');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarAjuste).toHaveBeenCalledWith(
      1,
      150,
      'Inventario físico',
    );
  });

  it('10. shows history on toggle', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));
    mockStockService.obtenerMovimientos.mockResolvedValue(movimientos);

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const historialBtn = fixture.nativeElement.querySelector(
      'tbody tr button:last-child',
    ) as HTMLButtonElement;
    historialBtn.click();
    fixture.detectChanges();
    expect(component.showHistoryId()).toBe(1);

    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Compra proveedor');
    expect(texto).toContain('Venta mostrador');
    expect(texto).toContain('Entrada');
    expect(texto).toContain('Salida');

    expect(mockStockService.obtenerMovimientos).toHaveBeenCalledWith(1);
  });

  it('11. hides form on cancel', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const entradaBtn = fixture.nativeElement.querySelector(
      'tbody tr button',
    ) as HTMLButtonElement;
    entradaBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();

    const cancelBtn = fixture.nativeElement.querySelector(
      'form button[type="button"]',
    ) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
    expect(component.selectedAction()).toBeNull();
  });
});
