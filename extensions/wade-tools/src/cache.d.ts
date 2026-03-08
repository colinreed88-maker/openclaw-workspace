export declare function getCached<T>(key: string): T | undefined;
export declare function setCached<T>(key: string, data: T, ttlMs?: number): void;
export declare function cachedLoad<T>(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T>;
