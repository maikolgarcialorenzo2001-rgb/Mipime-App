import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stock-badge',
  templateUrl: './stock-badge.component.html',
  styleUrl: './stock-badge.component.css',
})
export class StockBadgeComponent {
  @Input({ required: true }) stock!: number;
}
