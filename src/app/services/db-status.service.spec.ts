import { TestBed } from '@angular/core/testing';
import { DbStatusService } from './db-status.service';

describe('DbStatusService', () => {
  let service: DbStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbStatusService] });
    service = TestBed.inject(DbStatusService);
  });

  it('debería inicializar fatal y restoreInfo en null', () => {
    expect(service.fatal()).toBeNull();
    expect(service.restoreInfo()).toBeNull();
  });

  it('setFatal debería actualizar el signal fatal', () => {
    const diagnostics: DbDiagnostics = {
      appVersion: '0.1.8-beta',
      platform: 'win32',
      stage: 'open',
      backupsTried: [],
    };

    service.setFatal(diagnostics);

    expect(service.fatal()).toEqual(diagnostics);

    service.setFatal(null);
    expect(service.fatal()).toBeNull();
  });

  it('setRestoreInfo debería actualizar el signal restoreInfo', () => {
    const info: DbRestoreInfo = { from: 'rodante', lostWindowMs: 100 };

    service.setRestoreInfo(info);

    expect(service.restoreInfo()).toEqual(info);

    service.setRestoreInfo(null);
    expect(service.restoreInfo()).toBeNull();
  });
});
