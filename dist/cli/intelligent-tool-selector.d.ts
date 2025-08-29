export interface ToolSelectionContext {
    task: string;
    projectPath: string;
    codebaseContext?: CodebaseContext;
    history?: ToolUsageHistory[];
    performance?: PerformanceMetrics;
    optimization?: 'speed' | 'accuracy' | 'balanced' | 'cost_efficient' | 'orchestration';
}
export interface CodebaseContext {
    size: number;
    primaryLanguages: string[];
    frameworks: string[];
    complexity: 'low' | 'medium' | 'high';
    hasTests: boolean;
    architecture?: string;
}
export interface ToolUsageHistory {
    tool: string;
    task: string;
    success: boolean;
    performance: number;
    relevance: number;
    timestamp: Date;
}
export interface PerformanceMetrics {
    averageResponseTime: number;
    successRate: number;
    tokenEfficiency: number;
    userSatisfaction: number;
}
export interface Tool {
    name: string;
    description: string;
    capabilities: string[];
    tokenCost: 'low' | 'medium' | 'high';
    executionTime: 'fast' | 'medium' | 'slow';
    dependencies: string[];
    parallelizable: boolean;
    reliability: number;
    autoRun?: string[];
    execute: (params: any) => Promise<any>;
}
export interface ToolChain {
    tools: Tool[];
    executionStrategy: 'parallel' | 'sequential' | 'adaptive';
    fallbackChain?: Tool[];
    expectedDuration: number;
    estimatedTokens: number;
    orchestrationMetadata?: any;
}
export interface ClaudeDecision {
    selectedTools: string[];
    reasoning: string;
    confidence: number;
    optimization: string;
    alternatives: string[];
    tokenBudget: number;
    toolRecommendations?: Array<{
        toolName: string;
        confidence: number;
        reasoning: string;
    }>;
}
export interface ToolSelectionRequest {
    userQuery: string;
    projectPath: string;
    availableTools: string[];
    optimization?: 'speed' | 'accuracy' | 'balanced' | 'cost_efficient' | 'orchestration';
    maxTokens?: number;
    context?: any;
    contextHints?: string[];
}
export interface ToolSelectionResult {
    selectedTools: string[];
    reasoning: string;
    estimatedTokenSavings: number;
    executionPlan: ExecutionStep[];
    fallbackTools?: string[];
}
export interface ExecutionStep {
    tool: string;
    order: number;
    params: any;
    expectedOutput: string;
    tokenBudget: number;
}
export interface ToolExecutionResult {
    tool: string;
    success: boolean;
    data: any;
    tokensUsed: number;
    executionTime: number;
    relevanceScore: number;
}
export interface ToolDefinition {
    name: string;
    description: string;
    capabilities: string[];
    tokenCost: string;
    executionTime: string;
    dependencies?: string[];
    parallelizable?: boolean;
    reliability?: number;
    autoRun?: string[];
}
export declare class IntelligentToolSelector {
    private logger;
    private claude;
    private monitor;
    private db;
    private tools;
    private performanceHistory;
    private toolDescriptionsCache;
    private cacheExpiry;
    private readonly CACHE_DURATION;
    private availableTools;
    private claudeIntegration;
    constructor();
    private initializeAsync;
    /**
     * Core function: Intelligent decision engine for the Orchestrator
     *
     * This is NOT a CLI tool itself, but the brain that decides:
     * - Which analysis tools to run
     * - How to coordinate Claude Code terminals
     * - What contexts each terminal should receive
     * - Optimal execution strategy for complex queries
     */
    private registerAnalysisTools;
    selectTools(request: ToolSelectionRequest): Promise<ToolSelectionResult>;
    selectOptimalTools(context: ToolSelectionContext): Promise<ToolChain>;
    /**
     * NEW: Automatic Context Enhancement for Code Generation
     * This method automatically runs essential tools to enhance Claude's context
     * Based on the type of request, it ensures comprehensive context is provided
     */
    enhanceContextAutomatically(context: {
        task: string;
        projectPath: string;
        requestType?: 'code-generation' | 'ui-development' | 'refactoring' | 'architecture-changes' | 'feature-development' | 'bug-fixes' | 'testing' | 'documentation' | 'general';
    }): Promise<ToolChain>;
    detectRequestType(task: string): string;
    private selectCoreContextTools;
    private selectRequestSpecificTools;
    private getToolsByNames;
    private deduplicateTools;
    /**
     * Special method for orchestration planning
     * Determines which analysis tools should feed which terminal roles
     */
    planOrchestrationStrategy(context: ToolSelectionContext): Promise<ToolChain>;
    private enrichContext;
    private claudeAnalyzeAndSelect;
    private buildClaudePrompt;
    private loadPerformanceHistory;
    private createToolExecutor;
    private getPerformanceMetrics;
    private analyzeCodebase;
    private getToolUsageHistory;
    private parseClaudeDecision;
    private buildToolChain;
    private addToolDependencies;
    private determineExecutionStrategy;
    private estimateTokenUsage;
    private estimateDuration;
    private buildFallbackChain;
    private recordDecision;
    private fallbackSelection;
    private getProjectId;
    private analyzeQueryWithClaude;
    private buildToolSelectionPrompt;
    private parseToolSelectionResponse;
    private extractToolsFromNaturalLanguage;
    private useHeuristicSelection;
    private optimizeSelection;
    private addDependencies;
    private createExecutionPlan;
    private generateToolParams;
    private suggestFallbacks;
    private calculateTokenSavings;
    executeTools(selection: ToolSelectionResult, request: ToolSelectionRequest): Promise<ToolExecutionResult[]>;
    private executeSingleTool;
    private executeFallbackTools;
    private calculateRelevanceScore;
    private estimateTokens;
    getAvailableTools(): ToolDefinition[];
    getAvailableToolNames(): string[];
    registerTool(tool: ToolDefinition): void;
    /**
     * Analyze query complexity to determine if orchestration is beneficial
     */
    private analyzeQueryComplexity;
    /**
     * Determine which analysis tools are needed for orchestration
     */
    private determineRequiredAnalysis;
    /**
     * Plan how terminals should be coordinated
     */
    private planTerminalCoordination;
    private countComplexityKeywords;
    private assessQueryScope;
    private identifyDomains;
    private requiresMultiplePerspectives;
    private estimateEffortLevel;
    private calculateComplexityScore;
    private mapAnalysisToRoles;
    private createAnalysisMapping;
    private isToolRelevantForRole;
    private prioritizeAnalysis;
    private estimateOrchestrationDuration;
    private estimateOrchestrationTokens;
}
export default IntelligentToolSelector;
//# sourceMappingURL=intelligent-tool-selector.d.ts.map