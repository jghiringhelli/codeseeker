/**
 * Intent Analyzer - Claude-powered intention analysis
 * Analyzes user requests to determine intent, complexity, and required tools
 */
export interface ProcessedIntent {
    intention: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedFiles: number;
    suggestedTools: string[];
    riskLevel: 'low' | 'medium' | 'high';
    primaryDomains: string[];
    timeEstimate: number;
    confidence: number;
}
export interface IntentAnalysisRequest {
    query: string;
    projectContext?: {
        languages: string[];
        frameworks: string[];
        projectType: string;
    };
    userHistory?: {
        recentQueries: string[];
        successfulPatterns: string[];
    };
}
export declare class IntentAnalyzer {
    private logger;
    analyzeIntent(request: IntentAnalysisRequest): Promise<ProcessedIntent>;
    private buildIntentAnalysisPrompt;
    private processWithClaude;
    private generateMockClaudeResponse;
    private parseIntentResponse;
    private adjustForProjectContext;
    private generateFallbackIntent;
    private validateComplexity;
    private validateRiskLevel;
    private validateTools;
}
export default IntentAnalyzer;
//# sourceMappingURL=intent-analyzer.d.ts.map