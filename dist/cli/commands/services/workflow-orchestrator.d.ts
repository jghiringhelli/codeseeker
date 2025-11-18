/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind workflow
 * Orchestrates the entire process from query analysis to Claude execution
 */
import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { EnhancedContext } from './context-builder';
import { ClaudeResponse } from './user-interaction-service';
export interface WorkflowResult {
    success: boolean;
    queryAnalysis: QueryAnalysis;
    semanticResults: SemanticResult[];
    graphContext: GraphContext;
    enhancedContext: EnhancedContext;
    claudeResponse?: ClaudeResponse;
    error?: string;
}
export interface WorkflowOptions {
    skipUserClarification?: boolean;
    skipFileConfirmation?: boolean;
    maxSemanticResults?: number;
    semanticThreshold?: number;
}
export declare class WorkflowOrchestrator {
    private _nlpProcessor?;
    private _searchOrchestrator?;
    private _graphAnalysisService?;
    private _contextBuilder?;
    private _userInteractionService?;
    private projectPath;
    private get nlpProcessor();
    private get searchOrchestrator();
    private get graphAnalysisService();
    private get contextBuilder();
    private get userInteractionService();
    constructor(projectPath: string);
    /**
     * Execute the complete CodeMind workflow
     */
    executeWorkflow(query: string, projectPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
    /**
     * Check if input is suitable for the full workflow
     */
    shouldUseWorkflow(input: string): boolean;
    /**
     * Get workflow statistics for monitoring
     */
    getWorkflowStats(result: WorkflowResult): {
        stepsCompleted: number;
        totalSteps: number;
        filesAnalyzed: number;
        relationshipsFound: number;
        assumptionsDetected: number;
        executionTime?: number;
    };
    /**
     * Log query analysis results
     */
    private logQueryAnalysis;
    /**
     * Create a factory method for dependency injection
     */
    static create(projectPath?: string): WorkflowOrchestrator;
    /**
     * Validate that all required services are properly initialized
     */
    validateServices(): boolean;
}
//# sourceMappingURL=workflow-orchestrator.d.ts.map