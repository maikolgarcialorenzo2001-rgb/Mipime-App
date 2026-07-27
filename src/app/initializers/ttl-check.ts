import { environment } from '../environments/environment';

export function ttlCheckInitializer(): () => Promise<boolean> {
  return () => {
    if (!environment.testMode) return Promise.resolve(true);

    try {
      const stored = localStorage.getItem('mipime_first_launch');
      if (!stored) {
        localStorage.setItem('mipime_first_launch', new Date().toISOString());
        return Promise.resolve(true);
      }

      const firstLaunch = new Date(stored).getTime();
      if (isNaN(firstLaunch)) {
        // Corrupted date — fail-safe: block
        localStorage.setItem('mipime_ttl_expired', 'true');
        return Promise.resolve(true);
      }

      const now = Date.now();
      const diffDays = (now - firstLaunch) / (1000 * 60 * 60 * 24);

      if (diffDays > (environment.ttlDays ?? 7)) {
        localStorage.setItem('mipime_ttl_expired', 'true');
      }
    } catch {
      // localStorage unavailable or corrupted — fail-safe: block
      localStorage.setItem('mipime_ttl_expired', 'true');
    }

    return Promise.resolve(true);
  };
}
