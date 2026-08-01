import { environment } from '../environments/environment';

/** Slice de environment que el initializer necesita (testeable sin DI). */
export interface TtlEnvironment {
  testMode: boolean;
  ttlDays?: number;
}

/**
 * Factory del initializer TTL. Acepta la config por parámetro (con default al
 * environment real) para que los tests puedan pasar un objeto controlado sin
 * mockear el módulo de environment (prohibido por el unit-test builder).
 */
export function ttlCheckInitializer(
  env: TtlEnvironment = environment,
): () => Promise<boolean> {
  return () => {
    if (!env.testMode) return Promise.resolve(true);

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

      if (diffDays > (env.ttlDays ?? 7)) {
        localStorage.setItem('mipime_ttl_expired', 'true');
      }
    } catch {
      // localStorage unavailable or corrupted — fail-safe: block
      localStorage.setItem('mipime_ttl_expired', 'true');
    }

    return Promise.resolve(true);
  };
}
