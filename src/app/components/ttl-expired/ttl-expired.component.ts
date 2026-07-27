import { Component, computed, signal } from '@angular/core';

@Component({
  selector: 'app-ttl-expired',
  templateUrl: './ttl-expired.component.html',
  styleUrl: './ttl-expired.component.css',
})
export class TtlExpiredComponent {
  private readonly firstLaunch = signal<string | null>(null);

  readonly expiryDate = computed(() => {
    const raw = this.firstLaunch();
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-AR');
  });

  constructor() {
    this.firstLaunch.set(localStorage.getItem('mipime_first_launch'));
  }
}
