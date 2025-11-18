/**
 * Semantic Search Manager - SOLID Principles Compliant
 * Uses dependency injection and delegates to focused services
 */
import { SearchQuery, SearchResponse, IContentChunker, IEmbeddingGenerator, ISearchIndexStorage, ISearchQueryProcessor, IProjectIndexer } from '../../core/interfaces/search-interfaces';
export declare class SemanticSearchManager implements IProjectIndexer {
    private contentChunker;
    private embeddingGenerator;
    private indexStorage;
    private queryProcessor;
    private logger;
    constructor(contentChunker: IContentChunker, embeddingGenerator: IEmbeddingGenerator, indexStorage: ISearchIndexStorage, queryProcessor: ISearchQueryProcessor);
    /**
     * Initialize project for semantic search
     */
    initializeProject(projectId: string, projectPath: string): Promise<void>;
    /**
     * Update specific files in the search index
     */
    updateFiles(projectId: string, filePaths: string[]): Promise<void>;
    /**
     * Remove files from the search index
     */
    removeFiles(projectId: string, filePaths: string[]): Promise<void>;
    /**
     * Perform semantic search
     */
    search(query: SearchQuery): Promise<SearchResponse>;
    /**
     * Get search index statistics
     */
    getIndexStats(projectId?: string): Promise<{
        totalFiles: number;
        totalChunks: number;
        lastUpdated: Date;
        projectSize: number;
    }>;
    private processBatch;
    private scanProjectFiles;
    private shouldSkipDirectory;
    private shouldIncludeFile;
    private calculateFileHash;
}
//# sourceMappingURL=semantic-search-manager.d.ts.map