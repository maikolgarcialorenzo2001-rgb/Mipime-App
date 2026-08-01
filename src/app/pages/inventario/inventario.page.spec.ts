import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { InventarioPage } from './inventario.page';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { AuthService } from '../../services/auth.service';
import type { Producto, StockMovimiento } from '../../models';

describe('InventarioPage', () => {
  let fixture: ComponentFixture<InventarioPage>;
  let component: InventarioPage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductoService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStockService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuthService: any;

  const productos: Producto[] = [
    {
      id: 1,
      nombre: 'Coca Cola',
      descripcion: null,
      precio_venta: 12,
      precio_costo: 8,
      stock_almacen: 100,
      stock_shop: 10,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      nombre: 'Pepsi',
      descripcion: null,
      precio_venta: 10,
      precio_costo: 7,
      stock_almacen: 50,
      stock_shop: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 3,
      nombre: 'Agua Mineral',
      descripcion: null,
      precio_venta: 5,
      precio_costo: 2,
      stock_almacen: 200,
      stock_shop: 20,
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
      costo_total: 0,
      created_at: '2026-02-01T10:00:00Z',
    },
    {
      id: 2,
      producto_id: 1,
      cantidad: 3,
      tipo: 'salida',
      motivo: 'Venta mostrador',
      costo_total: 0,
      created_at: '2026-02-02T14:30:00Z',
    },
  ];

  beforeEach(() => {
    mockAuthService = {
      usuario: vi.fn().mockReturnValue({ id: 1, nombre: 'Admin', rol: 'admin' }),
    };

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
      registrarAjusteLote: vi.fn().mockResolvedValue(undefined),
      registrarEditar: vi.fn().mockResolvedValue(undefined),
      registrarMerma: vi.fn().mockResolvedValue({ consumos: [], costoTotal: 0 }),
      registrarTraslado: vi.fn().mockResolvedValue([]),
      obtenerMovimientos: vi.fn().mockResolvedValue([]),
      obtenerHistorial: vi.fn().mockResolvedValue([]),
      obtenerLotesPorProducto: vi.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      imports: [InventarioPage],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
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

  it('6. shows Stock Almacén and Stock Tienda columns', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const headerText = fixture.nativeElement.textContent;
    expect(headerText).toContain('Stock Almacén');
    expect(headerText).toContain('Stock Tienda');

    const tbody = fixture.nativeElement.querySelector('tbody');
    const stockBadges = tbody.querySelectorAll('app-stock-badge');
    // First badge = stock_almacen (100), second = stock_shop (10)
    expect(stockBadges.length).toBe(2);
  });

  it('7. shows admin buttons when esAdmin is true', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.esAdmin()).toBe(true);

    const buttonArea = fixture.nativeElement.querySelector('tbody tr td:last-child');
    const buttonText = buttonArea.textContent;
    expect(buttonText).toContain('Entrada');
    expect(buttonText).toContain('Salida');
    expect(buttonText).toContain('Ajustar');
    expect(buttonText).not.toContain('Merma');
    expect(buttonText).toContain('A Tienda');
  });

  it('8. hides admin buttons when esAdmin is false', async () => {
    mockAuthService.usuario.mockReturnValue({ id: 2, nombre: 'User', rol: 'trabajador' });
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.esAdmin()).toBe(false);

    const buttonArea = fixture.nativeElement.querySelector('tbody tr td:last-child');
    const buttonText = buttonArea.textContent;
    expect(buttonText).not.toContain('Entrada');
    expect(buttonText).not.toContain('Salida');
    expect(buttonText).not.toContain('Ajustar');
    expect(buttonText).not.toContain('Merma');
    expect(buttonText).toContain('A Tienda');
  });

  it('9. shows inline form when "A Tienda" is clicked', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();

    // Click "A Tienda" button (last button in the admin group)
    const allBtns = fixture.nativeElement.querySelectorAll('tbody tr button');
    const aTiendaBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('A Tienda'),
    ) as HTMLButtonElement;
    expect(aTiendaBtn).toBeTruthy();
    aTiendaBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
    expect(component.selectedAction()?.tipo).toBe('traslado');
  });

  it('10. calls registrarTraslado on form submit', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'traslado');
    fixture.detectChanges();

    component.movimientoCantidad.set(5);
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarTraslado).toHaveBeenCalledWith(1, 5);
  });

  it('11. calls registrarEntrada on form submit', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'entrada');
    fixture.detectChanges();

    component.movimientoCantidad.set(5);
    component.movimientoCosto.set(500);
    component.movimientoMotivo.set('Repo');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEntrada).toHaveBeenCalledWith(
      1, 5, 500, 'Repo',
    );
  });

  it('12. calls registrarSalida on form submit (consumes from almacen)', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    component.movimientoCantidad.set(3);
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledWith(1, 3, undefined, undefined, 'almacen');
  });

  it('13. calls registrarAjusteLote on form submit (with lot selected)', async () => {
    const lotesMock = [
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ];
    mockStockService.obtenerLotesPorProducto.mockResolvedValue(lotesMock);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'ajuste');
    fixture.detectChanges();

    expect(component.selectedLoteIndex()).toBe(1);

    component.movimientoCantidad.set(150);
    component.movimientoMotivo.set('Inventario físico');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarAjusteLote).toHaveBeenCalledWith(
      1, 42, 150, 'Inventario físico', 'almacen',
    );
  });

  it('14. shows history on toggle', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));
    mockStockService.obtenerMovimientos.mockResolvedValue(movimientos);

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const historialBtn = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Historial')) as HTMLButtonElement;
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

  it('15. hides form on cancel', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'traslado');
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

  it('16. shows Ubicación column in lot details', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 5, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const lotesBtn = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Lotes')) as HTMLButtonElement;
    lotesBtn.click();
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    const lotesText = fixture.nativeElement.textContent;
    expect(lotesText).toContain('ID Lote');
    expect(lotesText).toContain('#5');
    expect(lotesText).toContain('Ubicación');
    expect(lotesText).toContain('Almacén');
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

  it('17. shows Precio Costo column in table', async () => {
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

  it('18. "Nuevo producto" button exists and opens modal', async () => {
    await setupLoaded();

    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const nuevoBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Nuevo'),
    );
    expect(nuevoBtn).toBeTruthy();

    (nuevoBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.showProductoModal()).toBe(true);
    expect(component.formNombre()).toBe('');
    expect(component.formCosto()).toBeNull();

    const overlay = fixture.nativeElement.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Nuevo Producto');
  });

  it('19. opens inline editar form with lot selector and fields on click', async () => {
    const lotesMock = [
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ];
    mockStockService.obtenerLotesPorProducto.mockResolvedValue(lotesMock);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const editBtn = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.includes('Editar')) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();
    editBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Should show inline form (not modal)
    expect(component.showProductoModal()).toBe(false);
    expect(component.selectedAction()?.tipo).toBe('editar');
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();

    // Should pre-fill values from product and first lot
    expect(component.selectedLoteIndex()).toBe(1);
    expect(component.editarPrecioVenta()).toBe(productos[0].precio_venta);
    expect(component.editarPrecioCosto()).toBe(8);
    expect(component.movimientoCantidad()).toBe(100);
  });

  it('20. validation rejects empty fields', async () => {
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

  it('21. save calls ProductoService.crear for new product', async () => {
    const productoCreado: Producto = {
      id: 99,
      nombre: 'Test Producto',
      descripcion: null,
      precio_venta: 500,
      precio_costo: 200,
      stock_almacen: 10,
      stock_shop: 0,
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
      stock_almacen: 10,
    });
    expect(component.showProductoModal()).toBe(false);
  });

  it('22. calls registrarEditar on inline editar form submit', async () => {
    const lotesMock = [
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ];
    mockStockService.obtenerLotesPorProducto.mockResolvedValue(lotesMock);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(10);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEditar).toHaveBeenCalledWith(
      1, 42, 'Coca Cola', 15, 10, 80, 'Actualización de precios', 'almacen',
    );
  });

  it('23. editar form updates placeholders when lot changes', async () => {
    const lotesMock = [
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 50, precio_costo: 10, fecha_ingreso: '2026-02-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-02-01T00:00:00Z' },
    ];
    mockStockService.obtenerLotesPorProducto.mockResolvedValue(lotesMock);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    // Initially first lot selected
    expect(component.selectedLoteIndex()).toBe(1);
    expect(component.editarPrecioCosto()).toBe(8);
    expect(component.movimientoCantidad()).toBe(100);

    // Switch to second lot
    component.selectedLoteIndex.set(2);
    component.actualizarPlaceholdersEditar();
    fixture.detectChanges();

    expect(component.editarPrecioCosto()).toBe(10);
    expect(component.movimientoCantidad()).toBe(50);
    // Precio Venta should remain unchanged (product-level)
    expect(component.editarPrecioVenta()).toBe(productos[0].precio_venta);
  });

  it('24. delete confirmation flow — confirm', async () => {
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

  it('25. delete confirmation flow — cancel', async () => {
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

  it('26. cerrarModal hides modal and clears form', async () => {
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

  // ── Scroll preservation ────────────────────────────────────────

  it('27. keeps table mounted during refresh (scroll preservation)', async () => {
    // Initial load resolves with 2 products.
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 2)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loading()).toBe(false);

    // Refresh with an unresolved observable: loading starts but the table
    // must stay mounted (no spinner swap, no height collapse).
    let resolveRefresh!: (value: Producto[]) => void;
    mockProductoService.listar.mockReturnValue(
      new Observable<Producto[]>((subscriber) => {
        resolveRefresh = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    const refresh = component['loadProductos']();
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeFalsy();

    const tbody = fixture.nativeElement.querySelector('tbody');
    expect(tbody).toBeTruthy();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Coca Cola');
    expect(text).toContain('Pepsi');

    // Resolve with updated data → rows reflect the changes in place.
    resolveRefresh([
      { ...productos[0], precio_venta: 15, stock_almacen: 120 },
      { ...productos[1], precio_venta: 11, stock_almacen: 60 },
    ]);
    await refresh;
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    const updatedText = fixture.nativeElement.textContent;
    expect(updatedText).toContain('$15.00');
    expect(updatedText).toContain('$11.00');
    expect(updatedText).not.toContain('$12.00');
    expect(updatedText).not.toContain('$10.00');
  });

  it('28. no empty-state flash during refresh with active search filter', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 2)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Active filter matches nothing → filtered list is empty while data exists.
    component.searchQuery.set('zzz');
    fixture.detectChanges();
    expect(component.filteredProductos().length).toBe(0);

    let resolveRefresh!: (value: Producto[]) => void;
    mockProductoService.listar.mockReturnValue(
      new Observable<Producto[]>((subscriber) => {
        resolveRefresh = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    const refresh = component['loadProductos']();
    fixture.detectChanges();

    // While loading: no empty state, spinner instead.
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).toBeTruthy();

    // After the refresh resolves: empty state appears.
    resolveRefresh([]);
    await refresh;
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  // ── Double-submit guard ───────────────────────────────────────

  it('29. ignores a second submit while a movement is in progress', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    component.movimientoCantidad.set(3);
    fixture.detectChanges();

    let resolveSalida!: () => void;
    mockStockService.registrarSalida.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSalida = resolve;
      }),
    );

    const first = component.onSubmitMovimiento();
    fixture.detectChanges();

    // Double-click: a second submit fires while the first is still pending.
    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledTimes(1);

    resolveSalida();
    await first;
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledTimes(1);
    // After the movement completes, the in-progress state is released.
    expect(component.procesandoMovimiento()).toBe(false);
  });

  it('30. disables the submit button while a movement is in progress', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    component.movimientoCantidad.set(3);
    fixture.detectChanges();

    let resolveSalida!: () => void;
    mockStockService.registrarSalida.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSalida = resolve;
      }),
    );

    const first = component.onSubmitMovimiento();
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'form button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Guardando...');
    expect(component.procesandoMovimiento()).toBe(true);

    resolveSalida();
    await first;
    fixture.detectChanges();

    // The movement completed: in-progress state released and the inline form
    // is closed (so the button element itself is gone from the DOM).
    expect(component.procesandoMovimiento()).toBe(false);
    expect(component.selectedAction()).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  describe('responsive layout', () => {
    it('debería tener container con max-w-7xl', () => {
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.max-w-7xl');
      expect(container).toBeTruthy();
    });
  });
});
