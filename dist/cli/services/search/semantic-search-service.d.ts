/**
 * Consolidated Semantic Search Service - SOLID Principles Compliant
 * Single Responsibility: Unified semantic search management with vector similarity, caching, and project indexing
 * Open/Closed: Extensible through strategy injection for different vector stores and embedding models
 * Liskov Substitution: Different stores and generators are interchangeable through common interfaces
 * Interface Segregation: Separate interfaces for different search aspects
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
import { AnalysisTool } from '../../../shared/tool-interface';
import { ContentChunk } from '../data/content-processing/content-processor';
import { SearchQuery, SearchResponse, IContentChunker, ISearchQueryProcessor, IProjectIndexer } from '../../../core/interfaces/search-interfaces';
export interface IVectorStore {
    store(chunkId: string, vector: number[], chunk: ContentChunk): Promise<void>;
    search(vector: number[], maxResults: number, minSimilarity: number): Promise<VectorSearchResult[]>;
    getStats(): Promise<IndexStats>;
    clear(): Promise<void>;
}
export interface ISemanticCache {
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    clear(): Promise<void>;
    initialize(): Promise<void>;
}
export interface IEmbeddingService {
    generateEmbedding(text: string): Promise<number[]>;
    batchGenerateEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export interface SearchResult {
    chunk: ContentChunk;
    similarity: number;
    rank: number;
    highlights?: string[];
}
export interface VectorSearchResult {
    chunkId: string;
    similarity: number;
    chunk: ContentChunk;
}
export interface VectorIndex {
    chunkId: string;
    vector: number[];
    chunk: ContentChunk;
    metadata: {
        indexed: Date;
        model: string;
        dimensions: number;
    };
}
export interface IndexStats {
    totalVectors: number;
    dimensions: number;
    memoryUsage: number;
    lastIndexed: Date;
}
export declare class InMemoryVectorStore implements IVectorStore {
    private vectors;
    store(chunkId: string, vector: number[], chunk: ContentChunk): Promise<void>;
    search(vector: number[], maxResults: number, minSimilarity: number): Promise<VectorSearchResult[]>;
    getStats(): Promise<IndexStats>;
    clear(): Promise<void>;
}
export declare class PostgreSQLVectorStore implements IVectorStore {
    private client;
    constructor(client: any);
    store(chunkId: string, vector: number[], chunk: ContentChunk): Promise<void>;
    search(vector: number[], maxResults: number, minSimilarity: number): Promise<VectorSearchResult[]>;
    getStats(): Promise<IndexStats>;
    clear(): Promise<void>;
}
export declare class OpenAIEmbeddingService implements IEmbeddingService {
    private apiKey;
    private model;
    private dimensions;
    constructor(apiKey?: string);
    generateEmbedding(text: string): Promise<number[]>;
    batchGenerateEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export declare class LocalEmbeddingService implements IEmbeddingService {
    private dimensions;
    private model;
    generateEmbedding(text: string): Promise<number[]>;
    batchGenerateEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export interface SemanticSearchConfig {
    vectorStore: 'memory' | 'postgresql';
    embeddingService: 'openai' | 'local';
    caching: boolean;
    maxResults: number;
    minSimilarity: number;
    batchSize: number;
    supportedExtensions: string[];
    excludePatterns: string[];
}
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
    private config;
    private vectorStore;
    private embeddingService;
    private cache?;
    private contentChunker?;
    private queryProcessor?;
    constructor(config?: Partial<SemanticSearchConfig>, vectorStore?: IVectorStore, embeddingService?: IEmbeddingService, cache?: ISemanticCache, contentChunker?: IContentChunker, queryProcessor?: ISearchQueryProcessor, databaseClient?: any);
    /**
     * Initialize project for semantic search
     * SOLID: Single Responsibility - focused on project initialization
     */
    initializeProject(projectId: string, projectPath: string): Promise<void>;
    private scanProjectFiles;
    private processBatch;
    private indexFile;
    private createBasicChunks;
    private detectLanguage;
    private generateChunkId;
    /**
     * Execute semantic search
     * SOLID: Single Responsibility - focused on search execution
     */
    search(query: SearchQuery): Promise<SearchResponse>;
    private applyFilters;
    private generateHighlights;
    getDatabaseToolName(): string;
    /**
     * Tool execution method
     */
    execute(context: any): Promise<any>;
    private isIndexed;
    /**
     * Get search service statistics
     */
    getStats(): Promise<{
        config: SemanticSearchConfig;
        indexStats: IndexStats;
        embeddingModel: string;
        embeddingDimensions: number;
    }>;
    /**
     * Clear all indexed data
     */
    clearIndex(): Promise<void>;
    /**
     * Update configuration at runtime (SOLID: Open/Closed)
     */
    updateConfig(newConfig: Partial<SemanticSearchConfig>): void;
    /**
     * Inject dependencies for testing or extension (SOLID: Dependency Inversion)
     */
    setVectorStore(store: IVectorStore): void;
    setEmbeddingService(service: IEmbeddingService): void;
    setCache(cache: ISemanticCache): void;
    setContentChunker(chunker: IContentChunker): void;
    setQueryProcessor(processor: ISearchQueryProcessor): void;
}
export default SemanticSearchService;
//# sourceMappingURL=semantic-search-service.d.ts.map