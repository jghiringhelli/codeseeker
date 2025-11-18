/**
 * Search interfaces following Interface Segregation Principle
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
    totalResults: number;
    processingTime: number;
    searchStats: {
        indexedFiles: number;
        totalChunks: number;
        matchesFound: number;
    };
}
export interface IContentChunker {
    createSemanticChunks(filePath: string, content: string, fileHash: string): Promise<SemanticChunk[]>;
    createStructuralChunks(filePath: string, content: string, fileHash: string, lines: string[]): Promise<SemanticChunk[]>;
}
export interface IEmbeddingGenerator {
    generateEmbeddings(chunks: SemanticChunk[]): Promise<number[][]>;
    generateQueryEmbedding(query: string): Promise<number[]>;
}
export interface ISearchIndexStorage {
    storeChunks(projectId: string, chunks: SemanticChunk[], embeddings: number[][]): Promise<void>;
    retrieveChunks(query: SearchQuery): Promise<SemanticSearchResult[]>;
    removeChunks(projectId: string, filePaths: string[]): Promise<void>;
    getIndexStats(projectId?: string): Promise<{
        totalFiles: number;
        totalChunks: number;
        lastUpdated: Date;
        projectSize: number;
    }>;
}
export interface ISearchQueryProcessor {
    processQuery(query: SearchQuery): Promise<SearchResponse>;
    executeSimilaritySearch(queryEmbedding: number[], query: SearchQuery): Promise<SemanticSearchResult[]>;
}
export interface IProjectIndexer {
    initializeProject(projectId: string, projectPath: string): Promise<void>;
    updateFiles(projectId: string, filePaths: string[]): Promise<void>;
    removeFiles(projectId: string, filePaths: string[]): Promise<void>;
}
//# sourceMappingURL=search-interfaces.d.ts.map