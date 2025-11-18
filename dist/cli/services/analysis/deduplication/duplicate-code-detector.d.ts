/**
 * Duplicate Code Detector
 * Uses semantic search and smart comparison to find duplicated code patterns
 * Following SOLID principles with configurable similarity thresholds
 */
import { DatabaseConnections } from '../../../../config/database-config';
export interface CodeChunk {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    functionName?: string;
    className?: string;
    type: 'function' | 'class' | 'method' | 'block';
    embedding?: number[];
    hash: string;
}
export interface DuplicateGroup {
    id: string;
    similarity: number;
    chunks: CodeChunk[];
    type: 'exact' | 'semantic' | 'structural';
    consolidationSuggestion: string;
    estimatedSavings: {
        linesReduced: number;
        filesAffected: number;
        maintenanceImprovement: string;
    };
}
export interface DeduplicationReport {
    totalChunksAnalyzed: number;
    duplicateGroups: DuplicateGroup[];
    summary: {
        exactDuplicates: number;
        semanticDuplicates: number;
        structuralDuplicates: number;
        totalLinesAffected: number;
        potentialSavings: number;
    };
    recommendations: string[];
}
export interface DeduplicationOptions {
    exactSimilarityThreshold: number;
    semanticSimilarityThreshold: number;
    structuralSimilarityThreshold: number;
    minimumChunkSize: number;
    excludePatterns: string[];
    includeTypes: ('function' | 'class' | 'method' | 'block')[];
}
export declare class DuplicateCodeDetector {
    private logger;
    private dbConnections;
    private embeddingProvider;
    private defaultOptions;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Analyze project for duplicate code patterns
     */
    analyzeProject(projectPath: string, options?: Partial<DeduplicationOptions>): Promise<DeduplicationReport>;
    /**
     * Extract code chunks from project files using Tree-sitter
     */
    private extractCodeChunks;
    /**
     * Generate embeddings for semantic comparison
     */
    private generateEmbeddings;
    /**
     * Find duplicate groups using multiple similarity measures
     */
    private findDuplicateGroups;
    /**
     * Calculate similarity between two code chunks
     */
    private calculateSimilarity;
    /**
     * Synchronous version for quick comparisons
     */
    private calculateSimilaritySync;
    /**
     * Generate consolidation suggestions for duplicate groups
     */
    private generateConsolidationSuggestions;
    /**
     * Create comprehensive deduplication report
     */
    private createReport;
    private detectLanguage;
    private extractEntityContent;
    private extractCodeBlocks;
    private normalizeCodeContent;
    private generateContentHash;
    private cosineSimilarity;
    private calculateStructuralSimilarity;
    private extractStructure;
    private determineDuplicateType;
}
export default DuplicateCodeDetector;
//# sourceMappingURL=duplicate-code-detector.d.ts.map