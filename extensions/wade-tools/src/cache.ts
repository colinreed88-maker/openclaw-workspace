const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function cachedLoad<T>(key: string, loader: () => Promise<T>, ttlMs: number = DEFAULT_TTL): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  const data = await loader();
  setCached(key, data, ttlMs);
  return data;
}
