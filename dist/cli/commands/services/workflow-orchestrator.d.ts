/**
 * Workflow Orchestrator Service - TRANSPARENT MODE
 * Single Responsibility: Coordinate CodeMind workflow OR pass through to Claude transparently
 *
 * Workflow when DBs are UP:
 * 1. Semantic Search (find relevant files using embeddings)
 * 2. Graph Analysis (show relationships)
 * 3. Build Context & Execute Claude with enhanced context
 * 4. Quality Check (auto build/test)
 * 5. Database Sync
 *
 * When DBs are DOWN:
 * - Inform user that CodeMind is running in transparent mode
 * - Pass query directly to Claude (same as using `claude` directly)
 * - Only difference: quality checks at the end
 */
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { EnhancedContext } from './context-builder';
import { UserInteractionService, ClaudeResponse } from './user-interaction-service';
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
    transparentMode?: boolean;
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
    forceSearch?: boolean;
    isCommandMode?: boolean;
}
export declare class WorkflowOrchestrator {
    private _searchOrchestrator?;
    private _graphAnalysisService?;
    private _contextBuilder?;
    private _userInteractionService?;
    private _databaseUpdateManager?;
    private _dbConnections?;
    private projectPath;
    private projectId;
    private _readlineInterface?;
    private get searchOrchestrator();
    private get graphAnalysisService();
    private get contextBuilder();
    private get userInteractionService();
    private get dbConnections();
    private get databaseUpdateManager();
    constructor(projectPath: string, projectId?: string);
    setReadlineInterface(rl: any): void;
    /**
     * Set verbose mode (show full debug output: files, relationships, prompt)
     */
    setVerboseMode(enabled: boolean): void;
    /**
     * Get the UserInteractionService for external access
     * Used by CommandRouter for search toggle management
     */
    getUserInteractionService(): UserInteractionService;
    setProject(projectId: string, projectPath: string): void;
    /**
     * Check if databases are available for enhanced workflow
     */
    private checkDatabaseAvailability;
    /**
     * Execute the CodeMind workflow
     * - If DBs are available: enhanced workflow with semantic search + context
     * - If DBs are down: transparent mode - pass through to Claude directly
     */
    executeWorkflow(query: string, projectPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
    /**
     * Transparent mode - pass query directly to Claude
     * Used when databases are unavailable
     */
    private executeTransparentMode;
    /**
     * Enhanced mode - full workflow with semantic search and context building
     * Used when databases are available
     */
    private executeEnhancedMode;
    /**
     * Run autonomous quality check - build and test without prompts
     */
    private runAutonomousQualityCheck;
    /**
     * Show minimal completion summary
     */
    private showCompletionSummary;
    /**
     * Create default query analysis (no longer using Claude for intent detection)
     */
    private createDefaultQueryAnalysis;
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
     * Check if workflow should be used (natural language vs command)
     * This is simple command routing, NOT intent detection
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