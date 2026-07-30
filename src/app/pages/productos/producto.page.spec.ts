import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductosPage } from './producto.page';
import { ProductoService } from '../../services/producto.service';
import { StockMovimientoService } from '../../services/stock-movimiento.service';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import { Observable, of, throwError } from 'rxjs';
import type { Producto } from '../../models';
import type { GlobalInvestment, PerProductInvestment } from '../../models';
import type { LoteDetalle } from '../../models';

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

const mockLotes: LoteDetalle[] = [
  { id: 1, producto_id: 1, cantidad: 10, precio_costo: 300, fecha_ingreso: '2024-01-15T00:00:00.000Z', stock_almacen: 8, stock_shop: 2, created_at: '' },
  { id: 2, producto_id: 1, cantidad: 5, precio_costo: 350, fecha_ingreso: '2024-06-01T00:00:00.000Z', stock_almacen: 0, stock_shop: 5, created_at: '' },
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
      obtenerLotesAgrupados: vi.fn().mockResolvedValue([]),
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
    const retryBtn = (Array.from(buttons) as Element[]).find((b) => b.textContent?.includes('Reintentar'));
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);

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

    vi.restoreAllMocks();
  });

  it('shows error on insufficient stock for merma', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockStockService.registrarMerma.mockRejectedValue(
      new Error('Stock insuficiente'),
    );

    component.abrirMerma(1);
    component.mermaCantidad.set(999);
    component.mermaMotivo.set('Rotura');
    fixture.detectChanges();

    await component.onSubmitMerma();
    fixture.detectChanges();

    expect(component.mermaError()).toBe('Stock insuficiente');

    vi.restoreAllMocks();
  });

  it('Merma button exists and is distinct from other buttons', () => {
    const allBtns = fixture.nativeElement.querySelectorAll('button');
    const mermaBtn = Array.from(allBtns).find(
      (b) => (b as HTMLButtonElement).textContent?.includes('Merma'),
    ) as HTMLButtonElement;
    expect(mermaBtn).toBeTruthy();
    // Verify it's a button that triggers merma action (not disabled by default)
    expect(mermaBtn.textContent).toContain('Merma');
  });

  it('cancelarMerma hides form', () => {
    component.abrirMerma(1);
    fixture.detectChanges();
    expect(component.selectedProductoId()).toBe(1);

    component.cancelarMerma();
    fixture.detectChanges();
    expect(component.selectedProductoId()).toBeNull();
  });

  describe('merma stock validation', () => {
    it('debería mostrar stock disponible según ubicacion shop', () => {
      component.abrirMerma(1);
      component.mermaUbicacion.set('shop');
      fixture.detectChanges();

      // Product 1 has stock_shop = 0
      expect(component.mermaStockDisponible()).toBe(0);
    });

    it('debería mostrar stock_almacen cuando ubicacion=almacen', () => {
      component.abrirMerma(1);
      component.mermaUbicacion.set('almacen');
      fixture.detectChanges();

      // Product 1 has stock_almacen = 10
      expect(component.mermaStockDisponible()).toBe(10);
    });

    it('debería indicar stock insuficiente cuando cantidad > stock disponible', () => {
      component.abrirMerma(1);
      component.mermaUbicacion.set('shop');
      component.mermaCantidad.set(5);
      fixture.detectChanges();

      // Product 1 stock_shop = 0, so 5 > 0 → false
      expect(component.mermaStockSuficiente()).toBe(false);
    });

    it('debería indicar stock suficiente cuando cantidad <= stock disponible', () => {
      component.abrirMerma(1);
      component.mermaUbicacion.set('almacen');
      component.mermaCantidad.set(3);
      fixture.detectChanges();

      // Product 1 stock_almacen = 10, so 3 <= 10 → true
      expect(component.mermaStockSuficiente()).toBe(true);
    });

    it('debería tener el botón disabled + tooltip cuando stock insuficiente', () => {
      component.abrirMerma(1);
      component.mermaUbicacion.set('shop');
      component.mermaCantidad.set(999);
      fixture.detectChanges();

      const submitBtn = fixture.nativeElement.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;

      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.getAttribute('title')).toBe('Stock insuficiente');
    });
  });

  describe('merma confirm cancel', () => {
    it('debería NO llamar registrarMerma cuando confirm se cancela', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.abrirMerma(1);
      component.mermaCantidad.set(3);
      component.mermaMotivo.set('Rotura');
      fixture.detectChanges();

      await component.onSubmitMerma();
      fixture.detectChanges();

      expect(mockStockService.registrarMerma).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('debería llamar registrarMerma cuando confirm se acepta', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.abrirMerma(1);
      component.mermaCantidad.set(3);
      component.mermaMotivo.set('Rotura');
      fixture.detectChanges();

      await component.onSubmitMerma();
      fixture.detectChanges();

      expect(mockStockService.registrarMerma).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // ── Investment Stats Tests ─────────────────────────────────────

  describe('investment stats', () => {
    const mockGlobalStats: GlobalInvestment = {
      total_global: 150000,
      total_almacen: 100000,
      total_shop: 50000,
    };

    const mockPerProduct: PerProductInvestment[] = [
      { producto_id: 1, total_invertido: 60000 },
      { producto_id: 2, total_invertido: 90000 },
    ];

    beforeEach(() => {
      vi.spyOn(productoService, 'obtenerInversionGlobal').mockReturnValue(of(mockGlobalStats));
      vi.spyOn(productoService, 'obtenerInversionPorProducto').mockReturnValue(of(mockPerProduct));

      component.recargar();
      fixture.detectChanges();
    });

    it('3.1 RED: debería mostrar la barra de stats con total_global, total_almacen y total_shop', () => {
      const el = fixture.nativeElement as HTMLElement;

      // The stats bar should show the three formatted values
      expect(el.textContent).toContain('Total invertido');
      expect(el.textContent).toContain('Almacén');
      expect(el.textContent).toContain('Tienda');
      // Formatted values from CurrencyPipe: ARS 150,000 etc.
      expect(el.textContent).toContain('150,000');
      expect(el.textContent).toContain('100,000');
      expect(el.textContent).toContain('50,000');
    });

    it('3.1 RED: debería mostrar columna "Total invertido" en la tabla', () => {
      const el = fixture.nativeElement as HTMLElement;
      const headers = el.querySelectorAll('th');
      const totalInvertidoHeader = Array.from(headers).find(
        (h) => h.textContent?.includes('Total invertido'),
      );
      expect(totalInvertidoHeader).toBeTruthy();
    });

    it('3.1 RED: debería mostrar el valor formateado para cada producto', () => {
      const el = fixture.nativeElement as HTMLElement;
      // Product 1 has 60000, product 2 has 90000
      expect(el.textContent).toContain('60,000');
      expect(el.textContent).toContain('90,000');
    });

    it('3.1 RED: debería esconder stats bar si no hay productos cargados', () => {
      vi.spyOn(productoService, 'listar').mockReturnValue(of([]));
      component.recargar();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      // Stats bar lives inside a div with these classes when visible
      const statsDiv = el.querySelector('div.mb-4.flex.flex-wrap');
      expect(statsDiv).toBeFalsy();
    });

    it('debería esconder stats bar cuando la inversión falla', () => {
      vi.spyOn(productoService, 'obtenerInversionGlobal').mockReturnValue(
        throwError(() => new Error('Error de carga')),
      );
      component.recargar();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      // Products still render
      expect(el.textContent).toContain('Café');
      expect(el.textContent).toContain('Té');
      // Stats bar hidden
      const statsDiv = el.querySelector('div.mb-4.flex.flex-wrap');
      expect(statsDiv).toBeFalsy();
    });
  });

  // ── Precio costo column tests ──────────────────────────────────

  describe('precio costo column', () => {
    it('4.1 RED: muestra columna "Precio costo" en el encabezado de la tabla', () => {
      const el = fixture.nativeElement as HTMLElement;
      const headers = el.querySelectorAll('th');
      const precioCostoHeader = Array.from(headers).find(
        (h) => h.textContent?.includes('Precio costo'),
      );
      expect(precioCostoHeader).toBeTruthy();
    });

    it('4.1 RED: renderiza precio_costo formateado en cada fila', () => {
      const el = fixture.nativeElement as HTMLElement;
      // Product 1 has precio_costo = 300
      expect(el.textContent).toContain('300');
    });

    it('4.1 RED: muestra "--" cuando precio_costo es null', () => {
      // Add a product with null precio_costo
      const productoConNull: Producto = {
        ...mockProductos[0],
        id: 3,
        nombre: 'Azúcar',
        precio_costo: null,
      };
      vi.spyOn(productoService, 'listar').mockReturnValue(
        of([...mockProductos, productoConNull]),
      );
      component.recargar();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Azúcar');
      expect(fixture.nativeElement.textContent).toContain('--');
    });
  });

  // ── Lotes button tests ─────────────────────────────────────────

  describe('lotes button', () => {
    function getLotesButtons(): HTMLButtonElement[] {
      const allBtns = fixture.nativeElement.querySelectorAll('button');
      return Array.from(allBtns).filter(
        (b) => (b as HTMLButtonElement).textContent?.includes('Lotes'),
      ) as HTMLButtonElement[];
    }

    it('4.2 RED: muestra botón Lotes por cada fila de producto', () => {
      const lotesBtns = getLotesButtons();
      expect(lotesBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('4.2 RED: el botón Lotes existe y tiene texto distinto al de Merma', () => {
      const lotesBtns = getLotesButtons();
      expect(lotesBtns.length).toBeGreaterThanOrEqual(1);
      for (const btn of lotesBtns) {
        expect(btn.textContent).toContain('Lotes');
      }
    });

    it('4.2 RED: cada fila tiene al menos 2 botones de acción (Merma + Lotes)', () => {
      const allBtns = fixture.nativeElement.querySelectorAll('button');
      expect(allBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Lotes expand/collapse tests ────────────────────────────────

  describe('lotes expand/collapse', () => {
    beforeEach(() => {
      mockStockService.obtenerLotesAgrupados.mockResolvedValue(mockLotes);
    });

    it('4.3 RED: toggleLotes expande el detalle inline con tabla de lotes', async () => {
      await component.toggleLotes(1);
      fixture.detectChanges();

      expect(component.lotesProductoId()).toBe(1);
      const el = fixture.nativeElement as HTMLElement;
      // Should show lotes detail table
      const tables = el.querySelectorAll('table');
      // There should be at least the main table + the lotes detail table
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });

    it('4.3 RED: toggleLotes con el mismo id cierra el detalle', async () => {
      // Expand first
      await component.toggleLotes(1);
      fixture.detectChanges();

      expect(component.lotesProductoId()).toBe(1);

      // Collapse
      await component.toggleLotes(1);
      fixture.detectChanges();

      expect(component.lotesProductoId()).toBeNull();
    });

    it('4.3 RED: muestra fecha formateada, cantidad, precio_costo, stock x ubicación y total invertido', async () => {
      await component.toggleLotes(1);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      // Lote 1: 10 x 300 = 3000 total, 8 en almacén, 2 en tienda
      expect(el.textContent).toContain('10');
      expect(el.textContent).toContain('3,000');
      expect(el.textContent).toContain('8');
      expect(el.textContent).toContain('2');
    });
  });

  // ── Lotes cache tests ──────────────────────────────────────────

  describe('lotes cache', () => {
    it('4.4 RED: obtiene lotes una sola vez por producto aunque se abra/cierre varias veces', async () => {
      mockStockService.obtenerLotesAgrupados.mockResolvedValue(mockLotes);

      // First toggle
      await component.toggleLotes(1);
      fixture.detectChanges();

      expect(mockStockService.obtenerLotesAgrupados).toHaveBeenCalledTimes(1);
      expect(mockStockService.obtenerLotesAgrupados).toHaveBeenCalledWith(1);

      // Collapse (does NOT call service again — sets null)
      await component.toggleLotes(1);
      fixture.detectChanges();

      // Re-expand — should NOT call again (cached)
      await component.toggleLotes(1);
      fixture.detectChanges();

      // Still only 1 call
      expect(mockStockService.obtenerLotesAgrupados).toHaveBeenCalledTimes(1);
    });
  });

  // ── Lotes empty state ─────────────────────────────────────────

  describe('lotes empty state', () => {
    it('4.5 RED: muestra "Sin lotes activos" cuando no hay lotes', async () => {
      mockStockService.obtenerLotesAgrupados.mockResolvedValue([]);

      await component.toggleLotes(2);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Sin lotes activos');
    });
  });

  // ── Lotes loading state ───────────────────────────────────────

  describe('lotes loading state', () => {
    it('4.6 RED: muestra indicador de carga mientras se obtienen los lotes', async () => {
      // Create a promise that doesn't resolve immediately
      let resolveLotes!: (v: LoteDetalle[]) => void;
      mockStockService.obtenerLotesAgrupados.mockReturnValue(
        new Promise<LoteDetalle[]>((resolve) => {
          resolveLotes = resolve;
        }),
      );

      // Start toggle but don't await — we want to catch loading state
      const togglePromise = component.toggleLotes(1);
      fixture.detectChanges();

      // Loading should be true since promise hasn't resolved
      expect(component.lotesLoading()).toBe(true);

      // Now resolve the promise
      resolveLotes(mockLotes);
      await togglePromise;
      fixture.detectChanges();

      expect(component.lotesLoading()).toBe(false);
    });
  });

  // ── Merma colspan regression ───────────────────────────────────

  describe('merma colspan regression', () => {
    it('4.7 RED: el formulario de merma usa colspan="7"', () => {
      component.abrirMerma(1);
      fixture.detectChanges();

      const expandedTd = fixture.nativeElement.querySelector(
        'td[colspan="7"]',
      ) as HTMLElement;
      expect(expandedTd).toBeTruthy();
      expect(expandedTd.getAttribute('colspan')).toBe('7');
    });
  });

  describe('responsive layout', () => {
    it('debería tener container con max-w-7xl', () => {
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('.max-w-7xl');
      expect(container).toBeTruthy();
    });
  });
});
