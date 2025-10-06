/**
 * Offline-First Smart Cache
 * Allows CodeMind workflow to proceed even when databases are unavailable
 * Falls back gracefully from Redis → File Cache → Memory Cache → Continue without cache
 */
export interface CachedContent {
    content: string;
    hash: string;
    lastModified: number;
    language: string;
    exports: string[];
    imports: string[];
    functions: string[];
    classes: string[];
}
export interface CacheStats {
    redisAvailable: boolean;
    filesCached: number;
    memoryHits: number;
    fileHits: number;
    redisHits: number;
    misses: number;
}
export declare class OfflineFirstCache {
    private logger;
    private memoryCache;
    private cacheDir;
    private redisClient;
    private stats;
    constructor(projectPath?: string);
    /**
     * Initialize cache with non-blocking Redis connection
     */
    initialize(): Promise<void>;
    /**
     * Get cached file content with multi-level fallback
     */
    getCachedFile(filePath: string): Promise<CachedContent | null>;
    /**
     * Set content in all available cache levels
     */
    setCachedFile(filePath: string, content: CachedContent): Promise<void>;
    /**
     * Clear all caches for a specific file
     */
    invalidateFile(filePath: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Preload commonly accessed files into cache
     */
    preloadCommonFiles(filePaths: string[]): Promise<void>;
    private tryRedisConnection;
    private attemptRedisConnection;
    private getCacheKey;
    private getFromFileCache;
    private setInFileCache;
    private setInAllCaches;
    private generateFreshContent;
    private detectLanguage;
    private extractExports;
    private extractImports;
    private extractFunctions;
    private extractClasses;
}
export default OfflineFirstCache;
//# sourceMappingURL=OfflineFirstCache.d.ts.map