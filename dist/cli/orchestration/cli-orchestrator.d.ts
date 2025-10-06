/**
 * CLI Orchestrator - High-Level Command Orchestration
 *
 * Follows SOLID principles:
 * - Single Responsibility: Orchestrates high-level CLI flow
 * - Open/Closed: Extensible for new command types
 * - Liskov Substitution: Command handlers are interchangeable
 * - Interface Segregation: Clean command interfaces
 * - Dependency Inversion: Depends on abstractions
 */
export interface AnalysisRequest {
    query: string;
    projectPath: string;
    projectId: string;
    options?: {
        tokenBudget?: number;
        semanticDepth?: number;
        maxTools?: number;
    };
}
export interface AnalysisResult {
    success: boolean;
    analysis?: any;
    recommendations?: string[];
    executionTime: number;
    tokensUsed?: number;
    error?: string;
}
export interface OrchestrationContext {
    sessionId: string;
    projectPath: string;
    projectId: string;
    settings: {
        tokenBudget: number;
        semanticDepth: number;
        maxTools: number;
        executionStrategy: 'parallel' | 'sequential' | 'hybrid';
    };
}
/**
 * High-level orchestrator that coordinates all CLI operations
 * Keeps the main CLI class simple by handling complex orchestration logic
 */
export declare class CLIOrchestrator {
    private logger;
    private semanticOrchestrator;
    private treeNavigator;
    private contextOptimizer;
    constructor();
    /**
     * High-level analysis orchestration
     * Simplified 4-step process
     */
    executeAnalysis(request: AnalysisRequest, context: OrchestrationContext): Promise<AnalysisResult>;
    /**
     * Step 1: Semantic Discovery
     * Use semantic orchestrator to understand the query and find relevant code
     */
    private performSemanticDiscovery;
    /**
     * Step 2: Context Enhancement
     * Use tree navigation and context optimization to build rich context
     */
    private enhanceContext;
    /**
     * Step 3: Tool Selection & Execution
     * Select appropriate tools and execute them with enhanced context
     */
    private selectAndExecuteTools;
    /**
     * Step 4: Results Integration
     * Combine all results into coherent analysis
     */
    private integrateResults;
    /**
     * Determine user intent from query
     */
    private determineIntent;
    /**
     * Calculate approximate tokens used
     */
    private calculateTokensUsed;
    /**
     * Generate analysis summary
     */
    private generateAnalysisSummary;
    /**
     * Generate recommendations
     */
    private generateRecommendations;
}
//# sourceMappingURL=cli-orchestrator.d.ts.map