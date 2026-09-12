import { Injectable, computed, signal, type WritableSignal } from '@angular/core';

export const FONT_SCALE_LEVELS = ['small', 'normal', 'large', 'xlarge', 'xxlarge'] as const;

export type FontScaleLevel = (typeof FONT_SCALE_LEVELS)[number];

export const FONT_SCALE_LEVEL_LABELS: Record<FontScaleLevel, string> = {
  small: 'Pequeña',
  normal: 'Normal',
  large: 'Grande',
  xlarge: 'Muy grande',
  xxlarge: 'Extra grande',
};

const STORAGE_KEY = 'fontScale';

const LEVEL_PERCENT: Record<FontScaleLevel, number> = {
  small: 87.5,
  normal: 100,
  large: 112.5,
  xlarge: 125,
  xxlarge: 135,
};

function isFontScaleLevel(value: string | null): value is FontScaleLevel {
  return value !== null && (FONT_SCALE_LEVELS as readonly string[]).includes(value);
}

function markerClass(level: FontScaleLevel): string | null {
  return level === 'normal' ? null : `font-scale-${level}`;
}

function clearMarkers(): void {
  document.documentElement.classList.remove(
    ...[...document.documentElement.classList].filter((c) => c.startsWith('font-scale-')),
  );
}

@Injectable({
  providedIn: 'root',
})
export class FontScaleService {
  readonly level: WritableSignal<FontScaleLevel>;

  readonly percentage = computed(() => LEVEL_PERCENT[this.level()]);

  readonly label = computed(() => FONT_SCALE_LEVEL_LABELS[this.level()]);

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const level: FontScaleLevel = isFontScaleLevel(stored) ? stored : 'normal';
    this.level = signal(level);
    this._applyMarker(level);
  }

  setLevel(level: FontScaleLevel): void {
    this.level.set(level);
    localStorage.setItem(STORAGE_KEY, level);
    this._applyMarker(level);
  }

  private _applyMarker(level: FontScaleLevel): void {
    clearMarkers();
    const cls = markerClass(level);
    if (cls) {
      document.documentElement.classList.add(cls);
    }
  }
}
