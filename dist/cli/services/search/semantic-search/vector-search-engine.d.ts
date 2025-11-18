/**
 * Vector Search Engine - SOLID Principles Implementation
 * Single Responsibility: Execute semantic searches using vector similarity
 * Uses fast-cosine-similarity library for optimized performance
 */
import { ContentChunk } from '../../data/content-processing/content-processor';
export interface SearchQuery {
    text: string;
    filters?: {
        language?: string;
        chunkType?: string;
        filePath?: string;
        significance?: 'high' | 'medium' | 'low';
    };
    options?: {
        maxResults?: number;
        minSimilarity?: number;
        includeContent?: boolean;
    };
}
export interface SearchResult {
    chunk: ContentChunk;
    similarity: number;
    rank: number;
    highlights?: string[];
}
export interface SearchResponse {
    query: string;
    results: SearchResult[];
    totalResults: number;
    searchTime: number;
    metadata: {
        embeddingModel: string;
        indexSize: number;
    };
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
/**
 * Abstract vector store - Dependency Inversion Principle
 */
export declare abstract class VectorStore {
    abstract addVectors(vectors: VectorIndex[]): Promise<void>;
    abstract searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]>;
    abstract getVectorCount(): Promise<number>;
    abstract clearIndex(): Promise<void>;
}
/**
 * In-Memory Vector Store using fast-cosine-similarity
 */
export declare class InMemoryVectorStore extends VectorStore {
    private vectors;
    addVectors(vectors: VectorIndex[]): Promise<void>;
    searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]>;
    getVectorCount(): Promise<number>;
    clearIndex(): Promise<void>;
}
/**
 * PostgreSQL Vector Store using pgvector
 */
export declare class PostgreSQLVectorStore extends VectorStore {
    private client;
    constructor(client: any);
    addVectors(vectors: VectorIndex[]): Promise<void>;
    searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]>;
    private parseVector;
    getVectorCount(): Promise<number>;
    clearIndex(): Promise<void>;
}
/**
 * Vector Search Engine - Main service
 */
export declare class VectorSearchEngine {
    private vectorStore;
    private embeddingProvider;
    constructor(vectorStore: VectorStore, embeddingProvider?: any);
    /**
     * Index content chunks with their embeddings
     */
    indexContent(chunks: ContentChunk[], embeddings: any[]): Promise<void>;
    /**
     * Perform semantic search using vector similarity
     */
    search(query: SearchQuery): Promise<SearchResponse>;
    private applyFilters;
    private createSearchResults;
    private generateHighlights;
    /**
     * Get search index statistics
     */
    getIndexStats(): Promise<{
        totalChunks: number;
    }>;
    /**
     * Clear the search index
     */
    clearIndex(): Promise<void>;
}
//# sourceMappingURL=vector-search-engine.d.ts.map