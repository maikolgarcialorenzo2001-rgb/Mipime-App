import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  PalmarJornadaModalComponent,
  PALMAR_JORNADA_SERVICE,
} from './palmar-jornada-modal.component';
import type { PalmarJornadaPayload } from './palmar-jornada-modal.component';
import { ArqueoBilletesFormComponent } from '../arqueo-billetes-form/arqueo-billetes-form.component';
import type { Producto } from '../../models';

/** Fixtures de catálogo (contrato PR6: listarProductos → Producto[]). */
const PRODUCTOS: Producto[] = [
  { id: 1, nombre: 'Pan casero', descripcion: null, precio_venta: 1500, precio_costo: 900, stock_almacen: 0, stock_shop: 0, created_at: '', updated_at: '' },
  { id: 2, nombre: 'Café molido', descripcion: null, precio_venta: 2500, precio_costo: 1400, stock_almacen: 0, stock_shop: 0, created_at: '', updated_at: '' },
];

interface MockPalmarService {
  listarProductos: ReturnType<typeof vi.fn>;
  registrarJornada: ReturnType<typeof vi.fn>;
}

let mockService: MockPalmarService;

/**
 * Crea el modal con un PalmarService MOCKEADO (contrato congelado PR6,
 * plan §Contratos — nunca el cuerpo real). Cada test arma su propio fixture.
 */
async function crearModal(opts: {
  productos: Producto[];
  registrarJornada?: ReturnType<typeof vi.fn>;
}): Promise<{
  fixture: ComponentFixture<PalmarJornadaModalComponent>;
  component: PalmarJornadaModalComponent;
}> {
  mockService = {
    listarProductos: vi.fn().mockResolvedValue(opts.productos),
    registrarJornada:
      opts.registrarJornada ?? vi.fn().mockResolvedValue({ ok: true }),
  };

  TestBed.configureTestingModule({
    imports: [PalmarJornadaModalComponent],
    providers: [{ provide: PALMAR_JORNADA_SERVICE, useValue: mockService }],
  });

  const fixture = TestBed.createComponent(PalmarJornadaModalComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

function clickBoton(fixture: ComponentFixture<PalmarJornadaModalComponent>, texto: string): void {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
  const btn = buttons.find((b) => b.textContent?.includes(texto));
  expect(btn).toBeTruthy();
  btn!.click();
  fixture.detectChanges();
}

function textoDe(fixture: ComponentFixture<PalmarJornadaModalComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

/** Maneja el arqueo compartido embebido (P-FR6): integración real vía arqueoChange. */
function setArqueo(fixture: ComponentFixture<PalmarJornadaModalComponent>, entries: [number, number][]): void {
  const arqueoDebug = fixture.debugElement.query(By.directive(ArqueoBilletesFormComponent));
  expect(arqueoDebug).toBeTruthy();
  const arqueo = arqueoDebug.componentInstance as ArqueoBilletesFormComponent;
  for (const [denominacion, cantidad] of entries) {
    arqueo.actualizarCantidad(denominacion, cantidad);
  }
  fixture.detectChanges();
}

describe('PalmarJornadaModalComponent', () => {
  describe('Fase 1 — productos (P-FR4)', () => {
    it('P-FR4: al abrir llama listarProductos() y pre-rellena cada producto con cantidad 0', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });

      expect(mockService.listarProductos).toHaveBeenCalledTimes(1);
      expect(component.phase()).toBe(1);
      expect(component.productos()).toEqual([
        { id: 1, nombre: 'Pan casero', cantidad: 0, precio_venta: 1500, precio_costo: 900 },
        { id: 2, nombre: 'Café molido', cantidad: 0, precio_venta: 2500, precio_costo: 1400 },
      ]);

      const text = textoDe(fixture);
      expect(text).toContain('Pan casero');
      expect(text).toContain('Café molido');

      const inputs = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
      expect(inputs.length).toBe(2);
      expect(inputs.every((i) => i.value === '0')).toBe(true);
    });

    it('P-FR4: sin productos muestra estado vacío y Continuar deshabilitado', async () => {
      const { fixture, component } = await crearModal({ productos: [] });

      expect(component.productos()).toEqual([]);
      expect(textoDe(fixture)).toContain('No hay productos disponibles');

      const continuar = (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Continuar')) as HTMLButtonElement;
      expect(continuar).toBeTruthy();
      expect(continuar.disabled).toBe(true);
    });

    it('los inputs de cantidad solo aceptan enteros no negativos (filtrarTecla)', async () => {
      const { component } = await crearModal({ productos: PRODUCTOS });

      const bloqueada = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      component.filtrarTecla(bloqueada);
      expect(bloqueada.defaultPrevented).toBe(true);
      expect(component.soloNumeros()).toBe(true);

      const permitida = new KeyboardEvent('keydown', { key: '5', cancelable: true });
      component.filtrarTecla(permitida);
      expect(permitida.defaultPrevented).toBe(false);

      component.actualizarCantidad(1, -3);
      expect(component.productos()[0].cantidad).toBe(0);
      component.actualizarCantidad(1, Number.NaN);
      expect(component.productos()[0].cantidad).toBe(0);
      component.actualizarCantidad(1, 2);
      expect(component.productos()[0].cantidad).toBe(2);
    });
  });

  describe('Navegación de fases (P-FR5)', () => {
    it('P-FR5/P-FR6: Continuar pasa a fase 2 embebiendo el arqueo compartido', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 2);
      fixture.detectChanges();

      clickBoton(fixture, 'Continuar');

      expect(component.phase()).toBe(2);
      const arqueo = fixture.debugElement.query(By.directive(ArqueoBilletesFormComponent));
      expect(arqueo).toBeTruthy();
      expect(textoDe(fixture)).toContain('Conteo de billetes / monedas');
    });

    it('P-FR5: Atrás en fase 2 vuelve a fase 1 conservando las cantidades', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 3);
      component.actualizarCantidad(2, 1);
      fixture.detectChanges();

      clickBoton(fixture, 'Continuar');
      expect(component.phase()).toBe(2);
      clickBoton(fixture, 'Atrás');

      expect(component.phase()).toBe(1);
      expect(component.productos()[0].cantidad).toBe(3);
      expect(component.productos()[1].cantidad).toBe(1);
      const inputs = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
      expect(inputs[0].value).toBe('3');
      expect(inputs[1].value).toBe('1');
    });

    it('P-FR5: Atrás en fase 1 cierra el modal (emite cerrar)', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      const cerrarSpy = vi.fn();
      component.cerrar.subscribe(cerrarSpy);

      clickBoton(fixture, 'Cancelar');

      expect(cerrarSpy).toHaveBeenCalledTimes(1);
    });

    it('P-FR5: Atrás en fase 3 vuelve a fase 2 y está siempre disponible en 2-3', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 1);
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[100, 1]]);
      clickBoton(fixture, 'Continuar');
      expect(component.phase()).toBe(3);

      clickBoton(fixture, 'Atrás');

      expect(component.phase()).toBe(2);
      expect(component.phase()).not.toBe(3);
    });
  });

  describe('Fase 3 — confirmación (P-FR7)', () => {
    it('P-FR7: muestra dinero según ventas, conteo de billetes y diferencia', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 2); // 2 × 1500 = 3000
      component.actualizarCantidad(2, 1); // 1 × 2500 = 2500 → ventas 5500
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[5000, 1]]); // arqueo 5000
      clickBoton(fixture, 'Continuar');

      expect(component.phase()).toBe(3);
      expect(component.totalVentas()).toBe(5500);
      expect(component.arqueoTotal()).toBe(5000);
      expect(component.diferencia()).toBe(500);

      const text = textoDe(fixture);
      expect(text).toContain('Dinero según ventas');
      expect(text).toContain('Dinero según conteo de billetes');
      expect(text).toContain((5500).toLocaleString());
      expect(text).toContain((5000).toLocaleString());
    });

    it('P-FR7: calcula el equivalente CUP en vivo de USD y EUR con tasas manuales', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 1);
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[100, 1]]);
      clickBoton(fixture, 'Continuar');

      component.usd.set(100);
      component.tasaUsd.set(320);
      component.eur.set(50);
      component.tasaEur.set(350);
      fixture.detectChanges();

      expect(component.usdCup()).toBe(32000);
      expect(component.eurCup()).toBe(17500);
      expect(component.divisaCup()).toBe(49500);

      const text = textoDe(fixture);
      expect(text).toContain((32000).toLocaleString());
      expect(text).toContain((17500).toLocaleString());
      expect(text).toContain((49500).toLocaleString());
    });

    it('P-FR7: total recibido = arqueo + divisa CUP + transferencia; ganancia = recibido − invertido', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 2); // Pan: 2×1500 venta, 2×900 costo
      component.actualizarCantidad(2, 1); // Café: 1×2500 venta, 1×1400 costo
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[5000, 1]]); // arqueo 5000
      clickBoton(fixture, 'Continuar');

      component.usd.set(10);
      component.tasaUsd.set(300); // 3000 CUP
      component.transferencia.set(2000);
      fixture.detectChanges();

      expect(component.totalVentas()).toBe(5500);
      expect(component.totalRecibido()).toBe(5000 + 3000 + 2000);
      expect(component.invertido()).toBe(1800 + 1400);
      expect(component.ganancia()).toBe(10000 - 3200);

      const text = textoDe(fixture);
      expect(text).toContain('Total recibido');
      expect(text).toContain((10000).toLocaleString());
      expect(text).toContain((3200).toLocaleString());
      expect(text).toContain((6800).toLocaleString());
    });

    it('P-FR7: invertido trata precio_costo null como 0', async () => {
      const mixto: Producto[] = [
        { ...PRODUCTOS[0], id: 1, precio_costo: 900 },
        { ...PRODUCTOS[1], id: 2, precio_costo: null },
      ];
      const { component } = await crearModal({ productos: mixto });

      component.actualizarCantidad(1, 2); // 2 × 900 = 1800
      component.actualizarCantidad(2, 3); // 3 × (null → 0) = 0
      expect(component.invertido()).toBe(1800);
    });
  });

  describe('Validación (P-FR8)', () => {
    it('P-FR8: bloquea Guardar si ningún producto tiene cantidad > 0 (error inline)', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[100, 1]]);
      clickBoton(fixture, 'Continuar');

      const savedSpy = vi.fn();
      component.saved.subscribe(savedSpy);
      clickBoton(fixture, 'Guardar');

      expect(mockService.registrarJornada).not.toHaveBeenCalled();
      expect(savedSpy).not.toHaveBeenCalled();
      expect(textoDe(fixture)).toContain('Ingresá la cantidad de al menos un producto');
    });

    it('P-FR8: bloquea Guardar si ninguna denominación tiene cantidad > 0 (error inline)', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 1);
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      clickBoton(fixture, 'Continuar'); // fase 3 sin arqueo

      clickBoton(fixture, 'Guardar');

      expect(mockService.registrarJornada).not.toHaveBeenCalled();
      expect(textoDe(fixture)).toContain('Ingresá el conteo de al menos una denominación');
    });

    it('P-FR8: la diferencia entre ventas y recibido NO bloquea el guardado', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(2, 1); // ventas 2500
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[2000, 1]]); // arqueo 2000 → diferencia 500
      clickBoton(fixture, 'Continuar');

      expect(component.diferencia()).toBe(500);
      const savedSpy = vi.fn();
      component.saved.subscribe(savedSpy);
      clickBoton(fixture, 'Guardar');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockService.registrarJornada).toHaveBeenCalledTimes(1);
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Guardar — contrato PR6', () => {
    it('P-FR9: llama registrarJornada con el payload completo y emite saved', async () => {
      const { fixture, component } = await crearModal({ productos: PRODUCTOS });
      component.actualizarCantidad(1, 2);
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[5000, 1], [100, 3]]);
      clickBoton(fixture, 'Continuar');

      component.usd.set(10);
      component.tasaUsd.set(300);
      component.eur.set(2);
      component.tasaEur.set(350);
      component.transferencia.set(1500);
      fixture.detectChanges();

      const savedSpy = vi.fn();
      component.saved.subscribe(savedSpy);
      clickBoton(fixture, 'Guardar');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockService.registrarJornada).toHaveBeenCalledTimes(1);
      const payload = mockService.registrarJornada.mock.calls[0][0] as PalmarJornadaPayload;
      expect(payload.productos).toEqual([
        { id: 1, nombre: 'Pan casero', cantidad: 2, precio_venta: 1500, precio_costo: 900 },
        { id: 2, nombre: 'Café molido', cantidad: 0, precio_venta: 2500, precio_costo: 1400 },
      ]);
      expect(payload.arqueo).toEqual([
        { denominacion: 5000, cantidad: 1, subtotal: 5000 },
        { denominacion: 100, cantidad: 3, subtotal: 300 },
      ]);
      expect(payload.divisa).toEqual({ usd: 10, eur: 2, tasa_usd: 300, tasa_eur: 350 });
      expect(payload.transferencia).toBe(1500);
      expect(savedSpy).toHaveBeenCalledTimes(1);
      expect(component.guardando()).toBe(false);
    });

    it('muestra el error y NO emite saved si registrarJornada falla', async () => {
      const { fixture, component } = await crearModal({
        productos: PRODUCTOS,
        registrarJornada: vi.fn().mockRejectedValue(new Error('Disco lleno')),
      });
      component.actualizarCantidad(1, 1);
      fixture.detectChanges();
      clickBoton(fixture, 'Continuar');
      setArqueo(fixture, [[100, 1]]);
      clickBoton(fixture, 'Continuar');

      const savedSpy = vi.fn();
      component.saved.subscribe(savedSpy);
      clickBoton(fixture, 'Guardar');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(savedSpy).not.toHaveBeenCalled();
      expect(textoDe(fixture)).toContain('Disco lleno');
      expect(component.phase()).toBe(3); // sigue en la fase para reintentar
      expect(component.guardando()).toBe(false);
    });
  });
});
