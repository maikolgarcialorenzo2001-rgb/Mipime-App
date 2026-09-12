import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
  readonly icon = input('inbox');
  readonly accion = input<string | null>(null);
  readonly accionClick = output<void>();
}