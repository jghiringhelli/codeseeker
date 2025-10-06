/**
 * SOLID Principles Analyzer - Simplified Architecture Quality Assessment
 * Analyzes code adherence to SOLID principles for Claude Code architectural guidance
 */
export interface SOLIDAnalysisRequest {
    projectPath: string;
    excludePatterns?: string[];
    focusOnFiles?: string[];
}
export interface SOLIDViolation {
    principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
    file: string;
    line?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
    codeSnippet?: string;
}
export interface ClassAnalysis {
    file: string;
    className: string;
    methods: number;
    responsibilities: string[];
    dependencies: string[];
    violations: SOLIDViolation[];
    complexity: number;
    maintainabilityScore: number;
}
export interface PrincipleScore {
    principle: string;
    score: number;
    violationCount: number;
    criticalViolations: number;
    description: string;
}
export interface RefactoringOpportunity {
    type: 'extract_class' | 'extract_interface' | 'dependency_injection' | 'strategy_pattern';
    description: string;
    files: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
    benefits: string[];
}
export interface SOLIDAnalysisResult {
    overallScore: number;
    principleScores: PrincipleScore[];
    violations: SOLIDViolation[];
    classAnalyses: ClassAnalysis[];
    refactoringOpportunities: RefactoringOpportunity[];
    recommendations: string[];
}
export declare class SOLIDPrinciplesAnalyzer {
    private logger;
    analyzeSOLID(params: SOLIDAnalysisRequest): Promise<SOLIDAnalysisResult>;
    private findClassFiles;
    private analyzeClassFile;
    private extractMethods;
    private identifyResponsibilities;
    private extractDependencies;
    private findViolations;
    private checkSRPViolations;
    private checkOCPViolations;
    private checkLSPViolations;
    private checkISPViolations;
    private checkDIPViolations;
    private calculateClassComplexity;
    private calculateMaintainabilityScore;
    private calculatePrincipleScores;
    private calculateOverallScore;
    private identifyRefactoringOpportunities;
    private generateRecommendations;
    private getPrincipleName;
    private getPrincipleDescription;
}
export default SOLIDPrinciplesAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map