/**
 * Enhanced Context Provider
 * Uses selected tools to generate comprehensive context for Claude Code requests
 */
export interface EnhancedContextRequest {
    userQuery: string;
    projectPath: string;
    projectId: string;
    cliCommand: string;
    intent?: string;
    tokenBudget?: number;
    previousResults?: any;
}
export interface EnhancedContextResult {
    contextSections: Array<{
        toolName: string;
        category: string;
        priority: number;
        tokenWeight: number;
        content: string;
        insights: string[];
        confidence: number;
    }>;
    totalTokensUsed: number;
    toolsUsed: string[];
    selectionReasoning: string;
    recommendedActions: string[];
    crossToolInsights: string[];
    discoveredFiles?: Array<{
        filePath: string;
        contentType: string;
        relevanceScore: number;
        discoveryPhase: string;
    }>;
}
export interface ContextOptimizationConfig {
    maxTokens: number;
    prioritizeRecent: boolean;
    includeRecommendations: boolean;
    crossReferenceResults: boolean;
    semanticBoost: boolean;
}
export declare class ContextProvider {
    private logger;
    private toolSelector;
    private fileDiscovery;
    private claudeCodeApiUrl;
    constructor();
    /**
     * Generate enhanced context using intelligently selected tools
     */
    generateEnhancedContext(request: EnhancedContextRequest): Promise<EnhancedContextResult>;
    /**
     * Discover relevant files using hybrid vector + graph approach
     */
    private discoverRelevantFiles;
    /**
     * Map context intent to file discovery intent
     */
    private mapIntentForFileDiscovery;
    /**
     * Select tools specifically for context generation
     */
    private selectToolsForContext;
    /**
     * Run analysis with all selected tools
     */
    private runToolAnalyses;
    /**
     * Generate context sections from tool results
     */
    private generateContextSections;
    /**
     * Generate context content for a specific tool result
     */
    private generateToolContextContent;
    /**
     * Extract readable insights from tool data
     */
    private extractDataInsights;
    /**
     * Calculate token weight for prioritization
     */
    private calculateTokenWeight;
    /**
     * Optimize context sections within token budget
     */
    private optimizeContextForTokens;
    /**
     * Generate insights from cross-tool analysis
     */
    private generateCrossToolInsights;
    /**
     * Extract common themes from recommendations
     */
    private extractCommonThemes;
    /**
     * Detect conflicting recommendations
     */
    private detectRecommendationConflicts;
    /**
     * Identify synergistic opportunities
     */
    private identifySynergies;
    /**
     * Generate recommended actions based on all tool results
     */
    private generateRecommendedActions;
}
//# sourceMappingURL=context-provider.d.ts.map