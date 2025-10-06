/**
 * Unified Semantic Search Manager
 * Consolidates all semantic search functionality across init, update, and retrieval cycles
 * Ensures consistent embedding generation, chunking, and storage
 */
export interface SemanticChunk {
    id: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    chunkIndex: number;
    isFullFile: boolean;
    hash: string;
    metadata: {
        language: string;
        size: number;
        functions: string[];
        classes: string[];
        imports: string[];
        exports: string[];
        significance: 'high' | 'medium' | 'low';
    };
}
export interface SemanticSearchResult {
    chunk: SemanticChunk;
    relevanceScore: number;
    matchReason: string;
    embedding?: number[];
}
export interface SearchQuery {
    text: string;
    projectId?: string;
    maxResults?: number;
    minSimilarity?: number;
    fileTypes?: string[];
    includeChunks?: boolean;
}
export interface SearchResponse {
    query: string;
    results: SemanticSearchResult[];
    totalFound: number;
    searchTime: number;
    usedFallback: boolean;
    metadata: {
        databaseResults: number;
        fallbackResults: number;
        chunkResults: number;
        fullFileResults: number;
    };
}
export interface EnhancementContext {
    query: string;
    primaryFiles: Array<{
        filePath: string;
        relevanceScore: number;
        content: string;
        lastModified: number;
        hash: string;
        matchReason: string;
    }>;
    relatedFiles: Array<{
        filePath: string;
        relationshipType: string;
        content: string;
        hash: string;
        distance: number;
    }>;
    totalFiles: number;
    contextSize: number;
    cacheHitRate: number;
    generatedAt: number;
}
/**
 * Unified Semantic Search Manager
 * Single point of truth for all semantic search operations
 */
export declare class SemanticSearchManager {
    private logger;
    private dbConnections;
    private embeddingService;
    private initialized;
    private readonly CHUNK_SIZE;
    private readonly OVERLAP_SIZE;
    private readonly MIN_CHUNK_SIZE;
    private readonly EMBEDDING_DIMENSIONS;
    constructor();
    /**
     * Initialize semantic search for a project during /init
     */
    initializeProject(projectId: string, files: string[], progressCallback?: (progress: number, current: string, detail: string) => void): Promise<{
        success: number;
        errors: number;
        chunks: number;
        skipped: number;
    }>;
    /**
     * Update semantic search for modified files during cycle updates
     */
    updateFiles(projectId: string, modifiedFiles: string[]): Promise<{
        updated: number;
        errors: number;
        chunks: number;
    }>;
    /**
     * Perform semantic search during query/retrieval
     */
    search(query: SearchQuery): Promise<SearchResponse>;
    /**
     * Get statistics about the semantic search index
     */
    getIndexStats(projectId?: string): Promise<{
        totalChunks: number;
        totalFiles: number;
        avgChunksPerFile: number;
        storageSize: string;
    }>;
    private ensureInitialized;
    private processFileForInit;
    private createSemanticChunks;
    private storeChunksWithEmbeddings;
    private searchDatabase;
    private searchFallback;
    private shouldSkipFile;
    private extractFileMetadata;
    private detectLanguage;
    private extractFunctions;
    private extractClasses;
    private extractImports;
    private extractExports;
    private determineChunkSignificance;
    private getOverlapContent;
    private calculateFallbackRelevance;
    private rankAndLimitResults;
    /**
     * Check if file is a code file that should get structural chunking
     */
    private isCodeFile;
    /**
     * Create structural chunks based on code structure (classes, methods, functions)
     */
    private createStructuralChunks;
    /**
     * Extract code entities (classes, methods, functions) from content
     */
    private extractCodeEntities;
    /**
     * Find the end of a code block starting at the given line
     */
    private findBlockEnd;
    /**
     * Create logical chunks for files without clear structural boundaries
     */
    private createLogicalChunks;
}
export default SemanticSearchManager;
//# sourceMappingURL=semantic-search-manager.d.ts.map