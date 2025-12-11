/**
 * Workflow Orchestrator Service - STREAMLINED MVP
 * Single Responsibility: Coordinate the CodeMind Core Cycle with minimal friction
 *
 * Simplified workflow:
 * 1. Query Analysis (ONE Claude call for intent + complexity + clarification check)
 * 2. Semantic Search (find relevant files)
 * 3. Graph Analysis (show relationships if found)
 * 4. Build Context & Execute Claude
 * 5. Apply Changes (with user approval)
 * 6. Quality Check (auto build/test)
 * 7. Database Sync (silent)
 */
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { EnhancedContext } from './context-builder';
import { ClaudeResponse } from './user-interaction-service';
export interface QueryAnalysis {
    assumptions: string[];
    ambiguities: string[];
    intent: string;
    confidence: number;
    reasoning?: string;
    requiresModifications?: boolean;
    suggestedClarifications?: string[];
    targetEntities?: string[];
}
export interface WorkflowResult {
    success: boolean;
    queryAnalysis: QueryAnalysis;
    semanticResults: SemanticResult[];
    graphContext: GraphContext;
    enhancedContext: EnhancedContext;
    claudeResponse?: ClaudeResponse;
    buildResult?: BuildTestResult;
    syncResult?: SyncResult;
    error?: string;
}
export interface BuildTestResult {
    buildSuccess: boolean;
    testSuccess: boolean;
    buildOutput?: string;
    testOutput?: string;
    buildError?: string;
    testError?: string;
}
export interface SyncResult {
    filesUpdated: number;
    graphNodesCreated: number;
    cacheUpdated: number;
}
export interface WorkflowOptions {
    skipBuildTest?: boolean;
    skipDatabaseSync?: boolean;
    maxSemanticResults?: number;
    projectId?: string;
    transparentMode?: boolean;
}
export declare class WorkflowOrchestrator {
    private _unifiedAnalyzer?;
    private _searchOrchestrator?;
    private _graphAnalysisService?;
    private _contextBuilder?;
    private _userInteractionService?;
    private _databaseUpdateManager?;
    private _dbConnections?;
    private projectPath;
    private projectId;
    private _readlineInterface?;
    private get unifiedAnalyzer();
    private get searchOrchestrator();
    private get graphAnalysisService();
    private get contextBuilder();
    private get userInteractionService();
    private get dbConnections();
    private get databaseUpdateManager();
    constructor(projectPath: string, projectId?: string);
    setReadlineInterface(rl: any): void;
    setProject(projectId: string, projectPath: string): void;
    /**
     * Execute the streamlined CodeMind workflow
     */
    executeWorkflow(query: string, projectPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
    /**
     * Ask a clarification question (only when Claude says it's critical)
     */
    private askClarification;
    /**
     * Run autonomous quality check - build and test without prompts
     */
    private runAutonomousQualityCheck;
    /**
     * Show minimal completion summary
     */
    private showCompletionSummary;
    /**
     * Convert UnifiedAnalysis to legacy QueryAnalysis format
     */
    private toLegacyAnalysis;
    /**
     * Get icon for intent
     */
    private getIntentIcon;
    /**
     * Run build
     */
    private runBuild;
    /**
     * Run tests
     */
    private runTests;
    /**
     * Sync databases
     */
    private syncDatabases;
    /**
     * Check if workflow should be used
     */
    shouldUseWorkflow(input: string): boolean;
    /**
     * Create empty graph context
     */
    private createEmptyGraphContext;
    /**
     * Create empty enhanced context
     */
    private createEmptyEnhancedContext;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Factory method
     */
    static create(projectPath?: string, projectId?: string): WorkflowOrchestrator;
}
//# sourceMappingURL=workflow-orchestrator.d.ts.map