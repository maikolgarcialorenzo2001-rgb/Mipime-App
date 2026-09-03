import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import type { Producto } from '../models';

const harina: Producto = {
  id: 1,
  nombre: 'Harina 0000 1kg',
  descripcion: null,
  precio_venta: 850,
  precio_costo: 550,
  stock_almacen: 50,
  stock_shop: 0,
  unidad_medida: 'unidad',
  created_at: '2026-06-02T22:00:00Z',
  updated_at: '2026-06-02T22:00:00Z',
};

const leche: Producto = {
  id: 2,
  nombre: 'Leche Entera 1L',
  descripcion: null,
  precio_venta: 1100,
  precio_costo: 750,
  stock_almacen: 30,
  stock_shop: 0,
  unidad_medida: 'unidad',
  created_at: '2026-06-02T22:00:00Z',
  updated_at: '2026-06-02T22:00:00Z',
};

const jamon: Producto = {
  id: 3,
  nombre: 'Jamón x Kg',
  descripcion: null,
  precio_venta: 12000,
  precio_costo: 8000,
  stock_almacen: 10,
  stock_shop: 0,
  unidad_medida: 'gramaje',
  created_at: '2026-06-02T22:00:00Z',
  updated_at: '2026-06-02T22:00:00Z',
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CartService] });
    service = TestBed.inject(CartService);
  });

  afterEach(() => {
    service.limpiar();
  });

  describe('agregar', () => {
    it('debería agregar un producto al carrito', () => {
      service.agregar(harina);

      const items = service.items();
      expect(items).toHaveLength(1);
      expect(items[0].producto.id).toBe(1);
      expect(items[0].cantidad).toBe(1);
      expect(items[0].subtotal).toBe(850);
    });

    it('debería sumar cantidad si el producto ya existe', () => {
      service.agregar(harina);
      service.agregar(harina, 2);

      const items = service.items();
      expect(items).toHaveLength(1);
      expect(items[0].cantidad).toBe(3);
      expect(items[0].subtotal).toBe(2550);
    });

    it('debería ignorar cantidad <= 0', () => {
      service.agregar(harina, 0);
      expect(service.items()).toHaveLength(0);
    });
  });

  describe('total', () => {
    it('debería calcular el total correctamente', () => {
      service.agregar(harina, 2); // 2 × 850 = 1700
      service.agregar(leche, 1);  // 1 × 1100 = 1100

      expect(service.total()).toBe(2800);
    });

    it('debería ser 0 si el carrito está vacío', () => {
      expect(service.total()).toBe(0);
    });
  });

  describe('actualizarCantidad', () => {
    it('debería actualizar cantidad y subtotal', () => {
      service.agregar(harina, 2);
      service.actualizarCantidad(1, 5);

      const item = service.items()[0];
      expect(item.cantidad).toBe(5);
      expect(item.subtotal).toBe(4250);
    });

    it('debería quitar el item si cantidad <= 0', () => {
      service.agregar(harina);
      service.actualizarCantidad(1, 0);

      expect(service.items()).toHaveLength(0);
    });
  });

  describe('quitar', () => {
    it('debería eliminar un producto del carrito', () => {
      service.agregar(harina);
      service.agregar(leche);
      service.quitar(1);

      expect(service.items()).toHaveLength(1);
      expect(service.items()[0].producto.id).toBe(2);
    });
  });

  describe('limpiar', () => {
    it('debería vaciar el carrito', () => {
      service.agregar(harina);
      service.agregar(leche);
      service.limpiar();

      expect(service.items()).toHaveLength(0);
      expect(service.total()).toBe(0);
    });
  });

  describe('stepPara / incrementar / decrementar por unidad de medida', () => {
    it('stepPara devuelve 1 para producto de unidad', () => {
      expect(service.stepPara(harina)).toBe(1);
    });

    it('stepPara devuelve 0.1 para producto de gramaje', () => {
      expect(service.stepPara(jamon)).toBe(0.1);
    });

    it('incrementar suma 1 a un producto de unidad', () => {
      service.agregar(harina, 2);
      service.incrementar(harina, 2);
      expect(service.items()[0].cantidad).toBe(3);
    });

    it('incrementar suma 0.1 a un producto de gramaje', () => {
      service.agregar(jamon, 2.5);
      service.incrementar(jamon, 2.5);
      expect(service.items()[0].cantidad).toBe(2.6);
    });

    it('decrementar resta 1 a un producto de unidad', () => {
      service.agregar(harina, 2);
      service.decrementar(harina, 2);
      expect(service.items()[0].cantidad).toBe(1);
    });

    it('decrementar resta 0.1 a un producto de gramaje', () => {
      service.agregar(jamon, 2.5);
      service.decrementar(jamon, 2.5);
      expect(service.items()[0].cantidad).toBe(2.4);
    });

    it('incrementar redondea para evitar ruido de float (0.2 + 0.1 = 0.3)', () => {
      service.agregar(jamon, 0.2);
      service.incrementar(jamon, 0.2);
      expect(service.items()[0].cantidad).toBe(0.3);
    });

    it('decrementar a 0 quita el item (no baja de 0)', () => {
      service.agregar(jamon, 0.1);
      service.decrementar(jamon, 0.1);
      expect(service.items()).toHaveLength(0);
    });
  });
});
