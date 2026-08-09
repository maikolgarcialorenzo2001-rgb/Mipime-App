import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PalmarPage } from './palmar.page';
import { ElectronFileService } from '../../services/electron-file.service';
import type { PalmarHistoryEntry } from '../../models';

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

const AVISO_DESKTOP = 'Historial disponible solo en la app de escritorio';

describe('PalmarPage', () => {
  let mockFileSvc: { listPalmar: ReturnType<typeof vi.fn> };

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  /**
   * Crea la página con un ElectronFileService MOCKEADO (contrato PR4,
   * plan §Contratos — nunca el cuerpo real) y el gate D5 según `desktop`.
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
    mockFileSvc = { listPalmar: vi.fn().mockResolvedValue(opts.entries) };

    TestBed.configureTestingModule({
      imports: [PalmarPage],
      providers: [{ provide: ElectronFileService, useValue: mockFileSvc }],
    });

    const fixture = TestBed.createComponent(PalmarPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
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

  it('debería consumir el contrato ElectronFileService.listPalmar y renderizar las jornadas', async () => {
    const fixture = await crearPagina({ desktop: true, entries: fixtures });

    expect(mockFileSvc.listPalmar).toHaveBeenCalledTimes(1);

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
});
