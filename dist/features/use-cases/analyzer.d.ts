export interface BusinessUseCase {
    id: string;
    name: string;
    description: string;
    actors: string[];
    preconditions: string[];
    postconditions: string[];
    mainFlow: string[];
    alternateFlows?: string[];
    exceptions?: string[];
    businessValue: 'low' | 'medium' | 'high' | 'critical';
    complexity: 'simple' | 'medium' | 'complex';
    implementationFiles: string[];
    missingImplementations: string[];
}
export interface ResponsibilityMapping {
    useCase: string;
    component: string;
    file: string;
    responsibilities: string[];
    separationScore: number;
    violations: string[];
    suggestions: string[];
}
export interface BusinessLogicAnalysis {
    file: string;
    businessRules: string[];
    dataValidations: string[];
    businessEntities: string[];
    workflows: string[];
    integrations: string[];
    complexity: number;
    maintainability: number;
}
export interface UseCaseGap {
    type: 'missing_implementation' | 'orphaned_code' | 'responsibility_violation' | 'missing_validation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedFiles: string[];
    useCases: string[];
    suggestion: string;
    businessImpact: string;
}
export interface UseCaseAnalysisResult {
    useCases: BusinessUseCase[];
    responsibilityMappings: ResponsibilityMapping[];
    businessLogicAnalysis: BusinessLogicAnalysis[];
    gaps: UseCaseGap[];
    separationScore: number;
    businessCoverage: number;
    recommendations: string[];
    architectureHealth: {
        layerSeparation: number;
        businessLogicIsolation: number;
        dependencyDirection: number;
        testability: number;
    };
}
export declare class UseCasesAnalyzer {
    private logger;
    analyzeUseCases(params: {
        projectPath: string;
        businessDocsPath?: string;
        includeTests?: boolean;
        frameworks?: string[];
        businessDomain?: string;
    }): Promise<UseCaseAnalysisResult>;
    private discoverUseCases;
    private parseDocumentationUseCases;
    private extractUseCasesFromText;
    private extractDescription;
    private extractActors;
    private inferBusinessValue;
    private inferComplexity;
    private inferUseCasesFromCode;
    private extractUseCasesFromServiceFile;
    private camelCaseToTitle;
    private inferUseCasesFromAPI;
    private extractUseCasesFromAPIFile;
    private endpointToUseCase;
    private deduplicateUseCases;
    private analyzeBusinessLogic;
    private analyzeBusinessLogicFile;
    private extractBusinessRules;
    private extractDataValidations;
    private extractBusinessEntities;
    private extractWorkflows;
    private extractIntegrations;
    private calculateFileComplexity;
    private calculateMaintainability;
    private mapResponsibilities;
    private findRelatedFiles;
    private extractKeywordsFromUseCase;
    private createResponsibilityMapping;
    private calculateFileSeparationScore;
    private identifyResponsibilityViolations;
    private generateResponsibilitySuggestions;
    private identifyGaps;
    private calculateSeparationScore;
    private calculateBusinessCoverage;
    private assessArchitectureHealth;
    private assessDependencyDirection;
    private assessTestability;
    private generateRecommendations;
}
export default UseCasesAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map