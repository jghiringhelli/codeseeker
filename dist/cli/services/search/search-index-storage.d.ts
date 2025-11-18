/**
 * Search Index Storage Service - Single Responsibility
 * Handles storage and retrieval of semantic chunks and embeddings
 */
import { DatabaseConnections } from '../../../config/database-config';
import { ISearchIndexStorage, SemanticChunk, SearchQuery, SemanticSearchResult } from '../../../core/interfaces/search-interfaces';
export declare class SearchIndexStorage implements ISearchIndexStorage {
    private dbConnections;
    constructor(dbConnections: DatabaseConnections);
    storeChunks(projectId: string, chunks: SemanticChunk[], embeddings: number[][]): Promise<void>;
    retrieveChunks(query: SearchQuery): Promise<SemanticSearchResult[]>;
    private parseJsonSafely;
    getIndexStats(projectId?: string): Promise<{
        totalFiles: number;
        totalChunks: number;
        lastUpdated: Date;
        projectSize: number;
    }>;
    removeChunks(projectId: string, filePaths: string[]): Promise<void>;
    updateChunkContent(chunkId: string, content: string, embedding: number[]): Promise<void>;
}
//# sourceMappingURL=search-index-storage.d.ts.map