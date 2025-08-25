/**
 * Cache Manager implementation
 */
import { CacheManager } from '../core/interfaces';
import { Logger } from './logger';
export declare class InMemoryCacheManager<K, V> implements CacheManager<K, V> {
    private cache;
    private logger;
    private defaultTTL;
    private maxSize;
    private cleanupInterval;
    constructor(options?: {
        defaultTTL?: number;
        maxSize?: number;
        cleanupIntervalMs?: number;
        logger?: Logger;
    });
    get(key: K): Promise<V | null>;
    set(key: K, value: V, ttl?: number): Promise<void>;
    delete(key: K): Promise<void>;
    clear(): Promise<void>;
    has(key: K): Promise<boolean>;
    size(): number;
    keys(): K[];
    getStats(): Promise<{
        size: number;
        maxSize: number;
        hitRate: number;
        memoryUsage: number;
    }>;
    private evictLeastRecentlyUsed;
    private startCleanup;
    private cleanupExpired;
    destroy(): void;
}
export declare class CacheFactory {
    static createInMemoryCache<K, V>(options?: {
        defaultTTL?: number;
        maxSize?: number;
        cleanupIntervalMs?: number;
        logger?: Logger;
    }): InMemoryCacheManager<K, V>;
    static createFileCache<K extends string, V>(options: {
        cacheDir: string;
        defaultTTL?: number;
        logger?: Logger;
    }): FileCacheManager<K, V>;
}
export declare class FileCacheManager<K extends string, V> implements CacheManager<K, V> {
    private cacheDir;
    private defaultTTL;
    private logger;
    constructor(options: {
        cacheDir: string;
        defaultTTL?: number;
        logger?: Logger;
    });
    get(key: K): Promise<V | null>;
    set(key: K, value: V, ttl?: number): Promise<void>;
    delete(key: K): Promise<void>;
    clear(): Promise<void>;
    has(key: K): Promise<boolean>;
    private getFilePath;
    private fileExists;
}
//# sourceMappingURL=cache.d.ts.map