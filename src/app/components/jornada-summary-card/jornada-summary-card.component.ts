import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EstadoBadgeComponent } from '../estado-badge/estado-badge.component';
import { PesosPipe } from '../../pipes/pesos.pipe';
import type { Jornada } from '../../models';

@Component({
  selector: 'app-jornada-summary-card',
  imports: [DatePipe, EstadoBadgeComponent, PesosPipe],
  templateUrl: './jornada-summary-card.component.html',
  styleUrl: './jornada-summary-card.component.css',
})
export class JornadaSummaryCardComponent {
  readonly jornada = input.required<Jornada>();
  readonly totalGastos = input<number>();
  readonly totalEnCaja = input<number>();
  readonly isAdmin = input(false);
}
