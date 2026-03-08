const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
const store = new Map();
export function getCached(key) {
    const entry = store.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.data;
}
export function setCached(key, data, ttlMs = DEFAULT_TTL) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
}
export async function cachedLoad(key, loader, ttlMs = DEFAULT_TTL) {
    const cached = getCached(key);
    if (cached !== undefined)
        return cached;
    const data = await loader();
    setCached(key, data, ttlMs);
    return data;
}
//# sourceMappingURL=cache.js.map