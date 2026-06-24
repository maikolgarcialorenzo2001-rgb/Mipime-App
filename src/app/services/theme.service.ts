import { Injectable, signal, type WritableSignal } from '@angular/core';

const STORAGE_KEY = 'theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly isDark: WritableSignal<boolean>;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dark = stored === 'dark';
    this.isDark = signal(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    }
  }

  toggle(): void {
    this.isDark.update((current) => !current);
    const newValue = this.isDark() ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, newValue);
    document.documentElement.classList.toggle('dark', this.isDark());
  }
}
