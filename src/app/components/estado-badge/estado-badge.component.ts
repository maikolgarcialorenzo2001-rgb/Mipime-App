import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-estado-badge',
  imports: [NgClass],
  templateUrl: './estado-badge.component.html',
  styleUrl: './estado-badge.component.css',
})
export class EstadoBadgeComponent {
  readonly estado = input.required<'abierta' | 'cerrada'>();
}
