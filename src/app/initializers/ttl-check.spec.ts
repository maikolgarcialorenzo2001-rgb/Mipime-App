import { describe, it, expect, beforeEach } from 'vitest';
import { ttlCheckInitializer, type TtlEnvironment } from './ttl-check';

// El unit-test builder prohíbe vi.mock con imports relativos; el initializer
// acepta la config por parámetro, así que pasamos un objeto controlado.
const mockEnvironment: TtlEnvironment = {
  testMode: true,
  ttlDays: 7,
};

describe('ttlCheckInitializer', () => {
  beforeEach(() => {
    localStorage.clear();
    mockEnvironment.testMode = true;
    mockEnvironment.ttlDays = 7;
  });

  it('first launch in test mode stores timestamp and returns true', async () => {
    const init = ttlCheckInitializer(mockEnvironment);
    const result = await init();

    expect(result).toBe(true);
    expect(localStorage.getItem('mipime_first_launch')).not.toBeNull();
    expect(localStorage.getItem('mipime_ttl_expired')).toBeNull();
  });

  it('launch within TTL returns true without setting expired', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('mipime_first_launch', threeDaysAgo);

    const init = ttlCheckInitializer(mockEnvironment);
    const result = await init();

    expect(result).toBe(true);
    expect(localStorage.getItem('mipime_ttl_expired')).toBeNull();
  });

  it('launch after TTL sets mipime_ttl_expired and returns true', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('mipime_first_launch', eightDaysAgo);

    const init = ttlCheckInitializer(mockEnvironment);
    const result = await init();

    expect(result).toBe(true);
    expect(localStorage.getItem('mipime_ttl_expired')).toBe('true');
  });

  it('corrupted stored date sets mipime_ttl_expired and returns true', async () => {
    localStorage.setItem('mipime_first_launch', 'not-a-valid-date');

    const init = ttlCheckInitializer(mockEnvironment);
    const result = await init();

    expect(result).toBe(true);
    expect(localStorage.getItem('mipime_ttl_expired')).toBe('true');
  });

  it('non-test mode returns true without touching localStorage', async () => {
    mockEnvironment.testMode = false;

    const init = ttlCheckInitializer(mockEnvironment);
    const result = await init();

    expect(result).toBe(true);
    expect(localStorage.getItem('mipime_first_launch')).toBeNull();
    expect(localStorage.getItem('mipime_ttl_expired')).toBeNull();
  });
});
