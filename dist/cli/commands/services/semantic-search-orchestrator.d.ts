/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations
 *
 * STORAGE MODES:
 * - Embedded (default): Uses SQLite for vectors + MiniSearch for text search
 * - Server: Uses PostgreSQL with pgvector for production deployments
 *
 * HYBRID SEARCH STRATEGY:
 * Combines multiple search methods and fuses results using Reciprocal Rank Fusion (RRF):
 *
 * 1. Vector Similarity - Semantic understanding of concepts
 * 2. MiniSearch Text Search - BM25 scoring with synonym expansion and CamelCase tokenization
 * 3. File Path Matching - Directory/filename pattern matching
 *
 * The hybrid approach solves the problem where:
 * - "command handler" doesn't match "controller" semantically
 * - But text search with synonym expansion (handler → controller) catches it
 *
 * NO FILE FALLBACK: If storage is unavailable or has no results, returns empty array.
 * Claude handles file discovery natively - we don't duplicate that functionality.
 */
export interface SemanticResult {
    file: string;
    type: string;
    similarity: number;
    content: string;
    lineStart?: number;
    lineEnd?: number;
    /** Debug info for verbose mode - score breakdown by source */
    debug?: {
        vectorScore: number;
        textScore: number;
        pathMatch: boolean;
        matchSource: string;
    };
}
export declare class SemanticSearchOrchestrator {
    private logger;
    private projectId?;
    private embeddingGenerator;
    private storageManager;
    private useEmbedded;
    private vectorStore?;
    private projectStore?;
    constructor();
    /**
     * Initialize storage - checks if we should use embedded or server mode
     */
    private initStorage;
    /**
     * Set project ID for scoped searches
     */
    setProjectId(projectId: string): void;
    /**
     * Resolve project ID from storage by project path
     */
    private resolveProjectId;
    /**
     * Perform HYBRID semantic search
     * Uses storage interface abstraction for both embedded and server modes
     * Combines vector similarity with keyword/synonym matching for better recall
     * Returns empty array if storage unavailable or no results - Claude handles file discovery natively
     */
    performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]>;
    /**
     * Perform hybrid search using the storage interface abstraction
     * Works for both embedded (SQLite + MiniSearch) and server (PostgreSQL + pgvector) modes
     * The IVectorStore implementation handles the specific search logic internally
     */
    private performHybridSearchViaInterface;
    /**
     * Check if string is valid UUID
     */
    private isValidUUID;
    /**
     * Format content from database with metadata
     */
    private formatContent;
    /**
     * Determine file type based on path and name
     */
    private determineFileType;
}
//# sourceMappingURL=semantic-search-orchestrator.d.ts.map