/**
 * Minimal SOLID Principles Analyzer - MVP Implementation
 * Provides basic SOLID principles analysis for validation cycle
 */
export interface SOLIDAnalysisRequest {
    projectPath: string;
    files?: string[];
}
export interface SOLIDAnalysisResult {
    overallScore: number;
    principleScores: {
        singleResponsibility: number;
        openClosed: number;
        liskovSubstitution: number;
        interfaceSegregation: number;
        dependencyInversion: number;
    };
    violations: SOLIDViolation[];
    suggestions: string[];
}
export interface SOLIDViolation {
    principle: string;
    file: string;
    line?: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
}
export declare class SOLIDPrinciplesAnalyzer {
    private logger;
    /**
     * Perform basic SOLID analysis using simple heuristics
     */
    analyzeSOLID(request: SOLIDAnalysisRequest): Promise<SOLIDAnalysisResult>;
    /**
     * Generate improvement suggestions based on violations
     */
    private generateSuggestions;
}
//# sourceMappingURL=analyzer.d.ts.map