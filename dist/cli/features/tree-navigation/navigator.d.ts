/**
 * Minimal Tree Navigator - MVP Implementation
 * Provides basic tree navigation functionality to replace removed feature
 */
export interface TreeNavigationRequest {
    projectPath: string;
    query?: string;
    maxDepth?: number;
}
export interface TreeAnalysisResult {
    summary: string;
    fileCount: number;
    directoryCount: number;
    relevantFiles: string[];
}
export declare class TreeNavigator {
    private logger;
    /**
     * Perform basic tree analysis for the project
     */
    performAnalysis(request: TreeNavigationRequest): Promise<TreeAnalysisResult>;
}
//# sourceMappingURL=navigator.d.ts.map