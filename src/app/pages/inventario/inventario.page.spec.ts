import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { InventarioPage, elegirLoteInicialEdicion } from './inventario.page';
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
      obtenerConteoEliminacion: vi.fn().mockReturnValue(
        of({ movimientos: 0, lotes: 0, ventaLotes: 0, ventas: 0, cuentas: 0 }),
      ),
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
    expect(buttonText).toContain('Traslado');
    expect(buttonText).not.toContain('Salida');
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
    expect(buttonText).not.toContain('Traslado');
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

  it('RED: entrada con costo negativo muestra error y no llama registrarEntrada', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'entrada');
    fixture.detectChanges();

    component.movimientoCantidad.set(5);
    component.movimientoCosto.set(-5);
    component.movimientoMotivo.set('Repo');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.error()).toBe('El costo no puede ser negativo');
    expect(mockStockService.registrarEntrada).not.toHaveBeenCalled();
  });

  it('entrada con costo vacío mapea a 0 y llama registrarEntrada', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'entrada');
    fixture.detectChanges();

    component.movimientoCantidad.set(5);
    // movimientoCosto queda null (campo vacío) → debe mapear a 0
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEntrada).toHaveBeenCalledWith(
      1, 5, 0, undefined,
    );
  });

  // ── Traslado (salida): ubicación de origen + lote OBLIGATORIOS (REQ-4/REQ-5) ──

  it('12. RED: sin ubicación de origen el dropdown de lotes está deshabilitado y el submit no llama registrarSalida', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    // Sin ubicación: sin default y sin auto-selección de lote
    expect(component.salidaUbicacion()).toBeNull();
    expect(component.selectedLoteIndex()).toBeNull();
    expect(component.lotesDeUbicacion()).toHaveLength(0);

    const selects = fixture.nativeElement.querySelectorAll('form select');
    // select[0] = ubicación, select[1] = lote (obligatorio)
    expect(selects.length).toBe(2);
    const loteSelect = selects[1] as HTMLSelectElement;
    expect(loteSelect.disabled).toBe(true);

    component.movimientoCantidad.set(3);
    fixture.detectChanges();
    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).not.toHaveBeenCalled();
  });

  it('12.1 RED: elegir ubicación habilita el dropdown de lotes', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('shop');
    fixture.detectChanges();

    expect(component.salidaUbicacion()).toBe('shop');
    expect(component.lotesDeUbicacion()).toHaveLength(1);
    expect(component.lotesDeUbicacion()[0].id).toBe(43);

    const loteSelect = fixture.nativeElement.querySelectorAll('form select')[1] as HTMLSelectElement;
    expect(loteSelect.disabled).toBe(false);
  });

  it('12.2 RED: "Tienda" lista solo lotes de shop y "Almacén" solo lotes de almacén con cantidad > 0', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
      { id: 44, producto_id: 1, cantidad: 0, precio_costo: 7, fecha_ingreso: '2026-01-03T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-03T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    // Tienda → solo el lote de shop
    await component.onSalidaUbicacionChange('shop');
    fixture.detectChanges();
    expect(component.lotesDeUbicacion().map((l) => l.id)).toEqual([43]);

    const loteSelect = fixture.nativeElement.querySelectorAll('form select')[1] as HTMLSelectElement;
    const optionsShop = loteSelect.querySelectorAll('option');
    expect(optionsShop.length).toBe(2); // placeholder + Lote #1
    expect(loteSelect.textContent).toContain('Lote #1');
    expect(loteSelect.textContent).not.toContain('Lote #2');

    // Almacén → solo el lote de almacén con stock (el 44 con 0u queda fuera)
    await component.onSalidaUbicacionChange('almacen');
    fixture.detectChanges();
    expect(component.lotesDeUbicacion().map((l) => l.id)).toEqual([42]);
    expect(loteSelect.querySelectorAll('option').length).toBe(2);
    expect(loteSelect.textContent).not.toContain('Lote #2');
  });

  it('12.3 RED: cambiar la ubicación resetea el lote elegido y refiltra el dropdown', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('almacen');
    fixture.detectChanges();
    expect(component.lotesDeUbicacion().map((l) => l.id)).toEqual([42]);

    component.selectedLoteIndex.set(1);
    fixture.detectChanges();
    expect(component.selectedLoteIndex()).toBe(1);

    // Cambio a Tienda → lote reseteado y dropdown refiltrado con solo lotes de shop
    await component.onSalidaUbicacionChange('shop');
    fixture.detectChanges();
    expect(component.salidaUbicacion()).toBe('shop');
    expect(component.selectedLoteIndex()).toBeNull();
    expect(component.lotesDeUbicacion().map((l) => l.id)).toEqual([43]);

    const loteSelect = fixture.nativeElement.querySelectorAll('form select')[1] as HTMLSelectElement;
    expect(loteSelect.textContent).not.toContain('Lote #2');
  });

  it('12.4 RED: sin lote elegido el submit no llama registrarSalida', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('almacen');
    fixture.detectChanges();
    // Ubicación elegida pero lote sin seleccionar (sin auto-selección)
    expect(component.salidaUbicacion()).toBe('almacen');
    expect(component.selectedLoteIndex()).toBeNull();

    component.movimientoCantidad.set(3);
    fixture.detectChanges();
    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).not.toHaveBeenCalled();
  });

  it('12.5 RED: submit con ubicación + lote pasa (productoId, cantidad, motivo, undefined, ubicacion, loteId)', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('shop');
    component.selectedLoteIndex.set(1);
    component.movimientoCantidad.set(3);
    component.movimientoMotivo.set('Rotura de stock');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledWith(
      1, 3, 'Rotura de stock', undefined, 'shop', 43,
    );
  });

  it('12.6 TRIANGULATE: submit con lote de almacén sin motivo pasa 6 argumentos y no hay fallback a 5', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('almacen');
    component.selectedLoteIndex.set(1);
    component.movimientoCantidad.set(4);
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarSalida).toHaveBeenCalledTimes(1);
    expect(mockStockService.registrarSalida).toHaveBeenCalledWith(
      1, 4, undefined, undefined, 'almacen', 42,
    );
  });

  it('12.7 RED: no existe la opción "FIFO automático" en el formulario de Traslado', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 9, fecha_ingreso: '2026-01-02T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-02T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    const formText = fixture.nativeElement.querySelector('form').textContent;
    expect(formText).not.toContain('FIFO');

    // Con ubicación elegida y lotes cargados tampoco aparece
    await component.onSalidaUbicacionChange('almacen');
    fixture.detectChanges();
    const formTextConUbicacion = fixture.nativeElement.querySelector('form').textContent;
    expect(formTextConUbicacion).not.toContain('FIFO');
    expect(formTextConUbicacion).not.toContain('sin lote');
  });

  it('12.8 RED: salida sin ubicación/lote muestra el error neutro "Elija la ubicación y el lote para el traslado"', async () => {
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

    expect(component.error()).toBe('Elija la ubicación y el lote para el traslado');
    expect(fixture.nativeElement.textContent).toContain('Elija la ubicación y el lote para el traslado');
  });

  it('12.9 RED: el formulario de salida muestra los placeholders neutros "Seleccione la ubicación…" y "Seleccione un lote…"', async () => {
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('form select');
    expect(selects.length).toBe(2);
    expect((selects[0] as HTMLSelectElement).textContent).toContain('Seleccione la ubicación…');
    expect((selects[1] as HTMLSelectElement).textContent).toContain('Seleccione un lote…');
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

  it('F7 RED: editar con lotes mixtos preselecciona el frente de la ubicación principal (almacen)', async () => {
    const lotesMock = [
      { id: 43, producto_id: 1, cantidad: 12, precio_costo: 11, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'shop', created_at: '2026-01-01T00:00:00Z' },
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-02-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-02-01T00:00:00Z' },
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

    // El lote 43 (shop) es el más viejo global, pero la ubicación principal es
    // almacen (stock 100 > 10): se preselecciona el frente de almacen (lote 42).
    expect(component.selectedLoteIndex()).toBe(2);
    expect(component.editarPrecioCosto()).toBe(8);
    expect(component.movimientoCantidad()).toBe(100);
  });

  it('F7 RED: editar con stock principal en shop preselecciona el frente de shop', async () => {
    const productoShop = { ...productos[0], id: 1, stock_almacen: 5, stock_shop: 50 };
    const lotesMock = [
      { id: 41, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 44, producto_id: 1, cantidad: 20, precio_costo: 9, fecha_ingreso: '2026-02-01T00:00:00Z', ubicacion: 'shop', created_at: '2026-02-01T00:00:00Z' },
    ];
    mockStockService.obtenerLotesPorProducto.mockResolvedValue(lotesMock);
    mockProductoService.listar.mockReturnValue(of([productoShop]));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    expect(component.selectedLoteIndex()).toBe(2);
    expect(component.editarPrecioCosto()).toBe(9);
    expect(component.movimientoCantidad()).toBe(20);
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

  it('RED: guardarProducto con costo negativo muestra formError y no llama crear', async () => {
    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    component.formNombre.set('Test');
    component.formCosto.set(-5);
    component.formPrecioVenta.set(500);
    component.formUnidades.set(10);
    fixture.detectChanges();

    await component.guardarProducto();
    fixture.detectChanges();

    expect(component.formError()).toBe('El costo no puede ser negativo');
    expect(mockProductoService.crear).not.toHaveBeenCalled();
  });

  it('RED: guardarProducto con precio de venta negativo muestra formError y no llama crear', async () => {
    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    component.formNombre.set('Test');
    component.formCosto.set(200);
    component.formPrecioVenta.set(-5);
    component.formUnidades.set(10);
    fixture.detectChanges();

    await component.guardarProducto();
    fixture.detectChanges();

    expect(component.formError()).toBe('El precio de venta no puede ser negativo');
    expect(mockProductoService.crear).not.toHaveBeenCalled();
  });

  it('guardarProducto con precios en 0 procede a crear', async () => {
    const productoCreado: Producto = {
      id: 100,
      nombre: 'Gratis',
      descripcion: null,
      precio_venta: 0,
      precio_costo: 0,
      stock_almacen: 10,
      stock_shop: 0,
      created_at: '2026-07-23T19:00:00Z',
      updated_at: '2026-07-23T19:00:00Z',
    };
    mockProductoService.crear.mockReturnValue(of(productoCreado));

    await setupLoaded();

    component.abrirNuevoProducto();
    fixture.detectChanges();

    component.formNombre.set('Gratis');
    component.formCosto.set(0);
    component.formPrecioVenta.set(0);
    component.formUnidades.set(10);
    fixture.detectChanges();

    await component.guardarProducto();
    fixture.detectChanges();

    expect(mockProductoService.crear).toHaveBeenCalledWith({
      nombre: 'Gratis',
      precio_costo: 0,
      precio_venta: 0,
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

  it('RED: editar inline con precio de venta negativo muestra error y no llama registrarEditar', async () => {
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

    component.editarPrecioVenta.set(-5);
    component.editarPrecioCosto.set(10);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.error()).toBe('El precio de venta no puede ser negativo');
    expect(mockStockService.registrarEditar).not.toHaveBeenCalled();
  });

  it('RED: editar inline con costo negativo muestra error y no llama registrarEditar', async () => {
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
    component.editarPrecioCosto.set(-5);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.error()).toBe('El costo no puede ser negativo');
    expect(mockStockService.registrarEditar).not.toHaveBeenCalled();
  });

  it('editar inline con precios en 0 procede a registrarEditar', async () => {
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

    component.editarPrecioVenta.set(0);
    component.editarPrecioCosto.set(0);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEditar).toHaveBeenCalledWith(
      1, 42, 'Coca Cola', 0, 0, 80, 'Actualización de precios', 'almacen',
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

    await component.confirmarEliminar(1);
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

    await component.confirmarEliminar(1);
    fixture.detectChanges();

    expect(component.confirmandoEliminar()).toBe(1);

    component.cancelarEliminar();
    fixture.detectChanges();

    expect(component.confirmandoEliminar()).toBeNull();
    expect(component.eliminarConteo()).toBeNull();
    expect(component.eliminarConteoLoading()).toBe(false);
    expect(mockProductoService.eliminar).not.toHaveBeenCalled();
  });

  it('25.1 F9 RED: confirmarEliminar carga el conteo y lo expone en eliminarConteo', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.obtenerConteoEliminacion.mockReturnValue(
      of({ movimientos: 5, lotes: 3, ventaLotes: 2, ventas: 0, cuentas: 0 }),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.confirmarEliminar(1);
    fixture.detectChanges();

    expect(mockProductoService.obtenerConteoEliminacion).toHaveBeenCalledWith(1);
    expect(component.confirmandoEliminar()).toBe(1);
    expect(component.eliminarConteo()).toEqual({
      movimientos: 5,
      lotes: 3,
      ventaLotes: 2,
      ventas: 0,
      cuentas: 0,
    });
    expect(component.eliminarConteoLoading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('5 movimientos');
    expect(fixture.nativeElement.textContent).toContain('3 lotes');
    expect(fixture.nativeElement.textContent).toContain('2 registros de venta por lote');
  });

  it('25.2 F9 RED: diálogo con ventas > 0 deshabilita Eliminar y avisa que no se puede eliminar', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.obtenerConteoEliminacion.mockReturnValue(
      of({ movimientos: 4, lotes: 2, ventaLotes: 1, ventas: 1, cuentas: 0 }),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.confirmarEliminar(1);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('No se puede eliminar para no degradar los reportes históricos');

    const botonEliminar = fixture.nativeElement.querySelector('.fixed.inset-0 button.bg-red-600');
    expect(botonEliminar).toBeTruthy();
    expect(botonEliminar.disabled).toBe(true);
    expect(botonEliminar.textContent.trim()).toContain('No se puede eliminar');
  });

  it('25.3 F9 RED: diálogo sin ventas/cuentas muestra las cantidades y habilita Eliminar', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.obtenerConteoEliminacion.mockReturnValue(
      of({ movimientos: 7, lotes: 1, ventaLotes: 3, ventas: 0, cuentas: 0 }),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.confirmarEliminar(1);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('7 movimientos');
    expect(texto).toContain('1 lotes');
    expect(texto).toContain('3 registros de venta por lote');
    expect(texto).toContain('Esta acción no se puede deshacer');
    expect(texto).not.toContain('No se puede eliminar para no degradar');

    const botonEliminar = fixture.nativeElement.querySelector('.fixed.inset-0 button.bg-red-600');
    expect(botonEliminar.disabled).toBe(false);
    expect(botonEliminar.textContent.trim()).toContain('Eliminar');
  });

  it('25.4 F9 TRIANGULATE: fallo al cargar el conteo muestra el fallback genérico con Eliminar habilitado', async () => {
    mockProductoService.listar.mockReturnValue(of(productos));
    mockProductoService.obtenerConteoEliminacion.mockReturnValue(
      throwError(() => new Error('db fallo')),
    );

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.confirmarEliminar(1);
    fixture.detectChanges();

    expect(component.eliminarConteo()).toBeNull();
    expect(component.eliminarConteoLoading()).toBe(false);

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('¿Estás seguro de que deseas eliminar este producto?');

    const botonEliminar = fixture.nativeElement.querySelector('.fixed.inset-0 button.bg-red-600');
    expect(botonEliminar.disabled).toBe(false);
    expect(botonEliminar.textContent.trim()).toContain('Eliminar');
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
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('almacen');
    component.selectedLoteIndex.set(1);
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
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 10, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'salida');
    fixture.detectChanges();

    await component.onSalidaUbicacionChange('almacen');
    component.selectedLoteIndex.set(1);
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

  // ── Fase 1: feedback UI (novalidate + validación visible + toast) ──

  it('31. T-01: el form de movimiento tiene novalidate (sin bloqueo nativo del submit)', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.hasAttribute('novalidate')).toBe(true);
  });

  it('32. T-01: el campo de cantidad del editar se etiqueta "Cantidad nueva del lote" (semántica absoluta, sin "Unidades")', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    const formText = fixture.nativeElement.querySelector('form').textContent;
    expect(formText).toContain('Cantidad nueva del lote');
    expect(formText).not.toContain('Unidades');
  });

  it('33. S-01: Guardar sin motivo en editar muestra error visible y NO llama al servicio', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    // Valores válidos excepto motivo (vacío por default)
    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(10);
    component.movimientoCantidad.set(80);
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEditar).not.toHaveBeenCalled();
    expect(component.error()).toBe('El motivo es obligatorio');
    const errorAlert = fixture.nativeElement.querySelector('app-error-alert');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert.textContent).toContain('motivo');
  });

  it('34. S-02: "Cantidad nueva del lote" vacía muestra error visible y NO envía 0 (nunca zeroing silencioso)', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
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
    component.movimientoCantidad.set(null); // campo vacío
    component.movimientoMotivo.set('Baja de stock');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEditar).not.toHaveBeenCalled();
    expect(component.error()).toBe('La cantidad es obligatoria');
    const errorAlert = fixture.nativeElement.querySelector('app-error-alert');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert.textContent).toContain('cantidad');
  });

  it('35. T-02: Guardar sin nombre en editar muestra error visible y NO llama al servicio', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    component.editarNombre.set('   '); // whitespace-only
    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(10);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Cambio de nombre');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(mockStockService.registrarEditar).not.toHaveBeenCalled();
    expect(component.error()).toBe('El nombre del producto es obligatorio');
  });

  it('36. S-06: edición exitosa re-llama listar, refresca productos y muestra toast con el stock nuevo por ubicación', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar
      .mockReturnValueOnce(of(productos.slice(0, 1)))
      .mockReturnValueOnce(of([{ ...productos[0], stock_almacen: 80, stock_shop: 7 }]));

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
    // S-06: listar re-llamado y la señal productos refleja el nuevo stock
    expect(mockProductoService.listar).toHaveBeenCalledTimes(2);
    expect(component.productos()[0].stock_almacen).toBe(80);
    expect(component.productos()[0].stock_shop).toBe(7);
    // FR-03: toast post-save con stock nuevo por ubicación
    expect(component.successMessage()).toBe('Stock guardado — Almacén: 80 u · Tienda: 7 u');

    const toast = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Stock guardado'),
    );
    expect(toast).toBeTruthy();
    expect(toast!.textContent).toContain('Almacén: 80 u');
    expect(toast!.textContent).toContain('Tienda: 7 u');
  });

  it('36b. F3: toast muestra el precio costo actualizado cuando el lote editado es el frente FIFO', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar
      .mockReturnValueOnce(of(productos.slice(0, 1)))
      .mockReturnValueOnce(of([{ ...productos[0], stock_almacen: 80, stock_shop: 7 }]));
    mockStockService.registrarEditar.mockResolvedValue({
      esFront: true,
      costoProducto: 150,
      costoEditado: 150,
    });

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(150);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.successMessage()).toContain('Precio costo: $150.00');
    expect(component.successMessage()).not.toContain('sin cambios');
  });

  it('36c. F3: toast aclara que el precio costo del producto NO cambió cuando el lote editado no es el frente FIFO', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
      { id: 43, producto_id: 1, cantidad: 5, precio_costo: 8, fecha_ingreso: '2026-02-01T00:00:00Z', ubicacion: 'shop', created_at: '2026-02-01T00:00:00Z' },
    ]);
    mockProductoService.listar
      .mockReturnValueOnce(of(productos.slice(0, 1)))
      .mockReturnValueOnce(of([{ ...productos[0], stock_almacen: 100, stock_shop: 5 }]));
    mockStockService.registrarEditar.mockResolvedValue({
      esFront: false,
      costoProducto: 5,
      costoEditado: 8,
    });

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Selecciona el lote 43 (shop nuevo) — no es el frente FIFO (lote 42 más viejo).
    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();
    component.selectedLoteIndex.set(2);
    fixture.detectChanges();
    component.actualizarPlaceholdersEditar();

    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(8);
    component.movimientoCantidad.set(5);
    component.movimientoMotivo.set('Actualización de precios');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.successMessage()).toContain('Costo del lote: $8.00');
    expect(component.successMessage()).toContain('Precio costo del producto sin cambios: $5.00');
    expect(component.successMessage()).toContain('lote más viejo con stock');
  });

  it('37. T-03: el toast se auto-oculta después de ~2.5s', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
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

    vi.useFakeTimers();
    await component.onSubmitMovimiento();
    fixture.detectChanges();

    expect(component.successMessage()).toContain('Stock guardado');

    vi.advanceTimersByTime(2500);
    fixture.detectChanges();

    expect(component.successMessage()).toBeNull();
    const toastAfter = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Stock guardado'),
    );
    expect(toastAfter).toBeFalsy();
    vi.useRealTimers();
  });

  it('38. T-03: si el guardado falla NO se muestra toast y el error queda visible', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([
      { id: 42, producto_id: 1, cantidad: 100, precio_costo: 8, fecha_ingreso: '2026-01-01T00:00:00Z', ubicacion: 'almacen', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));
    mockStockService.registrarEditar.mockRejectedValue(new Error('Error al guardar'));

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

    expect(component.successMessage()).toBeNull();
    expect(component.error()).toBe('Error al guardar');
    const toast = (Array.from(fixture.nativeElement.querySelectorAll('*')) as HTMLElement[]).find(
      (el) => el.textContent?.includes('Stock guardado'),
    );
    expect(toast).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-error-alert').textContent).toContain('Error al guardar');
  });

  it('39. F8: producto sin lotes en editar materializa lote 0 y guarda (loteId null)', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    // F8: sin selector de lote y sin crash; el form se prellena con datos del producto
    expect(component.productoLotes()).toHaveLength(0);
    expect(component.loteActual).toBeNull();
    expect(component.selectedLoteIndex()).toBeNull();
    expect(component.editarNombre()).toBe('Coca Cola');
    expect(component.editarPrecioVenta()).toBe(12);
    expect(component.editarPrecioCosto()).toBe(8);
    expect(component.movimientoCantidad()).toBe(0);
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();

    component.editarPrecioVenta.set(15);
    component.editarPrecioCosto.set(10);
    component.movimientoCantidad.set(80);
    component.movimientoMotivo.set('Sin lotes');
    fixture.detectChanges();

    await component.onSubmitMovimiento();
    fixture.detectChanges();

    // F8: se llama registrarEditar con loteId null y la ubicación con más stock (almacén)
    expect(mockStockService.registrarEditar).toHaveBeenCalledWith(
      1, null, 'Coca Cola', 15, 10, 80, 'Sin lotes', 'almacen',
    );
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toContain('Stock guardado');
  });

  it('39b. F8: onSelectAction en editar con lotes vacíos prellena nombre/precios del producto y selectedLoteIndex null', async () => {
    mockStockService.obtenerLotesPorProducto.mockResolvedValue([]);
    mockProductoService.listar.mockReturnValue(of(productos.slice(0, 1)));

    fixture = TestBed.createComponent(InventarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.onSelectAction(1, 'editar');
    fixture.detectChanges();

    expect(component.productoLotes()).toHaveLength(0);
    expect(component.selectedLoteIndex()).toBeNull();
    expect(component.editarNombre()).toBe(productos[0].nombre);
    expect(component.editarPrecioVenta()).toBe(productos[0].precio_venta);
    expect(component.editarPrecioCosto()).toBe(productos[0].precio_costo);
    expect(component.movimientoCantidad()).toBe(0);
  });

  describe('responsive layout', () => {
    it('debería tener container con max-w-7xl', () => {
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.max-w-7xl');
      expect(container).toBeTruthy();
    });
  });

  describe('elegirLoteInicialEdicion (F7: preselección por ubicación)', () => {
    const lotes = (
      datos: { id: number; ubicacion: 'almacen' | 'shop' }[],
    ) =>
      datos.map((l) => ({
        id: l.id,
        producto_id: 1,
        cantidad: 10,
        precio_costo: 8,
        fecha_ingreso: '2026-01-01T00:00:00Z',
        ubicacion: l.ubicacion,
        created_at: '2026-01-01T00:00:00Z',
      }));

    it('devuelve el frente de la ubicación con más stock cuando hay lotes mixtos', () => {
      const resultado = elegirLoteInicialEdicion(
        lotes([{ id: 43, ubicacion: 'shop' }, { id: 42, ubicacion: 'almacen' }]),
        100,
        10,
      );
      expect(resultado?.id).toBe(42);
    });

    it('devuelve el frente de shop cuando el stock principal está en shop', () => {
      const resultado = elegirLoteInicialEdicion(
        lotes([{ id: 41, ubicacion: 'almacen' }, { id: 44, ubicacion: 'shop' }]),
        5,
        50,
      );
      expect(resultado?.id).toBe(44);
    });

    it('empata a almacen cuando el stock es igual en ambas ubicaciones', () => {
      const resultado = elegirLoteInicialEdicion(
        lotes([{ id: 43, ubicacion: 'shop' }, { id: 42, ubicacion: 'almacen' }]),
        10,
        10,
      );
      expect(resultado?.id).toBe(42);
    });

    it('cae al frente FIFO global si la ubicación principal no tiene lotes', () => {
      const resultado = elegirLoteInicialEdicion(
        lotes([{ id: 44, ubicacion: 'shop' }]),
        100,
        10,
      );
      expect(resultado?.id).toBe(44);
    });

    it('devuelve null sin lotes', () => {
      expect(elegirLoteInicialEdicion([], 100, 10)).toBeNull();
    });
  });
});
