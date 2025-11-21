/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations
 * Uses semantic search service and enhances results with file analysis
 */
export interface SemanticResult {
    file: string;
    type: string;
    similarity: number;
    content: string;
    lineStart?: number;
    lineEnd?: number;
}
export declare class SemanticSearchOrchestrator {
    private static fileCache;
    private static contentCache;
    private static readonly CACHE_TTL;
    private static cacheTimestamp;
    private static readonly RELEVANCE_PATTERNS;
    private static readonly FILE_EXTENSIONS;
    private static readonly EXCLUDED_DIRS;
    /**
     * Perform semantic search and enhance with file analysis
     */
    performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]>;
    /**
     * Cached file discovery with TTL
     */
    private discoverFilesCached;
    /**
     * Cached file preview with memory management
     */
    private getFilePreviewCached;
    /**
     * Optimized file relevance calculation using pre-compiled patterns
     */
    private calculateFileRelevanceOptimized;
    /**
     * Calculate file relevance to the query
     */
    private calculateFileRelevance;
    /**
     * Determine file type based on path and content
     */
    private determineFileType;
    /**
     * Get a preview of file content
     */
    private getFilePreview;
    /**
     * Discover relevant files in the project
     */
    private discoverFiles;
    /**
     * Analyze actual file content for class searches
     */
    private analyzeFileContent;
    /**
     * Get fallback results when no high-relevance files found
     */
    private getFallbackResults;
}
//# sourceMappingURL=semantic-search-orchestrator.d.ts.map