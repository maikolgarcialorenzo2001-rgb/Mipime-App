import { Injectable, signal } from '@angular/core';

/**
 * Estado de salud de la DB nativa para la UI (T5). Los signals nacen en
 * null: solo se pueblan cuando el arranque reporta fatal (T4) o una
 * restauración/adopción (T9/T10).
 */
@Injectable({ providedIn: 'root' })
export class DbStatusService {
  readonly fatal = signal<DbDiagnostics | null>(null);
  readonly restoreInfo = signal<DbRestoreInfo | null>(null);

  setFatal(diagnostics: DbDiagnostics | null): void {
    this.fatal.set(diagnostics);
  }

  setRestoreInfo(info: DbRestoreInfo | null): void {
    this.restoreInfo.set(info);
  }
}
