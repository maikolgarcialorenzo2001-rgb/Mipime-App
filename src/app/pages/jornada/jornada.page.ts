import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { JornadaService } from '../../services/jornada.service';
import type { Jornada } from '../../models';

@Component({
  selector: 'app-jornada-page',
  imports: [DatePipe],
  templateUrl: './jornada.page.html',
  styleUrl: './jornada.page.css',
})
export class JornadaPage implements OnInit {
  private readonly _jornadaService = inject(JornadaService);

  jornada?: Jornada;
  error?: string;

  ngOnInit(): void {
    this._jornadaService.obtenerAbierta().subscribe({
      next: (jornada) => {
        this.jornada = jornada ?? undefined;
      },
      error: (err: unknown) => {
        this.error = err instanceof Error ? err.message : 'Error al cargar la jornada';
      },
    });
  }
}
