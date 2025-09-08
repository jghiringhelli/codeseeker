/**
 * Intelligent Cycle Features
 *
 * Enhanced cycle validation features that use semantic search and AI-powered analysis
 * to provide intelligent, proactive feedback during development.
 */
export interface SemanticDeduplicationResult {
    hasDuplicates: boolean;
    existingImplementations: ExistingImplementation[];
    semanticSimilarity: number;
    recommendations: string[];
    shouldProceed: boolean;
}
export interface ExistingImplementation {
    file: string;
    function?: string;
    class?: string;
    similarity: number;
    description: string;
    codeSnippet: string;
    lineRange: {
        start: number;
        end: number;
    };
}
export interface IntentAnalysisResult {
    intendedFunctionality: string;
    detectedPatterns: string[];
    suggestedNames: string[];
    architecturalConcerns: string[];
    bestPractices: string[];
}
export interface SmartSecurityResult {
    vulnerabilities: SecurityVulnerability[];
    patterns: SecurityPattern[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface SecurityVulnerability {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    file: string;
    line?: number;
    suggestion: string;
    example?: string;
}
export interface SecurityPattern {
    pattern: string;
    description: string;
    recommendation: string;
}
export declare class IntelligentCycleFeatures {
    private logger;
    private semanticGraph;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    /**
     * Semantic-Powered Deduplication
     * Uses semantic search to find existing implementations before creating new code
     */
    checkSemanticDuplication(projectPath: string, userIntent: string, changedFiles?: string[]): Promise<SemanticDeduplicationResult>;
    /**
     * Analyze user intent from their request
     */
    private analyzeUserIntent;
    /**
     * Find semantic matches using OPTIMIZED database selection
     * Uses PostgreSQL pgvector for similarity, Neo4j for relationships
     */
    private findSemanticMatches;
    /**
     * PostgreSQL pgvector similarity search for deduplication
     */
    private findVectorSimilarityMatches;
    /**
     * Neo4j relationship-based discovery (complementary to vector search)
     */
    private findRelationshipMatches;
    /**
     * Legacy Neo4j-only search (fallback)
     */
    private findSemanticMatchesLegacy;
    /**
     * Remove duplicate matches and merge information
     */
    private deduplicateMatches;
    /**
     * Find pattern matches using traditional search
     */
    private findPatternMatches;
    /**
     * Generate search patterns based on functionality
     */
    private generateSearchPatterns;
    /**
     * Extract code snippet from file
     */
    private extractCodeSnippet;
    /**
     * Extract snippet from lines array
     */
    private extractSnippetFromLines;
    /**
     * Generate intelligent duplication recommendations
     */
    private generateDuplicationRecommendations;
    /**
     * Smart Security Analysis
     * Enhanced security checking with context-aware vulnerability detection
     */
    performSmartSecurity(projectPath: string, changedFiles: string[], userIntent: string): Promise<SmartSecurityResult>;
    /**
     * Get contextual security patterns based on user intent
     */
    private getContextualSecurityPatterns;
    /**
     * Scan content for vulnerabilities
     */
    private scanForVulnerabilities;
    /**
     * Get severity from pattern description
     */
    private getSeverityFromPattern;
    /**
     * Calculate overall risk level
     */
    private calculateRiskLevel;
    /**
     * Generate security recommendations
     */
    private generateSecurityRecommendations;
    /**
     * Get suggestion for vulnerability type
     */
    private getSuggestionForVulnerability;
}
export default IntelligentCycleFeatures;
//# sourceMappingURL=intelligent-cycle-features.d.ts.map