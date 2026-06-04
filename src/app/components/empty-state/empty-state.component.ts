import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
}
