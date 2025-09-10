/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Provides complete context to Claude without file reads
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
export interface RedisFileCache {
    content: string;
    hash: string;
    lastModified: number;
    size: number;
    language: string;
    exports: string[];
    imports: string[];
    classes: string[];
    functions: string[];
}
export declare class SemanticEnhancementEngine {
    private logger;
    private redisClient;
    private pgPool;
    private neo4jDriver;
    constructor();
    /**
     * Main enhancement workflow:
     * 1. Execute semantic search based on user query
     * 2. Get reasonable subset of most relevant files
     * 3. Traverse Neo4j to find all related files
     * 4. Provide complete context with cached content
     * 5. Update cache after Claude's response
     */
    enhanceQuery(query: string, maxPrimaryFiles?: number, maxRelatedFiles?: number, maxContextSize?: number): Promise<EnhancementContext>;
    /**
     * Execute semantic search using pgvector embeddings
     */
    private executeSemanticSearch;
    /**
     * Find all files related through Neo4j graph relationships
     */
    private findAllRelatedFiles;
    /**
     * Validate cache freshness using file hash comparison
     */
    private validateAndUpdateCache;
    /**
     * Build optimal context within size constraints
     */
    private buildOptimalContext;
    /**
     * Update context after Claude's processing
     */
    updateContextAfterProcessing(modifiedFiles: string[], context: EnhancementContext): Promise<void>;
    private initializeConnections;
    private generateQueryEmbedding;
    private getFromRedisCache;
    private updateRedisCache;
    private calculateFileHash;
    private updateSemanticEmbedding;
    private determineMatchReason;
    private detectLanguage;
    private extractExports;
    private extractImports;
    private extractClasses;
    private extractFunctions;
    private refreshFileContent;
    private refreshRelatedFileContent;
}
export default SemanticEnhancementEngine;
//# sourceMappingURL=semantic-enhancement-engine.d.ts.map