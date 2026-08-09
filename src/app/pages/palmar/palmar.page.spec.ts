import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PalmarPage } from './palmar.page';
import { PalmarService } from '../../services/palmar.service';
import { PalmarJornadaModalComponent } from '../../components/palmar-jornada-modal/palmar-jornada-modal.component';
import type { PalmarHistoryEntry, PalmarRecord } from '../../models';

const fixtures: PalmarHistoryEntry[] = [
  {
    fileName: '05-06-2026.json',
    createdAt: '2026-06-05T09:00:00Z',
    totalVentas: 15000,
    totalArqueo: 16000,
    totalRecibido: 16000,
    usuario: 'Admin',
  },
  {
    fileName: '04-06-2026.json',
    createdAt: '2026-06-04T09:00:00Z',
    totalVentas: 8000,
    totalArqueo: 7500,
    totalRecibido: 7500,
    usuario: null,
  },
];

/** Registro completo que devuelve verDetalle (contrato PalmarRecord). */
const RECORD_DETALLE: PalmarRecord = {
  version: 1,
  id: 'palmar-2026-06-05',
  fecha: '2026-06-05',
  created_at: '2026-06-05T09:00:00Z',
  usuario: 'Admin',
  productos: [
    { nombre: 'Agua 500ml', cantidad: 2, precio_venta: 50, precio_costo: 30, subtotal: 100, costo_subtotal: 60 },
  ],
  arqueo: [{ denominacion: 100, cantidad: 1, subtotal: 100 }],
  divisa: { usd: 0, eur: 0, tasa_usd: 0, tasa_eur: 0, usd_cup: 0, eur_cup: 0, divisa_cup: 0 },
  transferencia: 0,
  total_ventas: 100,
  total_arqueo: 100,
  total_recibido: 100,
  invertido: 60,
  ganancia: 40,
  diferencia: 0,
};

const AVISO_DESKTOP = 'Historial disponible solo en la app de escritorio';

describe('PalmarPage', () => {
  let mockPalmar: {
    cargarHistorial: ReturnType<typeof vi.fn>;
    listarProductos: ReturnType<typeof vi.fn>;
    registrarJornada: ReturnType<typeof vi.fn>;
    verDetalle: ReturnType<typeof vi.fn>;
    volverAImprimir: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  /**
   * Crea la página con un PalmarService MOCKEADO (contrato real PR6/PR8) y el
   * gate D5 según `desktop`. El token PALMAR_JORNADA_SERVICE del modal resuelve
   * a ESTE mock vía `useExisting` (integración PR8).
   */
  async function crearPagina(opts: {
    desktop: boolean;
    entries: PalmarHistoryEntry[];
  }): Promise<ComponentFixture<PalmarPage>> {
    if (opts.desktop) {
      window.electronAPI = {} as unknown as ElectronAPI;
    } else {
      delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    }
    mockPalmar = {
      cargarHistorial: vi.fn().mockResolvedValue(opts.entries),
      listarProductos: vi.fn().mockResolvedValue([]),
      registrarJornada: vi.fn().mockResolvedValue({ ok: true }),
      verDetalle: vi.fn().mockResolvedValue(RECORD_DETALLE),
      volverAImprimir: vi.fn().mockResolvedValue({ ok: true }),
    };

    TestBed.configureTestingModule({
      imports: [PalmarPage],
      providers: [{ provide: PalmarService, useValue: mockPalmar }],
    });

    const fixture = TestBed.createComponent(PalmarPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function clickBoton(
    fixture: ComponentFixture<PalmarPage>,
    texto: string,
  ): HTMLButtonElement {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const btn = buttons.find((b) => b.textContent?.includes(texto));
    expect(btn).toBeTruthy();
    btn!.click();
    fixture.detectChanges();
    return btn!;
  }

  it('debería renderizar el botón "Registrar jornada palmar"', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(
      buttons.some((b) => b.textContent?.includes('Registrar jornada palmar')),
    ).toBe(true);
  });

  it('debería consumir PalmarService.cargarHistorial y renderizar las jornadas', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    expect(mockPalmar.cargarHistorial).toHaveBeenCalledTimes(1);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('05-06-2026.json');
    expect(text).toContain('04-06-2026.json');
    // Triangulación: ambos fixtures renderizan sus datos (usuario y null).
    expect(text).toContain('Admin');
  });

  it('debería mostrar el mensaje de vacío si no hay jornadas', async () => {
    const fixture = await crearPagina({ desktop: true, entries: [] });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No hay jornadas registradas todavía');
  });

  it('debería mostrar el error cuando cargarHistorial falla', async () => {
    const fixture = await crearPagina({ desktop: true, entries: [] });
    mockPalmar.cargarHistorial.mockRejectedValueOnce(new Error('IPC caído'));

    await fixture.componentInstance.cargarHistorial();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('IPC caído');
  });

  it('P-FR16: sin window.electronAPI debería mostrar el aviso de escritorio', async () => {
    const fixture = await crearPagina({ desktop: false, entries: fixtures });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(AVISO_DESKTOP);
  });

  it('no debería mostrar el aviso de escritorio cuando hay electronAPI', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain(AVISO_DESKTOP);
  });

  // ── Integración modal (PR8): token useExisting → PalmarService ────────────

  it('P-R8: el botón abre el modal y el token resuelve al PalmarService mockeado', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    clickBoton(fixture, 'Registrar jornada palmar');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[role="dialog"]'),
    ).toBeTruthy();
    // El modal consumió el MISMO PalmarService (useExisting) para su catálogo:
    expect(mockPalmar.listarProductos).toHaveBeenCalledTimes(1);
  });

  it('P-R8: saved cierra el modal y refresca el historial', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });
    clickBoton(fixture, 'Registrar jornada palmar');
    await fixture.whenStable();
    fixture.detectChanges();

    const modalDebug = fixture.debugElement.query(
      By.directive(PalmarJornadaModalComponent),
    );
    expect(modalDebug).toBeTruthy();
    modalDebug.componentInstance.saved.emit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.directive(PalmarJornadaModalComponent)),
    ).toBeFalsy();
    expect(mockPalmar.cargarHistorial).toHaveBeenCalledTimes(2);
  });

  it('P-R8: cerrar cierra el modal sin refrescar el historial', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });
    clickBoton(fixture, 'Registrar jornada palmar');
    await fixture.whenStable();
    fixture.detectChanges();

    const modalDebug = fixture.debugElement.query(
      By.directive(PalmarJornadaModalComponent),
    );
    expect(modalDebug).toBeTruthy();
    modalDebug.componentInstance.cerrar.emit();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.directive(PalmarJornadaModalComponent)),
    ).toBeFalsy();
    expect(mockPalmar.cargarHistorial).toHaveBeenCalledTimes(1);
  });

  // ── Ver detalle / reimprimir (PR8) ─────────────────────────────────────────

  it('P-R8: "Ver detalle" llama verDetalle con el fileName y muestra el registro', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    clickBoton(fixture, 'Ver detalle');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockPalmar.verDetalle).toHaveBeenCalledWith('05-06-2026.json');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2026-06-05');
    expect(text).toContain('Agua 500ml');
  });

  it('P-R8: "Reimprimir" llama volverAImprimir con el fileName', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    clickBoton(fixture, 'Reimprimir');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockPalmar.volverAImprimir).toHaveBeenCalledWith('05-06-2026.json');
  });
});
