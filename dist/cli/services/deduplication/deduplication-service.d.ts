/**
 * Deduplication Service
 * Identifies and manages duplicate code at method and class level
 * Uses granular embeddings for intelligent similarity detection
 */
export interface SimilarityResult {
    id: string;
    similarity: number;
    content: string;
}
export interface DuplicateGroup {
    type: 'method' | 'class';
    primary: DuplicateItem;
    duplicates: DuplicateItem[];
    similarityScore: number;
    confidence: 'high' | 'medium' | 'low';
    mergeStrategy: 'exact' | 'similar' | 'refactor';
}
export interface DuplicateItem {
    id: string;
    name: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    metadata: any;
}
export interface DeduplicationReport {
    projectId: string;
    totalMethods: number;
    totalClasses: number;
    duplicateGroups: DuplicateGroup[];
    potentialSavings: {
        linesOfCode: number;
        filesAffected: number;
        estimatedEffort: string;
    };
    summary: {
        exactDuplicates: number;
        similarDuplicates: number;
        refactorCandidates: number;
    };
}
export interface MergeAction {
    action: 'merge' | 'extract' | 'skip';
    sourceId: string;
    targetId: string;
    newName?: string;
    newLocation?: string;
}
export declare class DeduplicationService {
    private logger;
    private embeddingService;
    private codeParser;
    private semanticGraph;
    constructor();
    /**
     * Generate comprehensive deduplication report
     */
    generateDeduplicationReport(projectId: string, progressCallback?: (progress: number, status: string) => void): Promise<DeduplicationReport>;
    /**
     * Find method duplicates using similarity analysis
     */
    private findMethodDuplicates;
    /**
     * Find class duplicates using similarity analysis
     */
    private findClassDuplicates;
    /**
     * Create a duplicate group from similar items
     */
    private createDuplicateGroup;
    /**
     * Convert similarity results to duplicate items
     */
    private convertToeDuplicateItems;
    /**
     * Print detailed deduplication report
     */
    printDeduplicationReport(report: DeduplicationReport): void;
    /**
     * Interactive merge process for duplicate groups
     */
    interactiveMerge(report: DeduplicationReport, userInterface: any, workflowOrchestrator: any): Promise<void>;
    /**
     * Show side-by-side code comparison
     */
    private showCodeComparison;
    /**
     * Get user decision for merge action
     */
    private getUserMergeDecision;
    /**
     * Execute merge through workflow orchestrator (quality cycle)
     */
    private executeMergeWithQualityCycle;
    /**
     * Build merge request for workflow orchestrator
     */
    private buildMergeRequest;
    private ensureGranularEmbeddings;
    private getAllMethodsAndClasses;
    private calculatePotentialSavings;
    private formatCodePreview;
}
export default DeduplicationService;
//# sourceMappingURL=deduplication-service.d.ts.map