/**
 * Smart Deduplication Detector
 * Uses existing Xenova embeddings from PostgreSQL
 * Leverages Redis for change detection
 * Integrates Claude Code for intelligent analysis
 */
import { DatabaseConnections } from '../../../../config/database-config';
export interface DuplicateCandidate {
    id: string;
    filePath1: string;
    filePath2: string;
    chunk1: {
        content: string;
        startLine: number;
        endLine: number;
    };
    chunk2: {
        content: string;
        startLine: number;
        endLine: number;
    };
    similarity: number;
    type: 'exact' | 'semantic' | 'structural';
    embedding1?: number[];
    embedding2?: number[];
    claudeAnalysis?: string;
}
export interface ConsolidationSuggestion {
    candidateId: string;
    strategy: 'extract-function' | 'create-utility' | 'merge-classes' | 'create-interface';
    description: string;
    estimatedLinesReduced: number;
    claudeAnalysis?: string;
}
export declare class SmartDedupDetector {
    private logger;
    private dbConnections;
    private changeDetector;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Smart deduplication using existing embeddings and change detection
     */
    analyzeProject(projectId: string): Promise<any>;
    /**
     * Update embeddings for changed files using SemanticSearchManager
     */
    private updateEmbeddingsForChangedFiles;
    /**
     * Remove embeddings for deleted files
     */
    private removeEmbeddingsForDeletedFiles;
    /**
     * Load project embeddings from PostgreSQL (Xenova embeddings)
     */
    private loadProjectEmbeddings;
    /**
     * Find duplicate candidates using vector similarity
     */
    private findDuplicateCandidates;
    /**
     * Analyze duplicates with Claude Code
     */
    private analyzeWithClaude;
    /**
     * Generate smart consolidation suggestions
     */
    private generateSmartSuggestions;
    /**
     * Cache analysis results in Redis
     */
    private cacheAnalysisResults;
    /**
     * Get cached results if available
     */
    getCachedResults(projectId: string): Promise<any | null>;
}
//# sourceMappingURL=smart-dedup-detector.d.ts.map