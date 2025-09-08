/**
 * Analysis Results Repository
 * Stores and retrieves complex analysis results in MongoDB
 */
export interface AnalysisResult {
    _id?: string;
    projectId: string;
    toolName: string;
    timestamp: Date;
    analysis: any;
    summary?: string;
    fileCount?: number;
    hasIssues?: boolean;
    tags?: string[];
    metrics?: {
        executionTime?: number;
        filesProcessed?: number;
        issuesFound?: number;
        complexity?: number;
    };
}
export declare class AnalysisRepository {
    private collection?;
    private logger;
    private readonly MAX_RESULTS_PER_TOOL;
    constructor();
    private ensureConnection;
    /**
     * Store analysis result with automatic cleanup
     */
    storeAnalysis(projectId: string, toolName: string, analysis: any): Promise<string>;
    /**
     * Get analysis history with filtering
     */
    getAnalysisHistory(projectId: string, toolName?: string, options?: {
        limit?: number;
        skip?: number;
        hasIssues?: boolean;
        tags?: string[];
        startDate?: Date;
        endDate?: Date;
    }): Promise<AnalysisResult[]>;
    /**
     * Search analysis results using full-text search
     */
    searchAnalysis(projectId: string, searchTerm: string): Promise<AnalysisResult[]>;
    /**
     * Get latest analysis for each tool
     */
    getLatestAnalyses(projectId: string): Promise<AnalysisResult[]>;
    /**
     * Get analysis trends over time
     */
    getAnalysisTrends(projectId: string, toolName: string, days?: number): Promise<any>;
    /**
     * Compare analysis results between two timestamps
     */
    compareAnalyses(projectId: string, toolName: string, timestamp1: Date, timestamp2: Date): Promise<any>;
    /**
     * Get aggregated statistics for a project
     */
    getProjectStatistics(projectId: string): Promise<any>;
    /**
     * Delete analysis results
     */
    deleteAnalysis(analysisId: string): Promise<boolean>;
    /**
     * Clean up old results to maintain storage limits
     */
    private cleanupOldResults;
    /**
     * Extract summary from analysis
     */
    private extractSummary;
    /**
     * Check if analysis contains issues
     */
    private checkForIssues;
    /**
     * Extract searchable tags from analysis
     */
    private extractTags;
    /**
     * Extract metrics from analysis
     */
    private extractMetrics;
}
export declare const analysisRepo: AnalysisRepository;
//# sourceMappingURL=analysis-repository.d.ts.map