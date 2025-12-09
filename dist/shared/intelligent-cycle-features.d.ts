/**
 * Intelligent Cycle Features
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Enhanced cycle validation features that use semantic search and AI-powered analysis
 * to provide intelligent, proactive feedback during development.
 */
import { SemanticDeduplicationResult, ExistingImplementation, IntentAnalysisResult, SmartSecurityResult, SecurityVulnerability, SecurityPattern, ISemanticDeduplicationService, IIntentAnalysisService, ISimilarityMatchingService, ISecurityScanningService, ICodeExtractionService } from './intelligent-cycle/interfaces';
export { SemanticDeduplicationResult, ExistingImplementation, IntentAnalysisResult, SmartSecurityResult, SecurityVulnerability, SecurityPattern };
export declare class IntelligentCycleFeatures {
    private semanticDeduplicationService?;
    private intentAnalysisService?;
    private similarityMatchingService?;
    private securityScanningService?;
    private codeExtractionService?;
    private logger;
    private semanticGraph;
    private initialized;
    constructor(semanticDeduplicationService?: ISemanticDeduplicationService, intentAnalysisService?: IIntentAnalysisService, similarityMatchingService?: ISimilarityMatchingService, securityScanningService?: ISecurityScanningService, codeExtractionService?: ICodeExtractionService);
    initialize(): Promise<void>;
    /**
     * Semantic-Powered Deduplication
     * Uses semantic search to find existing implementations before creating new code
     */
    checkSemanticDuplication(projectPath: string, userIntent: string, changedFiles?: string[]): Promise<SemanticDeduplicationResult>;
    /**
     * Analyze user intent from their request
     */
    analyzeUserIntent(userIntent: string): Promise<IntentAnalysisResult>;
    /**
     * Smart Security Analysis
     * Enhanced security checking with context-aware vulnerability detection
     */
    performSmartSecurity(projectPath: string, changedFiles: string[], userIntent: string): Promise<SmartSecurityResult>;
    /**
     * Extract code snippet from file (backward compatibility method)
     */
    private extractCodeSnippet;
    performSemanticDeduplication(userIntent: string, projectPath: string, language?: string): Promise<SemanticDeduplicationResult>;
}
export default IntelligentCycleFeatures;
//# sourceMappingURL=intelligent-cycle-features.d.ts.map