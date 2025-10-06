/**
 * Claude Tool Orchestrator
 * Uses Claude to intelligently select tools and determine parameters based on user requests
 */
export interface ClaudeToolSelection {
    selectedTools: ToolSelectionResult[];
    reasoning: string;
    confidence: number;
    executionPlan: ExecutionPlan;
    estimatedTokens: number;
    estimatedTime: number;
}
export interface ToolSelectionResult {
    toolId: string;
    toolName: string;
    parameters: Record<string, any>;
    confidence: number;
    reasoning: string;
    priority: number;
    executionOrder: number;
}
export interface ExecutionPlan {
    sequential: string[];
    parallel: string[][];
    conditional: Array<{
        condition: string;
        tools: string[];
    }>;
    fallbacks: Array<{
        primaryTool: string;
        fallbackTools: string[];
    }>;
}
export interface ContextEnhancementRequest {
    userRequest: string;
    projectPath: string;
    projectId: string;
    projectContext: {
        languages: string[];
        frameworks: string[];
        fileTypes: string[];
        size: 'small' | 'medium' | 'large';
        hasTests: boolean;
        hasDocumentation: boolean;
    };
    previousAnalysis?: any[];
    constraints?: {
        maxTools?: number;
        maxTokens?: number;
        maxExecutionTime?: number;
        preferredTools?: string[];
        excludedTools?: string[];
    };
}
export declare class ClaudeToolOrchestrator {
    private availableTools;
    private toolBundles;
    constructor();
    /**
     * Initialize available tools from registry
     */
    private initializeTools;
    /**
     * Main orchestration method - uses Claude to select tools and parameters
     */
    orchestrateTools(request: ContextEnhancementRequest): Promise<ClaudeToolSelection>;
    /**
     * Step 1: Analyze user intent using Claude
     */
    private analyzeUserIntent;
    /**
     * Step 2: Select tools using Claude intelligence
     */
    private selectToolsWithClaude;
    /**
     * Step 3: Determine parameters for each selected tool using Claude
     */
    private determineToolParameters;
    /**
     * Step 4: Create execution plan
     */
    private createExecutionPlan;
    /**
     * Simulate Claude intent analysis
     */
    private simulateClaudeIntentAnalysis;
    /**
     * Simulate Claude tool selection
     */
    private simulateClaudeToolSelection;
    /**
     * Simulate Claude parameter determination
     */
    private simulateClaudeParameterDetermination;
    /**
     * Calculate tool confidence score
     */
    private calculateToolConfidence;
    /**
     * Calculate tool priority
     */
    private calculateToolPriority;
    /**
     * Check if tool can execute independently
     */
    private canExecuteIndependently;
    /**
     * Find alternative tools for fallbacks
     */
    private findAlternativeTools;
    /**
     * Generate reasoning for tool selection
     */
    private generateSelectionReasoning;
    /**
     * Calculate overall confidence
     */
    private calculateOverallConfidence;
    /**
     * Estimate resource usage
     */
    private estimateResources;
    private buildIntentAnalysisPrompt;
    private buildToolSelectionPrompt;
    private buildParameterPrompt;
    private loadToolBundles;
}
//# sourceMappingURL=claude-tool-orchestrator.d.ts.map