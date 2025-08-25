export interface DuplicationScanRequest {
    projectPath: string;
    includeSemantic: boolean;
    similarityThreshold: number;
    includeRefactoringSuggestions: boolean;
    filePatterns?: string[];
    excludePatterns?: string[];
}
export interface DuplicationResult {
    duplicates: DuplicationGroup[];
    scanInfo: ScanInfo;
    statistics: DuplicationStatistics;
}
export interface DuplicationGroup {
    id: string;
    type: DuplicationType;
    similarity: number;
    locations: CodeLocation[];
    refactoring?: RefactoringAdvice;
    metadata: {
        linesOfCode: number;
        tokenCount: number;
        complexity: number;
    };
}
export interface CodeLocation {
    file: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
    codeSnippet: string;
    hash: string;
}
export interface RefactoringAdvice {
    approach: RefactoringApproach;
    description: string;
    estimatedEffort: EffortEstimate;
    steps: string[];
    example?: string;
    impact: RefactoringImpact;
}
export interface ScanInfo {
    totalFiles: number;
    analyzedFiles: number;
    skippedFiles: number;
    processingTime: number;
    timestamp: Date;
}
export interface DuplicationStatistics {
    totalDuplicates: number;
    byType: Record<DuplicationType, number>;
    bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
    estimatedTechnicalDebt: {
        linesOfCode: number;
        maintenanceHours: number;
        riskScore: number;
    };
}
export declare enum DuplicationType {
    EXACT = "exact",
    STRUCTURAL = "structural",
    SEMANTIC = "semantic",
    RENAMED = "renamed"
}
export declare enum RefactoringApproach {
    EXTRACT_FUNCTION = "extract_function",
    EXTRACT_CLASS = "extract_class",
    EXTRACT_UTILITY = "extract_utility",
    USE_INHERITANCE = "use_inheritance",
    APPLY_STRATEGY_PATTERN = "apply_strategy_pattern",
    CONSOLIDATE_CONFIGURATION = "consolidate_configuration"
}
export declare enum EffortEstimate {
    LOW = "low",// < 30 minutes
    MEDIUM = "medium",// 30 minutes - 2 hours
    HIGH = "high",// 2-8 hours
    VERY_HIGH = "very_high"
}
export interface RefactoringImpact {
    maintainability: number;
    testability: number;
    reusability: number;
    riskLevel: number;
}
export declare class DuplicationDetector {
    private logger;
    private astAnalyzer;
    findDuplicates(request: DuplicationScanRequest): Promise<DuplicationResult>;
    private getProjectFiles;
    private extractCodeBlocks;
    private extractBlockContent;
    private isSignificantBlock;
    private calculateHash;
    private tokenizeCode;
    private calculateStructuralFingerprint;
    private findDuplicateGroups;
    private calculateSimilarity;
    private calculateStructuralSimilarity;
    private calculateTokenSimilarity;
    private calculateSemanticSimilarity;
    private extractVariableNames;
    private extractFunctionCalls;
    private determineDuplicationType;
    private calculateAverageTokenSimilarity;
    private calculateGroupSimilarity;
    private generateRefactoringAdvice;
    private getRefactoringDescription;
    private getRefactoringSteps;
    private calculateMaintainabilityImpact;
    private calculateTestabilityImpact;
    private calculateReusabilityImpact;
    private calculateRiskLevel;
    private generateExtractionExample;
    private suggestFunctionName;
    private calculateStatistics;
    private getSeverity;
}
export default DuplicationDetector;
//# sourceMappingURL=detector.d.ts.map