/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Now a thin wrapper around the unified SemanticSearchManager
 */
export interface SemanticSearchResult {
    filePath: string;
    relevanceScore: number;
    content: string;
    lastModified: number;
    hash: string;
    matchReason: string;
}
export interface RelatedFileContext {
    filePath: string;
    relationshipType: string;
    content: string;
    hash: string;
    distance: number;
}
export interface EnhancementContext {
    query: string;
    primaryFiles: SemanticSearchResult[];
    relatedFiles: RelatedFileContext[];
    totalFiles: number;
    contextSize: number;
    cacheHitRate: number;
    generatedAt: number;
}
/**
 * Legacy wrapper for SemanticSearchManager
 * Maintains backward compatibility while delegating to unified manager
 */
export declare class SemanticEnhancementEngine {
    private logger;
    private semanticSearchManager;
    constructor();
    /**
     * Main enhancement workflow using unified semantic search manager
     */
    enhanceQuery(query: string, maxPrimaryFiles?: number, maxRelatedFiles?: number, maxContextSize?: number, projectId?: string): Promise<EnhancementContext>;
    /**
     * Update context after Claude's processing
     */
    updateContextAfterProcessing(modifiedFiles: string[], context: EnhancementContext, projectId?: string): Promise<void>;
    /**
     * Initialize semantic search for a project
     */
    initializeProjectSemanticSearch(projectId: string, files: string[], progressCallback?: (progress: number, current: string, detail: string) => void): Promise<{
        success: number;
        errors: number;
        chunks: number;
        skipped: number;
    }>;
    /**
     * Get semantic search statistics
     */
    getSemanticSearchStats(projectId?: string): Promise<{
        totalChunks: number;
        totalFiles: number;
        avgChunksPerFile: number;
        storageSize: string;
    }>;
    /**
     * Convert search response to legacy format for compatibility
     */
    private convertToLegacyFormat;
}
export default SemanticEnhancementEngine;
//# sourceMappingURL=semantic-enhancement-engine.d.ts.map