/**
 * Semantic Search Service - SOLID Principles Compliant
 * Single Responsibility: Provides semantic search capabilities with proper interface compliance
 * Open/Closed: Extensible through strategy injection
 * Liskov Substitution: Compatible with existing search interfaces
 * Interface Segregation: Implements focused interfaces properly
 * Dependency Inversion: Depends on abstractions through constructor injection
 */
import { AnalysisTool } from '../../../shared/tool-interface';
import { SemanticSearchCache } from '../../../shared/multi-level-cache';
import { SearchQuery, SearchResponse, IContentChunker, IEmbeddingGenerator, ISearchIndexStorage, ISearchQueryProcessor, IProjectIndexer } from '../../../core/interfaces/search-interfaces';
export declare class SemanticSearchService extends AnalysisTool implements IProjectIndexer {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    intents: string[];
    keywords: string[];
    private logger;
    private cache?;
    private isInitialized;
    private contentChunker;
    private embeddingGenerator;
    private indexStorage;
    private queryProcessor;
    private config;
    constructor(contentChunker: IContentChunker, embeddingGenerator: IEmbeddingGenerator, indexStorage: ISearchIndexStorage, queryProcessor: ISearchQueryProcessor, projectPath?: string);
    getDatabaseToolName(): string;
    performAnalysis(projectPath: string, projectId: string, context: any): Promise<any>;
    initializeProject(projectId: string, projectPath: string): Promise<void>;
    updateFiles(projectId: string, filePaths: string[]): Promise<void>;
    removeFiles(projectId: string, filePaths: string[]): Promise<void>;
    search(query: SearchQuery): Promise<SearchResponse>;
    private scanProjectFiles;
    private processBatch;
    private processBatchChunk;
    getStats(projectId?: string): Promise<{
        initialized: boolean;
        config: {
            supportedExtensions: string[];
            excludePatterns: string[];
            batchSize: number;
            enableCaching: boolean;
        };
        indexStats: {
            totalFiles: number;
            totalChunks: number;
            lastUpdated: Date;
            projectSize: number;
        };
        cacheEnabled: boolean;
        error?: undefined;
    } | {
        initialized: boolean;
        config: {
            supportedExtensions: string[];
            excludePatterns: string[];
            batchSize: number;
            enableCaching: boolean;
        };
        error: any;
        indexStats?: undefined;
        cacheEnabled?: undefined;
    }>;
    clearIndex(projectId?: string): Promise<void>;
    /**
     * Update configuration at runtime (SOLID: Open/Closed)
     */
    updateConfig(newConfig: Partial<typeof this.config>): void;
    /**
     * Get current configuration
     */
    getConfig(): {
        supportedExtensions: string[];
        excludePatterns: string[];
        batchSize: number;
        enableCaching: boolean;
    };
    setCache(cache: SemanticSearchCache): void;
}
export default SemanticSearchService;
//# sourceMappingURL=semantic-search.d.ts.map