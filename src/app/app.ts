import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppNavComponent } from './components/layout/app-nav.component';
import { AuthService } from './services/auth.service';
import { JornadaService } from './services/jornada.service';

const PENDING_CLOSE_KEY = 'mipime_pending_close';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthService);
  private readonly _jornadaService = inject(JornadaService);

  ngOnInit(): void {
    this._processPendingClose();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    const jornada = this._jornadaService.jornadaAbierta();
    const userId = this._auth.usuario()?.id;
    if (jornada && userId !== undefined) {
      try {
        const payload = JSON.stringify({
          jornadaId: jornada.id,
          userId,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem(PENDING_CLOSE_KEY, payload);
      } catch {
        // localStorage puede fallar
      }
    }
  }

  private _processPendingClose(): void {
    try {
      const raw = localStorage.getItem(PENDING_CLOSE_KEY);
      if (!raw) return;

      let parsed: { jornadaId: number; userId: number; timestamp: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        localStorage.removeItem(PENDING_CLOSE_KEY);
        return;
      }

      // Ignorar pending_close > 24h
      const age = Date.now() - new Date(parsed.timestamp).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(PENDING_CLOSE_KEY);
        return;
      }

      // Verificar si la jornada sigue abierta
      this._jornadaService.obtenerAbierta().subscribe({
        next: (jornada) => {
          if (!jornada || jornada.estado !== 'abierta') {
            // Ya fue cerrada externamente
            localStorage.removeItem(PENDING_CLOSE_KEY);
            return;
          }

          // Cerrar la jornada sin verificar admin
          this._jornadaService.cerrarSinAuth(parsed.jornadaId, parsed.userId).subscribe({
            next: () => {
              // Descargar el Excel generado
              this._jornadaService.obtenerReporte(parsed.jornadaId).subscribe({
                next: (reporte) => {
                  if (reporte) {
                    this._descargarExcel(reporte.content_base64, reporte.filename);
                  }
                  localStorage.removeItem(PENDING_CLOSE_KEY);
                  this._auth.logout();
                  this._router.navigateByUrl('/login');
                },
              });
            },
            error: () => {
              // Si falla, limpiar igual para no bloquear
              localStorage.removeItem(PENDING_CLOSE_KEY);
            },
          });
        },
        error: () => {
          localStorage.removeItem(PENDING_CLOSE_KEY);
        },
      });
    } catch {
      localStorage.removeItem(PENDING_CLOSE_KEY);
    }
  }

  private _descargarExcel(base64: string, filename: string): void {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallo silencioso al descargar
    }
  }
}
