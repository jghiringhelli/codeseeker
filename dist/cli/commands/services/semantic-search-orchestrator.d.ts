/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations using PostgreSQL pgvector
 *
 * This service queries the semantic_search_embeddings table in PostgreSQL
 * to find code files relevant to the user's query using vector similarity.
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
    private dbAvailable;
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
     * Perform semantic search using PostgreSQL pgvector
     * Falls back to file-based search if database is unavailable
     */
    performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]>;
    /**
     * Search using PostgreSQL - True Hybrid Search
     *
     * Search Strategy:
     * 1. Run BOTH Full-Text Search AND ILIKE pattern matching in parallel
     * 2. Merge results with weighted average scoring
     * 3. FTS captures semantic/linguistic similarity, ILIKE captures exact patterns
     *
     * Weight Configuration:
     * - FTS weight: 0.6 (semantic understanding, stemming, language-aware)
     * - ILIKE weight: 0.4 (exact matches, identifier patterns)
     */
    private searchDatabase;
    /**
     * Check if the content_tsvector column exists for full-text search
     */
    private checkFtsColumnExists;
    /**
     * Check if table has a specific column
     */
    private hasColumn;
    /**
     * Perform Full-Text Search using PostgreSQL tsvector/tsquery
     * Uses the FULL query text for semantic matching
     */
    private performFullTextSearch;
    /**
     * Fallback to ILIKE pattern matching when FTS is unavailable or returns no results
     */
    private performIlikeFallbackSearch;
    /**
     * Merge results from FTS and ILIKE searches with weighted scoring
     *
     * For files found by both methods:
     * - combinedScore = (ftsScore * ftsWeight) + (ilikeScore * ilikeWeight)
     *
     * For files found by only one method:
     * - Apply a penalty (0.8x) since we're less confident
     * - combinedScore = score * weight * 0.8
     */
    private mergeSearchResults;
    /**
     * Fallback file-based search when database is unavailable
     */
    private searchFileSystem;
    /**
     * Deduplicate results by file path, keeping highest similarity
     */
    private deduplicateResults;
    /**
     * Detect if query is asking about the project in general
     */
    private isGeneralProjectQuery;
    /**
     * Get key entry point files for understanding the project
     */
    private getEntryPointFiles;
    /**
     * Extract meaningful search terms from query
     */
    private extractSearchTerms;
    /**
     * Calculate file relevance based on query terms
     */
    private calculateFileRelevance;
    /**
     * Discover code files in project
     */
    private discoverFiles;
    /**
     * Get preview of file content
     */
    private getFilePreview;
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