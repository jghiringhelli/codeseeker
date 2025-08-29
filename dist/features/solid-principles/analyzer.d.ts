export interface SOLIDViolation {
    principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
    file: string;
    line?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
    codeSnippet?: string;
    relatedClasses?: string[];
}
export interface ClassAnalysis {
    name: string;
    file: string;
    responsibilities: string[];
    methods: string[];
    dependencies: string[];
    violations: SOLIDViolation[];
    complexity: number;
    cohesion: number;
}
export interface SOLIDAnalysisResult {
    violations: SOLIDViolation[];
    classAnalyses: ClassAnalysis[];
    overallScore: number;
    principleScores: {
        SRP: number;
        OCP: number;
        LSP: number;
        ISP: number;
        DIP: number;
    };
    recommendations: string[];
    refactoringOpportunities: string[];
}
export declare class SOLIDPrinciplesAnalyzer {
    private logger;
    analyzeSOLID(params: {
        projectPath: string;
        includeTests?: boolean;
        excludePatterns?: string[];
        frameworks?: string[];
    }): Promise<SOLIDAnalysisResult>;
    private findClassFiles;
    private analyzeClassFile;
    private extractClassName;
    private extractMethods;
    private extractDependencies;
    private analyzeResponsibilities;
    private analyzeViolations;
    private analyzeSRPViolations;
    private analyzeOCPViolations;
    private analyzeLSPViolations;
    private analyzeISPViolations;
    private analyzeDIPViolations;
    private calculateComplexity;
    private calculateCohesion;
    private calculatePrincipleScores;
    private calculateOverallScore;
    private generateRecommendations;
    private identifyRefactoringOpportunities;
}
export default SOLIDPrinciplesAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map