/**
 * Search Command Handler
 * Single Responsibility: Handle search commands including semantic search
 *
 * STORAGE MODES:
 * - Embedded (default): Uses SQLite vector store via StorageManager
 * - Server: Uses PostgreSQL via analysisRepository
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SearchCommandHandler extends BaseCommandHandler {
    private logger;
    /**
     * Convert similarity score (0-1) to star rating display
     * ★★★★★ = 90-100% (Excellent match)
     * ★★★★☆ = 75-89%  (Very good match)
     * ★★★☆☆ = 60-74%  (Good match)
     * ★★☆☆☆ = 45-59%  (Fair match)
     * ★☆☆☆☆ = 30-44%  (Weak match)
     * ☆☆☆☆☆ = 0-29%   (Poor match)
     */
    private getStarRating;
    handle(args: string): Promise<CommandResult>;
    /**
     * Index the current project for semantic search (incremental)
     * Only reindexes files that have changed based on content hash
     */
    private indexProject;
    /**
     * Get existing file hashes from database for incremental indexing
     */
    private getExistingFileHashes;
    /**
     * Delete embeddings for specified files
     */
    private deleteFileEmbeddings;
    /**
     * Search for code using semantic similarity
     */
    private searchCode;
    /**
     * Calculate simple text-based similarity for MVP
     */
    private calculateTextSimilarity;
    /**
     * Get existing project ID from database
     */
    private generateProjectId;
}
//# sourceMappingURL=search-command-handler.d.ts.map