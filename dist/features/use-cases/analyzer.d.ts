/**
 * Use Cases Analyzer - Simplified Business Logic Understanding
 * Maps business requirements to code implementation for Claude Code context enhancement
 */
export interface UseCasesAnalysisRequest {
    projectPath: string;
    businessDocsPath?: string;
    excludePatterns?: string[];
}
export interface UseCase {
    id: string;
    name: string;
    description: string;
    source: 'documentation' | 'code' | 'api';
    files: string[];
    endpoints?: string[];
    businessValue: 'high' | 'medium' | 'low';
    implementationStatus: 'complete' | 'partial' | 'missing';
}
export interface BusinessLogicFile {
    path: string;
    type: 'service' | 'controller' | 'model' | 'business' | 'other';
    useCases: string[];
    complexity: number;
    businessMethods: string[];
}
export interface UseCasesAnalysisResult {
    useCases: UseCase[];
    businessLogicFiles: BusinessLogicFile[];
    businessCoverage: number;
    separationScore: number;
    recommendations: string[];
    architectureHealth: {
        score: number;
        issues: string[];
        strengths: string[];
    };
}
export declare class UseCasesAnalyzer {
    private logger;
    analyzeUseCases(params: UseCasesAnalysisRequest): Promise<UseCasesAnalysisResult>;
    private discoverUseCases;
    private parseDocumentationUseCases;
    private inferUseCasesFromAPI;
    private inferUseCasesFromCode;
    private analyzeBusinessLogic;
    private extractUseCasesFromText;
    private extractBusinessMethods;
    private deduplicateUseCases;
    private calculateBusinessCoverage;
    private calculateSeparationScore;
    private assessArchitectureHealth;
    private generateRecommendations;
    private endpointToUseCaseName;
    private methodToUseCaseName;
    private determineFileType;
    private calculateFileComplexity;
}
export default UseCasesAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map