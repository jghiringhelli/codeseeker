/**
 * Search Service Factory - Dependency Injection
 * Creates and wires up search services following Dependency Inversion Principle
 */
import { DatabaseConnections } from '../../config/database-config';
import { SemanticSearchService } from '../../cli/services/search/semantic-search';
import { IContentChunker, IEmbeddingGenerator, ISearchIndexStorage, ISearchQueryProcessor } from '../interfaces/search-interfaces';
export declare class SearchServiceFactory {
    private static instance;
    private dbConnections;
    private constructor();
    static getInstance(): SearchServiceFactory;
    /**
     * Create content chunker service
     */
    createContentChunker(): IContentChunker;
    /**
     * Create embedding generator service
     */
    createEmbeddingGenerator(): IEmbeddingGenerator;
    /**
     * Create search index storage service
     */
    createSearchIndexStorage(): ISearchIndexStorage;
    /**
     * Create search query processor service
     */
    createSearchQueryProcessor(): ISearchQueryProcessor;
    /**
     * Create fully configured search service with all dependencies injected
     */
    createSemanticSearchService(): SemanticSearchService;
    /**
     * Create search service with custom dependencies (for testing)
     */
    createSemanticSearchServiceWithDependencies(contentChunker: IContentChunker, embeddingGenerator: IEmbeddingGenerator, indexStorage: ISearchIndexStorage, queryProcessor: ISearchQueryProcessor): SemanticSearchService;
    /**
     * Get database connections instance
     */
    getDatabaseConnections(): DatabaseConnections;
}
//# sourceMappingURL=search-service-factory.d.ts.map