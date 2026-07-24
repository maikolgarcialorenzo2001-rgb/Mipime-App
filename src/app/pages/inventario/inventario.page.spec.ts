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
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn(),
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

  // ── CRUD Modal Tests ──────────────────────────────────────────

  function setupListarConProductos(): void {
    mockProductoService.listar.mockReturnValue(of(productos));
    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function setupLoaded(): Promise<void> {
    setupListarConProductos();
    await fixture.whenStable();
    fixture.detectChanges();
    vi.clearAllMocks();
  }

  it('12. shows Precio Costo column in table', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const headerText = fixture.nativeElement.textContent;
    expect(headerText).toContain('Precio Costo');

    const precioCell = fixture.nativeElement.querySelector('tbody tr td:nth-child(3)');
    expect(precioCell).toBeTruthy();
  });

  it('13. "Nuevo producto" button exists and opens modal', async () => {
    await setupLoaded();

    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const nuevoBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Nuevo'),
    );
    expect(nuevoBtn).toBeTruthy();

    (nuevoBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(true);
    expect(component.editandoProductoId()).toBeNull();
    expect(component.formNombre()).toBe('');
    expect(component.formCosto()).toBe(0);

    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Nuevo Producto');
  });

  it('14. opens modal pre-filled for editing', async () => {
    await setupLoaded();

    const allEditBtns = fixture.nativeElement.querySelectorAll('button');
    const editBtns = Array.from(allEditBtns).filter(
      (b) => (b as HTMLButtonElement).textContent?.includes('Editar'),
    );
    expect(editBtns.length).toBeGreaterThanOrEqual(1);

    (editBtns[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(true);
    expect(component.editandoProductoId()).toBe(productos[0].id);
    expect(component.formNombre()).toBe(productos[0].nombre);
    expect(component.formCosto()).toBe(productos[0].precio_costo);
    expect(component.formPrecioVenta()).toBe(productos[0].precio_venta);

    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Editar Producto');
  });

  it('15. validation rejects empty fields', async () => {
    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(true);

    // Leave all fields empty and try to save
    await component.guardarProducto();
    fixture.detectChanges();

    expect(component.formError()).toBeTruthy();
    expect(mockProductoService.crear).not.toHaveBeenCalled();
  });

  it('16. save calls ProductoService.crear for new product', async () => {
    const productoCreado: Producto = {
      id: 99,
      nombre: 'Test Producto',
      descripcion: null,
      precio_venta: 500,
      precio_costo: 200,
      stock_actual: 10,
      created_at: '2026-07-23T19:00:00Z',
      updated_at: '2026-07-23T19:00:00Z',
    };
    mockProductoService.crear.mockReturnValue(of(productoCreado));

    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    component.formNombre.set('Test Producto');
    component.formCosto.set(200);
    component.formPrecioVenta.set(500);
    component.formUnidades.set(10);
    fixture.detectChanges();

    await component.guardarProducto();
    fixture.detectChanges();

    expect(mockProductoService.crear).toHaveBeenCalledWith({
      nombre: 'Test Producto',
      precio_costo: 200,
      precio_venta: 500,
      stock_actual: 10,
    });
    expect(component.showProductoModal()).toBe(false);
  });

  it('17. save calls ProductoService.actualizar for editing', async () => {
    const productoActualizado: Producto = {
      id: 1,
      nombre: 'Coca Cola Editado',
      descripcion: null,
      precio_venta: 15,
      precio_costo: 8,
      stock_actual: 100,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-07-23T19:00:00Z',
    };
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.actualizar.mockReturnValue(of(productoActualizado));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.abrirEditarProducto(productos[0]);
    fixture.detectChanges();

    component.formNombre.set('Coca Cola Editado');
    component.formPrecioVenta.set(15);
    fixture.detectChanges();

    await component.guardarProducto();
    fixture.detectChanges();

    expect(mockProductoService.actualizar).toHaveBeenCalledWith(1, {
      nombre: 'Coca Cola Editado',
      precio_costo: 8,
      precio_venta: 15,
    });
    expect(component.showProductoModal()).toBe(false);
  });

  it('18. delete confirmation flow — confirm', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.eliminar.mockReturnValue(of(undefined));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.confirmarEliminar(1);
    fixture.detectChanges();

    expect(component.confirmandoEliminar()).toBe(1);

    const confirmacionText = fixture.nativeElement.textContent;
    expect(confirmacionText).toContain('eliminar');

    await component.ejecutarEliminar();
    fixture.detectChanges();

    expect(mockProductoService.eliminar).toHaveBeenCalledWith(1);
    expect(component.confirmandoEliminar()).toBeNull();
  });

  it('19. delete confirmation flow — cancel', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.confirmarEliminar(1);
    fixture.detectChanges();

    expect(component.confirmandoEliminar()).toBe(1);

    component.cancelarEliminar();
    fixture.detectChanges();

    expect(component.confirmandoEliminar()).toBeNull();
    expect(mockProductoService.eliminar).not.toHaveBeenCalled();
  });

  it('20. cerrarModal hides modal and clears form', async () => {
    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(true);

    component.formNombre.set('Algo');
    component.formError.set('Error previo');

    component.cerrarModal();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(false);
    expect(component.formNombre()).toBe('');
    expect(component.formError()).toBeNull();
    expect(component.procesando()).toBe(false);
  });
});
