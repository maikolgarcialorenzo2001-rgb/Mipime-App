import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ElectronFileService } from '../../services/electron-file.service';
import { JornadaService } from '../../services/jornada.service';
import { ThemeService } from '../../services/theme.service';
import { ArqueoBilletesFormComponent } from '../arqueo-billetes-form/arqueo-billetes-form.component';
import type { ArqueoCajaEntry } from '../../models/arqueo-caja';
import { APP_VERSION } from '../../version';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, ArqueoBilletesFormComponent],
  templateUrl: './app-nav.component.html',
  styleUrl: './app-nav.component.css',
})
export class AppNavComponent {
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthService);
  readonly jornadaService = inject(JornadaService);
  private readonly _electronFileService = inject(ElectronFileService);
  readonly themeService = inject(ThemeService);

  protected readonly auth = this._auth;

  /** Versión de la app (generada desde package.json en build). */
  readonly appVersion = APP_VERSION;

  readonly soloNumeros = signal(false);

  /** Modal de apertura */
  readonly showOpenModal = signal(false);
  readonly montoInicial = signal(500);
  readonly abriendo = signal(false);
  readonly abrirError = signal<string | null>(null);

  /** Modal de cierre */
  readonly showCloseModal = signal(false);
  readonly cerrando = signal(false);
  readonly cerrarError = signal<string | null>(null);

  /** Autofocus refs */
  readonly openModalBackdrop = viewChild<ElementRef<HTMLElement>>('openModalBackdrop');
  readonly closeModalBackdrop = viewChild<ElementRef<HTMLElement>>('closeModalBackdrop');

  private readonly _focusOpenEffect = effect(() => {
    if (this.showOpenModal()) {
      setTimeout(() => this.openModalBackdrop()?.nativeElement.focus());
    }
  });

  private readonly _focusCloseEffect = effect(() => {
    if (this.showCloseModal()) {
      setTimeout(() => this.closeModalBackdrop()?.nativeElement.focus());
    }
  });

  /** Entries de arqueo emitidos por <app-arqueo-billetes-form> (solo cantidad > 0). */
  readonly arqueoEntries = signal<ArqueoCajaEntry[]>([]);

  readonly arqueoTotal = computed(() =>
    this.arqueoEntries().reduce((sum, entry) => sum + entry.subtotal, 0),
  );

  readonly diferencia = computed(() => {
    return this.jornadaService.totalEnCaja() - this.arqueoTotal();
  });

  get puedeAbrir(): boolean {
    return !this.jornadaService.jornadaCargando() && this.jornadaService.jornadaAbierta() === null;
  }

  get puedeCerrar(): boolean {
    const j = this.jornadaService.jornadaAbierta();
    return (
      !this.jornadaService.jornadaCargando() &&
      j !== null &&
      j.estado === 'abierta'
    );
  }

  // ── Apertura ──────────────────────────────────────────

  abrirModalApertura(): void {
    this.abrirError.set(null);
    this.showOpenModal.set(true);
  }

  cerrarModalApertura(): void {
    this.showOpenModal.set(false);
    this.abrirError.set(null);
  }

  onMontoInicialChange(value: string): void {
    const num = value === '' ? 0 : Number(value);
    this.montoInicial.set(Number.isNaN(num) ? 0 : num);
  }

  confirmarApertura(): void {
    const monto = this.montoInicial();

    this.abriendo.set(true);
    this.abrirError.set(null);

    const uid = this.auth.usuario()?.id;
    this.jornadaService.abrir(monto, uid).subscribe({
      next: () => {
        this.showOpenModal.set(false);
        this.abriendo.set(false);
      },
      error: (err: unknown) => {
        this.abrirError.set(
          err instanceof Error ? err.message : 'Error al abrir la jornada',
        );
        this.abriendo.set(false);
      },
    });
  }

  // ── Cierre ────────────────────────────────────────────

  abrirModalCierre(): void {
    this.cerrarError.set(null);
    this.arqueoEntries.set([]);
    this.showCloseModal.set(true);
  }

  cerrarModalCierre(): void {
    this.showCloseModal.set(false);
    this.cerrarError.set(null);
  }

  confirmarCierre(): void {
    const j = this.jornadaService.jornadaAbierta();
    const uid = this.auth.usuario()?.id;

    if (!j || uid === undefined) return;

    const entries = this.arqueoEntries();

    if (entries.length === 0) {
      this.cerrarError.set('Ingresa la cantidad de al menos una denominación');
      return;
    }

    this.cerrando.set(true);
    this.cerrarError.set(null);

    this.jornadaService.cerrar(j.id, uid, entries).subscribe({
      next: () => {
        this.showCloseModal.set(false);
        this.cerrando.set(false);

        // Descargar el reporte generado
        this._descargarExcel(j.id, j);
      },
      error: (err: unknown) => {
        this.cerrarError.set(
          err instanceof Error ? err.message : 'Error al cerrar la jornada',
        );
        this.cerrando.set(false);
      },
    });
  }

  // ── Backdrop ──────────────────────────────────────────

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      if (this.showOpenModal()) this.cerrarModalApertura();
      if (this.showCloseModal()) this.cerrarModalCierre();
    }
  }

  filtrarTecla(event: KeyboardEvent): void {
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
      'Enter', 'Escape',
    ];
    if (teclasPermitidas.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      this.soloNumeros.set(true);
      setTimeout(() => this.soloNumeros.set(false), 1800);
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showOpenModal()) this.cerrarModalApertura();
      if (this.showCloseModal()) this.cerrarModalCierre();
    }
  }

  // ── Internos ──────────────────────────────────────────

  private _descargarExcel(jornadaId: number, _jornada: { fecha: string; id: number }): void {
    this.jornadaService.obtenerReporte(jornadaId).subscribe({
      next: (reporte) => {
        if (!reporte) return;
        // Solo Blob download: ElectronFileService ya guardó en JornadaService
        this._electronFileService.downloadBlob(reporte.content_base64, reporte.filename);
      },
    });
  }

  logout(): void {
    this._auth.logout();
    this._router.navigateByUrl('/login');
  }
}
