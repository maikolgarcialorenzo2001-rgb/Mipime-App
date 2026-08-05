import { describe, it, expect } from 'vitest';
import { exportName } from './export-name';

describe('exportName', () => {
  it('formats tienda_export_YYYYMMDD_HHmm.db with zero-padding', () => {
    expect(exportName(new Date(2026, 7, 2, 14, 5))).toBe(
      'tienda_export_20260802_1405.db',
    );
  });

  it('zero-pads single-digit month/day/hour/minute', () => {
    expect(exportName(new Date(2026, 0, 5, 9, 3))).toBe(
      'tienda_export_20260105_0903.db',
    );
  });
});
