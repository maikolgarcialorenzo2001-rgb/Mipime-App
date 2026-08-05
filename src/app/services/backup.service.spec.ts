import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { SQLOCAL_CLIENT } from './sqlocal-client';
import { exportName } from '../../../electron/export-name';

const createSqlocalClientMock = vi.fn();
const getDatabaseFileMock = vi.fn();

describe('BackupService', () => {
  let service: BackupService;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invokeMock = vi.fn().mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({ providers: [BackupService] });
    service = TestBed.inject(BackupService);
  });

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    vi.clearAllMocks();
  });

  function setNative(): void {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      invoke: invokeMock,
    } as unknown as ElectronAPI;
  }

  it('delega en db:backupNow con trigger open (nativo)', async () => {
    setNative();

    await service.backup('open');

    expect(invokeMock).toHaveBeenCalledWith('db:backupNow', { trigger: 'open' });
  });

  it('delega en db:backupNow con trigger jornada-close (nativo)', async () => {
    setNative();

    await service.backup('jornada-close');

    expect(invokeMock).toHaveBeenCalledWith('db:backupNow', {
      trigger: 'jornada-close',
    });
  });

  it('es no-op en web (sin electronAPI): nunca invoca (AD-6)', async () => {
    await service.backup('open');
    await service.backup('jornada-close');

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('resuelve sin lanzar si db:backupNow rechaza (R6: los fallos de backup no interrumpen)', async () => {
    setNative();
    invokeMock.mockRejectedValue(new Error('ipc broken'));

    await expect(service.backup('jornada-close')).resolves.toBeUndefined();
  });

  it('resuelve sin lanzar si db:backupNow devuelve {ok:false} (R6)', async () => {
    setNative();
    invokeMock.mockResolvedValue({ ok: false, error: 'disk full' });

    await expect(service.backup('jornada-close')).resolves.toBeUndefined();
  });
});

describe('BackupService exportarRespaldo (T12)', () => {
  let service: BackupService;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invokeMock = vi.fn().mockResolvedValue({ ok: true });
    getDatabaseFileMock.mockReset();
    createSqlocalClientMock.mockReset();
    TestBed.configureTestingModule({
      providers: [
        BackupService,
        { provide: SQLOCAL_CLIENT, useValue: createSqlocalClientMock },
      ],
    });
    service = TestBed.inject(BackupService);
  });

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    vi.clearAllMocks();
  });

  function setNative(): void {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      invoke: invokeMock,
    } as unknown as ElectronAPI;
  }

  it('T12 RED: delega en db:export y devuelve la ruta elegida (nativo)', async () => {
    setNative();
    invokeMock.mockResolvedValue({
      ok: true,
      path: 'C:\\Users\\Test\\Documents\\Tienda - App\\DataBase\\tienda_export_20260731_1500.db',
    });

    const result = await service.exportarRespaldo();

    expect(invokeMock).toHaveBeenCalledWith('db:export');
    expect(result.ok).toBe(true);
  });

  it('T12 RED: devuelve {ok:false, canceled:true} si el diálogo se cancela', async () => {
    setNative();
    invokeMock.mockResolvedValue({ ok: false, canceled: true });

    const result = await service.exportarRespaldo();

    expect(result).toEqual({ ok: false, canceled: true });
  });

  it('T12 RED: web descarga el archivo vía getDatabaseFile() (AD-6 confirmado)', async () => {
    const fakeFile = new File(['sqlite-bytes'], 'tienda.db');
    getDatabaseFileMock.mockResolvedValue(fakeFile);
    createSqlocalClientMock.mockResolvedValue({
      getDatabaseFile: getDatabaseFileMock,
    });

    const createObjectUrlMock = vi.fn(() => 'blob:mock-export');
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlMock,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlMock,
      configurable: true,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {
        return undefined;
      });

    vi.useFakeTimers();

    const result = await service.exportarRespaldo();

    expect(createSqlocalClientMock).toHaveBeenCalled();
    expect(getDatabaseFileMock).toHaveBeenCalled();
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    // BACKLOG-5: el revoke NO es síncrono al click — el download arranca primero.
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);

    vi.advanceTimersByTime(0);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    clickSpy.mockRestore();
  });

  it('T12 RED: web resuelve {ok:false, error} si getDatabaseFile rechaza (R6)', async () => {
    createSqlocalClientMock.mockResolvedValue({
      getDatabaseFile: vi
        .fn()
        .mockRejectedValue(new Error('opfs unavailable')),
    });

    const result = await service.exportarRespaldo();

    expect(result.ok).toBe(false);
  });
});

describe('exportName shared helper (BACKLOG-6: single source con el desktop)', () => {
  it('web y desktop derivan el MISMO nombre (byte-identical)', () => {
    expect(exportName(new Date(2026, 7, 2, 14, 5))).toBe(
      'tienda_export_20260802_1405.db',
    );
  });

  it('zero-pad de dígitos simples (mes/día/hora/minuto)', () => {
    expect(exportName(new Date(2026, 0, 5, 9, 3))).toBe(
      'tienda_export_20260105_0903.db',
    );
  });
});
