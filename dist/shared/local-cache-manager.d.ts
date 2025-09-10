/**
 * Local Cache Manager for CodeMind
 * Manages .codemind folder contents to minimize database queries
 */
export interface LocalCacheData {
    project: {
        id: string;
        name: string;
        path: string;
        type: string;
        languages: string[];
        frameworks: string[];
        lastUpdated: string;
    };
    context: {
        projectType: string;
        languages: string[];
        frameworks: string[];
        dependencies: Record<string, string>;
        architecture: string;
        patterns: string[];
        insights: any[];
        lastFetched: string;
        ttl: number;
    };
    toolConfigs: {
        [toolName: string]: {
            config: any;
            enabled: boolean;
            lastModified: string;
        };
    };
    recentAnalyses: Array<{
        id: string;
        type: string;
        timestamp: string;
        summary: string;
        results: any;
    }>;
    session: {
        lastSessionId: string;
        lastAccessTime: string;
        totalSessions: number;
        preferences: {
            colorOutput: boolean;
            verboseMode: boolean;
            autoSuggest: boolean;
            tokenBudget: number;
        };
    };
    metadata: {
        version: string;
        createdAt: string;
        lastUpdated: string;
        cacheHits: number;
        cacheMisses: number;
    };
}
export declare class LocalCacheManager {
    private logger;
    private projectPath;
    private cachePath;
    private codemindDir;
    private cache;
    constructor(projectPath: string);
    /**
     * Initialize the .codemind directory and cache
     */
    initialize(): Promise<void>;
    /**
     * Load cache from local file
     */
    private loadCache;
    /**
     * Create empty cache structure
     */
    private createEmptyCache;
    /**
     * Save cache to local file
     */
    saveCache(): Promise<void>;
    /**
     * Update cache metadata
     */
    private updateMetadata;
    /**
     * Set project information
     */
    setProject(projectData: Partial<LocalCacheData['project']>): void;
    /**
     * Get project information
     */
    getProject(): LocalCacheData['project'] | null;
    /**
     * Set project context with TTL check
     */
    setContext(contextData: Partial<LocalCacheData['context']>, ttlMinutes?: number): void;
    /**
     * Get project context if not expired
     */
    getContext(): LocalCacheData['context'] | null;
    /**
     * Set tool configuration
     */
    setToolConfig(toolName: string, config: any, enabled?: boolean): void;
    /**
     * Get tool configuration
     */
    getToolConfig(toolName: string): any | null;
    /**
     * Get all tool configurations
     */
    getAllToolConfigs(): Record<string, any>;
    /**
     * Add recent analysis result
     */
    addRecentAnalysis(analysis: LocalCacheData['recentAnalyses'][0]): void;
    /**
     * Get recent analyses
     */
    getRecentAnalyses(limit?: number): LocalCacheData['recentAnalyses'];
    /**
     * Update session information
     */
    updateSession(sessionId: string, preferences?: Partial<LocalCacheData['session']['preferences']>): void;
    /**
     * Get session information
     */
    getSession(): LocalCacheData['session'] | null;
    /**
     * Generate or update codemind.md file
     */
    generateCodeMindMd(): Promise<void>;
    /**
     * Clear expired cache entries
     */
    clearExpiredCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        hits: number;
        misses: number;
        hitRatio: number;
    };
}
//# sourceMappingURL=local-cache-manager.d.ts.map