import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { VentaService } from './venta.service';
import { StockMovimientoService } from './stock-movimiento.service';
import { DATABASE, type Database } from './database';
import type { CartItem } from './cart.service';
import type { Producto } from '../models';

const mockProducto: Producto = {
  id: 1,
  nombre: 'Harina 0000 1kg',
  descripcion: 'Harina de trigo',
  precio_venta: 850,
  precio_costo: 550,
  stock_actual: 50,
  created_at: '2026-06-02T22:00:00Z',
  updated_at: '2026-06-02T22:00:00Z',
};

const mockItems: CartItem[] = [
  { producto: mockProducto, cantidad: 2, subtotal: 1700 },
  {
    producto: { ...mockProducto, id: 2, nombre: 'Azúcar 1kg' },
    cantidad: 1,
    subtotal: 900,
  },
];

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VentaService', () => {
  let mockDb: Database;
  let service: VentaService;
  let stockMovimientoService: StockMovimientoService;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        VentaService,
        StockMovimientoService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });

    service = TestBed.inject(VentaService);
    stockMovimientoService = TestBed.inject(StockMovimientoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registrar', () => {
    it('debería llamar a StockMovimientoService.registrarSalida por cada item', async () => {
      // Mock de las 4 consultas internas de VentaService._ejecutar:
      // 1. INSERT ventas → RETURNING *
      // 2. INSERT detalle_ventas
      // 3. UPDATE stock productos
      // 4. UPDATE jornada
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ id: 1, jornada_id: 1, fecha_hora: '2026-06-04T10:00:00Z', total: 2600, created_at: '2026-06-04T10:00:00Z' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock de registrarSalida (SELECT stock + INSERT movimiento + UPDATE stock)
      vi.mocked(mockDb.sql)
        .mockResolvedValueOnce([{ stock_actual: 50 }]) // SELECT stock for item 1
        .mockResolvedValueOnce([]) // INSERT movimiento item 1
        .mockResolvedValueOnce([]) // UPDATE stock item 1
        .mockResolvedValueOnce([{ stock_actual: 50 }]) // SELECT stock for item 2
        .mockResolvedValueOnce([]) // INSERT movimiento item 2
        .mockResolvedValueOnce([]); // UPDATE stock item 2

      const venta = await firstValueFrom(service.registrar(1, mockItems));

      expect(venta.id).toBe(1);
      expect(venta.total).toBe(2600);

      // Verificar que se llamó a registrarSalida para cada item
      // Estas son llamadas 5-10 en el mock (tras las 4 llamadas internas)
      const allCalls = vi.mocked(mockDb.sql).mock.calls;

      // Llamada 5: SELECT stock para producto 1 (primer item)
      expect(allCalls[4][0]).toContain('SELECT stock_actual');
      expect(allCalls[4][1]).toEqual([mockItems[0].producto.id]);

      // Llamada 8: SELECT stock para producto 2 (segundo item)
      expect(allCalls[7][0]).toContain('SELECT stock_actual');
      expect(allCalls[7][1]).toEqual([mockItems[1].producto.id]);
    });
  });
});
