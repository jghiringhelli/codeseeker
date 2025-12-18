/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations using PostgreSQL
 *
 * HYBRID SEARCH STRATEGY:
 * Combines multiple search methods and fuses results using Reciprocal Rank Fusion (RRF):
 *
 * 1. Vector Similarity (pgvector) - Semantic understanding of concepts
 * 2. Full-Text Search (PostgreSQL FTS) - TF-IDF-like ranking with ts_rank + synonym expansion
 * 3. File Path Matching - Directory/filename pattern matching
 *
 * The hybrid approach solves the problem where:
 * - "command handler" doesn't match "controller" semantically
 * - But FTS with synonym expansion (handler → controller) catches it
 *
 * PERSISTENCE:
 * - Vector embeddings: Stored in semantic_search_embeddings.embedding (pgvector)
 * - FTS index: content_tsvector column with GIN index (idx_semantic_embeddings_fts)
 * - Both are persistent and updated on code changes
 *
 * NO FILE FALLBACK: If DB is unavailable or has no results, returns empty array.
 * Claude handles file discovery natively - we don't duplicate that functionality.
 */
import { DatabaseConnections } from '../../../config/database-config';
export interface SemanticResult {
    file: string;
    type: string;
    similarity: number;
    content: string;
    lineStart?: number;
    lineEnd?: number;
}
export declare class SemanticSearchOrchestrator {
    private logger;
    private dbConnections;
    private projectId?;
    private embeddingGenerator;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Set project ID for scoped searches
     */
    setProjectId(projectId: string): void;
    /**
     * Resolve project ID from database by project path
     */
    private resolveProjectId;
    /**
     * Perform HYBRID semantic search using PostgreSQL pgvector + keyword matching
     * Combines vector similarity with keyword/synonym matching for better recall
     * Returns empty array if DB unavailable or no results - Claude handles file discovery natively
     */
    performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]>;
    /**
     * Hybrid search: Combines vector similarity, keyword matching, and file path matching
     * Uses Reciprocal Rank Fusion (RRF) to merge results from different search methods
     */
    private performHybridSearch;
    /**
     * Search using PostgreSQL Full-Text Search (FTS) with ts_rank
     * Uses the existing content_tsvector column and GIN index for TF-IDF-like ranking
     *
     * Benefits over ILIKE:
     * - Uses GIN index (fast)
     * - Proper TF-IDF ranking with ts_rank
     * - Handles stemming and word boundaries
     * - Supports phrase matching and boolean operators
     */
    private searchByKeywords;
    /**
     * Fallback keyword search using ILIKE (slower but more forgiving)
     * Used when FTS fails due to special characters or syntax issues
     */
    private searchByKeywordsILIKE;
    /**
     * Search by file path patterns
     * Matches directory names and file names against query terms
     */
    private searchByFilePath;
    /**
     * Extract meaningful keywords from query
     * Removes stop words and short terms
     */
    private extractKeywords;
    /**
     * Expand keywords with programming synonyms
     * Maps common programming terms to their alternatives
     */
    private expandWithSynonyms;
    /**
     * Check if string is valid UUID
     */
    private isValidUUID;
    /**
     * Search using pgvector similarity
     *
     * Strategy:
     * 1. Generate embedding for the query text
     * 2. Use pgvector's <=> operator (cosine distance) to find similar embeddings
     * 3. Return results sorted by similarity (1 - distance = similarity)
     */
    private searchByVectorSimilarity;
    /**
     * Check if table has a specific column
     */
    private hasColumn;
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