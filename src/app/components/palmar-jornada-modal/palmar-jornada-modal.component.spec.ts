import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  PalmarJornadaModalComponent,
  PALMAR_JORNADA_SERVICE,
} from './palmar-jornada-modal.component';
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
}): Promise<{
  fixture: ComponentFixture<PalmarJornadaModalComponent>;
  component: PalmarJornadaModalComponent;
}> {
  mockService = {
    listarProductos: vi.fn().mockResolvedValue(opts.productos),
    registrarJornada: vi.fn().mockResolvedValue({ ok: true }),
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
  });
});
