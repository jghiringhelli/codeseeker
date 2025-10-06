/**
 * Analysis Results Repository
 * Stores and retrieves complex analysis results in PostgreSQL
 */
export interface AnalysisResult {
    id?: string;
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
    private logger;
    private dbConnections;
    constructor();
    /**
     * Store analysis result (PostgreSQL implementation)
     */
    storeAnalysis(projectId: string, toolName: string, analysis: any): Promise<string>;
    /**
     * Get analysis history with filtering
     */
    getAnalysisHistory(projectId: string, toolName?: string, limit?: number): Promise<AnalysisResult[]>;
    /**
     * Get latest analysis for a tool
     */
    getLatestAnalysis(projectId: string, toolName: string): Promise<AnalysisResult | null>;
    /**
     * Search analysis results by query
     */
    searchAnalysis(projectId: string, query: string): Promise<AnalysisResult[]>;
    /**
     * Delete analysis results for a project
     */
    deleteProjectAnalysis(projectId: string): Promise<void>;
}
export declare const analysisRepo: AnalysisRepository;
//# sourceMappingURL=analysis-repository.d.ts.map