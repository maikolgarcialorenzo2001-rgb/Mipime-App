import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';

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
